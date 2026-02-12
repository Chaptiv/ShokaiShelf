/**
 * NetRecDream V4 - Dream Scoring Engine
 *
 * Multiplicative scoring system with veto rules, cluster boosts,
 * and behavioral modifiers. Extends V3's linear scoring with
 * personalized multipliers from the DreamProfile.
 */

import {
  DreamProfile,
  DreamScoreBreakdown,
  BehavioralMetrics,
  SemanticRules
} from './dream-types';
import { getClusterScoreModifier, findMatchingClusters } from './semantic-clustering';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Media {
  id: number;
  title?: { romaji?: string; english?: string; native?: string };
  episodes?: number;
  duration?: number;
  genres?: string[];
  tags?: { name: string; rank?: number }[];
  studios?: { nodes: { name: string; isAnimationStudio?: boolean }[] };
  format?: string;
  season?: string;
  seasonYear?: number;
  startDate?: { year?: number; month?: number; day?: number };
  averageScore?: number;
  popularity?: number;
  isAdult?: boolean;
}

interface Features {
  cf: number;
  content: number;
  freshness: number;
  relations: number;
  feedback: number;
  negativeSignal: number;
  interaction: number;
  // Additional features
  genreOverlap: number;
  tagOverlap: number;
  studioMatch: number;
  formatMatch: number;
  sourceMatch: number;
  sequelPotential: number;
}

interface Candidate {
  media: Media;
  sources: string[];
}

// =============================================================================
// MAIN SCORING FUNCTION
// =============================================================================

/**
 * Calculate Dream score for a candidate anime
 */
export function calculateDreamScore(
  candidate: Candidate,
  profile: DreamProfile,
  features: Features
): DreamScoreBreakdown {
  // 1. Calculate base score using adaptive weights
  const baseScore = calculateBaseScore(features, profile);

  // 2. Apply VETO SYSTEM (multiplicative penalties)
  const vetoMultiplier = applyVetoRules(candidate.media, profile.rules);

  // 3. Apply SEMANTIC CLUSTER BOOST
  const clusterBoost = applyClusterBoost(candidate.media, profile);

  // 4. Apply BEHAVIORAL MODIFIERS
  const behavioralModifier = applyBehavioralModifiers(candidate.media, profile.metrics);

  // 5. Apply TOLERANCE ADJUSTMENT
  const toleranceAdjustment = applyToleranceAdjustment(candidate.media, profile.metrics);

  // 6. Calculate raw score (can be > 1.0!)
  let rawScore = baseScore * vetoMultiplier * clusterBoost * behavioralModifier * toleranceAdjustment;

  // 7. SOFT-CAP SYSTEM
  // Goal: 100% should be almost impossible, so you can see differences
  // Raw Score 0.8 -> 80%, Raw Score 1.0 -> ~92%, Raw Score 1.5 -> ~99%
  let dreamScore = rawScore;

  if (rawScore > 0.8) {
    // Everything above 0.8 gets logarithmically dampened
    // Formula: Threshold + (RestSpace * (1 - e^(-Overhead * Damping)))
    const threshold = 0.8;
    const overhead = rawScore - threshold;
    const dampingFactor = 4.0; // Higher = stricter

    dreamScore = threshold + (0.2 * (1 - Math.exp(-overhead * dampingFactor)));
  }

  // Safety clamp (shouldn't be needed, but just in case)
  dreamScore = Math.max(0, Math.min(1, dreamScore));

  // 8. Calculate confidence
  const confidence = calculateConfidence(profile, features, vetoMultiplier);

  return {
    // Base V3 scores
    cf: features.cf,
    content: features.content,
    freshness: features.freshness,
    relations: features.relations,
    feedback: features.feedback,
    negativeSignal: features.negativeSignal,
    interaction: features.interaction,

    // Dream-specific scores
    clusterBoost,
    vetoMultiplier,
    behavioralModifier,
    toleranceAdjustment,

    // Final scores
    baseScore,
    dreamScore,
    confidence
  };
}

// =============================================================================
// BASE SCORE CALCULATION
// =============================================================================

/**
 * Calculate weighted base score using adaptive weights
 */
function calculateBaseScore(features: Features, profile: DreamProfile): number {
  const w = profile.weights;

  let score = 0;

  // Positive contributions
  score += w.cf * features.cf;
  score += w.content * features.content;
  score += w.freshness * features.freshness;
  score += w.relations * features.relations;
  score += w.feedback * features.feedback;
  score += w.interaction * features.interaction;

  // Negative contribution (penalty)
  score -= w.negativeSignal * features.negativeSignal;

  // Clamp base score to [0, 1]
  return Math.max(0, Math.min(1, score));
}

// =============================================================================
// VETO RULES (HARD CONSTRAINTS)
// =============================================================================

/**
 * Apply hard veto rules - multiplicative penalties
 */
export function applyVetoRules(media: Media, rules: SemanticRules): number {
  const mediaTags = (media.tags || []).map(t => t.name);
  const mediaGenres = media.genres || [];
  const studioNames = (media.studios?.nodes || []).map(s => s.name);
  const year = media.startDate?.year || new Date().getFullYear();
  const episodes = media.episodes || 12;

  // Start with no penalty
  let multiplier = 1.0;

  // HARD VETO: Blacklisted tags (95% penalty)
  for (const blackTag of rules.blacklistedTags) {
    if (mediaTags.includes(blackTag)) {
      return 0.05; // Near-zero score
    }
  }

  // HARD VETO: Blacklisted genres (90% penalty)
  for (const blackGenre of rules.blacklistedGenres) {
    if (mediaGenres.includes(blackGenre)) {
      return 0.10;
    }
  }

  // STUDIO VETO: Blacklisted studios (70% penalty)
  if (rules.blacklistedStudios.some(s => studioNames.includes(s))) {
    multiplier *= 0.30;
  }

  // YEAR CONSTRAINT: Too old for user
  if (rules.minYear && year < rules.minYear) {
    multiplier *= 0.40;
  }

  // EPISODE CONSTRAINT: Too long for user
  if (rules.maxEpisodes && episodes > rules.maxEpisodes) {
    multiplier *= 0.50;
  }

  // WHITELIST BOOSTS (toned down to prevent score inflation)
  // Whitelisted studios (15% boost, was 30%)
  if (rules.whitelistedStudios.some(s => studioNames.includes(s))) {
    multiplier *= 1.15;
  }

  // Whitelisted genres (5% boost per genre, was 12%)
  const genreBoost = rules.whitelistedGenres.filter(g => mediaGenres.includes(g)).length;
  if (genreBoost > 0) {
    multiplier *= 1 + (genreBoost * 0.05); // Up to 15% boost for 3 matching genres
  }

  // Whitelisted tags (5% boost per matching tag, max 20%, was 10%/40%)
  const tagBoost = rules.whitelistedTags.filter(t => mediaTags.includes(t)).length;
  if (tagBoost > 0) {
    multiplier *= 1 + Math.min(tagBoost * 0.05, 0.20);
  }

  return multiplier;
}

// =============================================================================
// CLUSTER BOOST (SEMANTIC VIBES)
// =============================================================================

/**
 * Apply cluster-based boost from learned semantic patterns
 */
export function applyClusterBoost(media: Media, profile: DreamProfile): number {
  if (profile.clusters.clusters.length === 0) {
    return 1.0; // No clusters yet
  }

  const mediaTags = [
    ...(media.tags || []).map(t => t.name),
    ...(media.genres || [])
  ];

  return getClusterScoreModifier(mediaTags, profile);
}

// =============================================================================
// BEHAVIORAL MODIFIERS
// =============================================================================

/**
 * Apply modifiers based on user's behavioral patterns
 */
export function applyBehavioralModifiers(
  media: Media,
  metrics: BehavioralMetrics
): number {
  let modifier = 1.0;
  const episodes = media.episodes || 12;

  // BINGE VELOCITY MODIFIER (toned down to prevent score inflation)
  if (metrics.bingeVelocity > 3.0) {
    // Power user - can handle longer series
    if (episodes >= 24) {
      modifier *= 1.08; // 8% boost for 2-cour+ (was 15%)
    }
    if (episodes >= 50) {
      modifier *= 1.05; // Additional 5% for long series (was 10%)
    }
  } else if (metrics.bingeVelocity < 1.5) {
    // Slow watcher - penalize very long series
    if (episodes >= 50) {
      modifier *= 0.75; // 25% penalty (was 30%)
    } else if (episodes >= 24) {
      modifier *= 0.88; // 12% penalty (was 15%)
    }
  }

  // COMPLETIONIST MODIFIER
  if (metrics.completionistScore > 0.8) {
    // High completion rate - they finish what they start
    // Slight boost for shorter series (easier to complete)
    if (episodes <= 13) {
      modifier *= 1.03; // 3% boost (was 5%)
    }
  } else if (metrics.completionistScore < 0.4) {
    // Low completion rate - prioritize shorter/accessible content
    if (episodes > 24) {
      modifier *= 0.85; // 15% penalty (was 20%)
    }
  }

  // DROP PATTERN INFLUENCE
  if (metrics.vibeCheckDrops > 10) {
    // User frequently drops after few episodes
    // They might prefer "hook" anime that grab you immediately
    // Penalize long series slightly (more commitment)
    if (episodes > 24) {
      modifier *= 0.92; // 8% penalty (was 10%)
    }
  }

  // FORMAT PREFERENCE
  const format = media.format || 'TV';
  if (metrics.preferredFormats.includes(format)) {
    modifier *= 1.05; // 5% boost for preferred format (was 8%)
  } else if (metrics.preferredFormats.length > 0 && !metrics.preferredFormats.includes(format)) {
    modifier *= 0.95; // 5% penalty for non-preferred (was 8%)
  }

  // RECENCY MODIFIER
  // If user has been inactive, boost fresh/popular content
  if (metrics.daysSinceLastWatch > 30) {
    const avgScore = media.averageScore || 0;
    if (avgScore > 80) {
      modifier *= 1.05; // 5% boost for returning users (was 10%)
    }
  }

  return modifier;
}

// =============================================================================
// TOLERANCE ADJUSTMENT
// =============================================================================

/**
 * Apply adjustments based on tolerance scores
 */
export function applyToleranceAdjustment(
  media: Media,
  metrics: BehavioralMetrics
): number {
  let adjustment = 1.0;
  const year = media.startDate?.year || new Date().getFullYear();
  const episodes = media.episodes || 12;

  // OLD ANIME TOLERANCE (toned down boosts)
  if (year < 2010) {
    if (metrics.toleranceForOld < 0.3) {
      // Strong penalty for old anime if low tolerance
      adjustment *= 0.55 + (metrics.toleranceForOld * 0.5);
    } else if (metrics.toleranceForOld > 0.7) {
      // Slight boost for users who enjoy classics (was 10%)
      adjustment *= 1.05;
    }
  } else if (year < 2015) {
    if (metrics.toleranceForOld < 0.5) {
      adjustment *= 0.88;
    }
  }

  // LONG SERIES TOLERANCE (toned down boosts)
  if (episodes >= 50) {
    if (metrics.toleranceForLong < 0.3) {
      adjustment *= 0.45 + (metrics.toleranceForLong * 0.55);
    } else if (metrics.toleranceForLong > 0.7) {
      adjustment *= 1.08; // 8% boost (was 15%)
    }
  } else if (episodes >= 24) {
    if (metrics.toleranceForLong < 0.5) {
      adjustment *= 0.88;
    }
  }

  // SLOW PACE TOLERANCE (toned down boosts)
  const mediaTags = (media.tags || []).map(t => t.name);
  const slowPaceTags = ['Slow Paced', 'Slice of Life', 'Iyashikei', 'Atmospheric'];
  const isSlowPaced = slowPaceTags.some(tag => mediaTags.includes(tag));

  if (isSlowPaced) {
    if (metrics.toleranceForSlowPace < 0.4) {
      adjustment *= 0.65 + (metrics.toleranceForSlowPace * 0.45);
    } else if (metrics.toleranceForSlowPace > 0.7) {
      adjustment *= 1.06; // 6% boost (was 12%)
    }
  }

  return adjustment;
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

/**
 * Calculate confidence score (0-100) for a recommendation
 */
function calculateConfidence(
  profile: DreamProfile,
  features: Features,
  vetoMultiplier: number
): number {
  let confidence = 50; // Base confidence

  // Profile confidence contribution (up to 20 points)
  confidence += profile.confidenceLevel * 20;

  // Feature agreement contribution (up to 20 points)
  // High CF + high content = strong agreement
  const featureAgreement = (features.cf + features.content) / 2;
  confidence += featureAgreement * 20;

  // Positive feedback signal (up to 10 points)
  if (features.feedback > 0.5) {
    confidence += 10;
  }

  // Veto penalty reduces confidence
  if (vetoMultiplier < 1.0) {
    confidence *= vetoMultiplier;
  }

  // Low negative signal is good
  if (features.negativeSignal < 0.1) {
    confidence += 5;
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

// =============================================================================
// DREAM REASON GENERATION
// =============================================================================

/**
 * Generate Dream-specific recommendation reasons
 */
export function generateDreamReasons(
  candidate: Candidate,
  profile: DreamProfile,
  breakdown: DreamScoreBreakdown
): string[] {
  const reasons: string[] = [];
  const metrics = profile.metrics;
  const media = candidate.media;

  // Cluster matching reason
  const mediaTags = [
    ...(media.tags || []).map(t => t.name),
    ...(media.genres || [])
  ];
  const matchingClusters = findMatchingClusters(mediaTags, profile);

  if (matchingClusters.length > 0) {
    const topCluster = matchingClusters.sort((a, b) => b.userAffinity - a.userAffinity)[0];
    if (topCluster.userAffinity > 0.5) {
      reasons.push(`Matches your "${topCluster.name}" preferences`);
    }
  }

  // Binge velocity reason
  const episodes = media.episodes || 12;
  if (metrics.bingeVelocity > 2.5 && episodes <= 13) {
    reasons.push('Perfect binge length for your viewing speed');
  } else if (metrics.bingeVelocity > 4 && episodes >= 24) {
    reasons.push('Great for a power-watching session');
  }

  // Completionist reason
  if (metrics.completionistScore > 0.8 && episodes <= 24) {
    reasons.push('You typically finish similar shows');
  }

  // Studio whitelist reason
  const studioNames = (media.studios?.nodes || []).map(s => s.name);
  const whitelistedStudio = profile.rules.whitelistedStudios.find(s => studioNames.includes(s));
  if (whitelistedStudio) {
    reasons.push(`From ${whitelistedStudio}, a studio you enjoy`);
  }

  // Genre whitelist reason
  const whitelistedGenre = profile.rules.whitelistedGenres.find(g => media.genres?.includes(g));
  if (whitelistedGenre) {
    reasons.push(`Features ${whitelistedGenre}, one of your favorites`);
  }

  // High confidence reason
  if (breakdown.confidence > 80) {
    reasons.push('High confidence match for your taste');
  }

  // Tolerance-based reasons
  const year = media.startDate?.year || new Date().getFullYear();
  if (year < 2010 && metrics.toleranceForOld > 0.7) {
    reasons.push('A classic that suits your appreciation for older anime');
  }

  if (episodes >= 50 && metrics.toleranceForLong > 0.7) {
    reasons.push('An epic series for your marathon-watching style');
  }

  return reasons;
}

// =============================================================================
// SCORE EXPLANATION
// =============================================================================

/**
 * Generate detailed explanation of score breakdown
 */
export function explainDreamScore(breakdown: DreamScoreBreakdown): string {
  const parts: string[] = [];

  parts.push(`Base Score: ${(breakdown.baseScore * 100).toFixed(1)}%`);

  if (breakdown.vetoMultiplier !== 1.0) {
    if (breakdown.vetoMultiplier < 1.0) {
      parts.push(`Veto Penalty: ${((1 - breakdown.vetoMultiplier) * 100).toFixed(0)}%`);
    } else {
      parts.push(`Whitelist Boost: +${((breakdown.vetoMultiplier - 1) * 100).toFixed(0)}%`);
    }
  }

  if (breakdown.clusterBoost !== 1.0) {
    const change = ((breakdown.clusterBoost - 1) * 100).toFixed(0);
    parts.push(`Cluster Affinity: ${breakdown.clusterBoost > 1 ? '+' : ''}${change}%`);
  }

  if (breakdown.behavioralModifier !== 1.0) {
    const change = ((breakdown.behavioralModifier - 1) * 100).toFixed(0);
    parts.push(`Behavioral Fit: ${breakdown.behavioralModifier > 1 ? '+' : ''}${change}%`);
  }

  if (breakdown.toleranceAdjustment !== 1.0) {
    const change = ((breakdown.toleranceAdjustment - 1) * 100).toFixed(0);
    parts.push(`Tolerance Match: ${breakdown.toleranceAdjustment > 1 ? '+' : ''}${change}%`);
  }

  parts.push(`Final Dream Score: ${(breakdown.dreamScore * 100).toFixed(1)}%`);
  parts.push(`Confidence: ${breakdown.confidence}%`);

  return parts.join(' | ');
}
