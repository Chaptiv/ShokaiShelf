/**
 * NetRecDream V4 - Dream Engine Orchestrator
 *
 * Extends AnimeNetRecV3 with adaptive learning, semantic clustering,
 * and behavioral modifiers for personalized recommendations.
 */

import {
  DreamProfile,
  DreamScoreBreakdown,
  FeedbackEvent,
  Prediction,
  DREAM_VERSION
} from './dream-types';
import { loadDreamProfile, saveDreamProfile, initializeDreamProfile } from './profile-manager';
import { calculateDreamScore, generateDreamReasons, explainDreamScore } from './dream-scoring';
import { getClusterScoreModifier, updateClusterAffinity } from './semantic-clustering';
import { updateDreamProfile } from './profile-manager';

// Import V3 types and utilities
import type {
  UserProfile,
  Candidate,
  ScoredCandidate,
  RecommendationResult,
  EngineConfig,
  Media,
  Features
} from '../netrecV3/types';

import { DEFAULT_CONFIG } from '../netrecV3/types';
import { AnimeNetRecV3, createEngine as createV3Engine } from '../netrecV3/engine';
import { buildFeatures, extractUserPreferences, buildTFIDFVector, cosineSimilarity } from '../netrecV3/features';
import { applyFilters } from '../netrecV3/filters';
import { mmrReRank, adaptiveLambda, calculateDiversityScore } from '../netrecV3/mmr';
import { generateReasons, calculateConfidence } from '../netrecV3/explain';

// =============================================================================
// DREAM ENGINE CLASS
// =============================================================================

export class AnimeNetRecDream extends AnimeNetRecV3 {
  private dreamProfile: DreamProfile | null = null;
  private lastPredictions: Map<number, Prediction> = new Map();

  constructor(config?: Partial<EngineConfig>) {
    super(config);
    console.log(`[NetRecDream] Dream Engine V${DREAM_VERSION.major}.${DREAM_VERSION.minor} initialized`);
  }

  /**
   * Main Dream recommendation method
   */
  async recommend(
    userName: string,
    topK: number = 12
  ): Promise<DreamRecommendationResult[]> {
    console.log(`[NetRecDream] Starting Dream recommendation for ${userName}`);

    // 1. Load/Initialize DreamProfile
    await this.loadOrInitializeDreamProfile(userName);

    // 2. Run V3 base recommendation pipeline
    const v3Profile = await this.loadUserProfile(userName);
    console.log(`[NetRecDream] Loaded ${v3Profile.entries.length} entries`);

    // 3. Generate candidates
    const candidates = await this.generateCandidates(v3Profile);
    console.log(`[NetRecDream] Generated ${candidates.length} candidates`);

    // 4. Filter candidates
    const filtered = applyFilters(
      candidates,
      v3Profile.entries,
      v3Profile.preferences
    );
    console.log(`[NetRecDream] After filtering: ${filtered.length}`);

    // 5. Score with Dream scoring
    const scored = this.scoreCandidatesWithDream(filtered, v3Profile);
    console.log(`[NetRecDream] Scored ${scored.length} candidates`);

    // 6. Sort by dream score
    scored.sort((a, b) => b.scores.final - a.scores.final);

    // 7. MMR Re-ranking
    const mode = v3Profile.preferences?.mode || 'balanced';
    const lambda = adaptiveLambda(
      extractUserPreferences(v3Profile.entries).genres,
      mode
    );
    const reranked = mmrReRank(scored, lambda, topK * 2);
    console.log(`[NetRecDream] Re-ranked to ${reranked.length} results`);

    // 8. Create Dream results
    const results = this.createDreamResults(reranked.slice(0, topK), v3Profile);

    // 9. Log diversity and confidence
    const diversityScore = calculateDiversityScore(reranked);
    const avgConfidence = results.reduce((sum, r) => sum + r.dreamConfidence, 0) / results.length;
    console.log(`[NetRecDream] Diversity: ${diversityScore.toFixed(3)}, Avg Confidence: ${avgConfidence.toFixed(0)}%`);

    return results;
  }

  /**
   * Load or initialize Dream profile
   */
  private async loadOrInitializeDreamProfile(userName: string): Promise<void> {
    this.dreamProfile = await loadDreamProfile(userName);

    if (!this.dreamProfile) {
      console.log(`[NetRecDream] No Dream profile found, initializing...`);

      // Get V3 entries for initialization
      const v3Profile = await this.loadUserProfile(userName);

      // Load existing feedback
      const { exportFeedbackForEngine } = await import('../feedback-store');
      const existingFeedback = await exportFeedbackForEngine();

      // Initialize new Dream profile
      this.dreamProfile = await initializeDreamProfile(
        userName,
        v3Profile.entries,
        existingFeedback
      );

      console.log(`[NetRecDream] Dream profile initialized with confidence: ${this.dreamProfile.confidenceLevel.toFixed(2)}`);
    } else {
      console.log(`[NetRecDream] Loaded Dream profile (v${this.dreamProfile.version}, confidence: ${this.dreamProfile.confidenceLevel.toFixed(2)})`);
    }
  }

  /**
   * Score candidates using Dream scoring system
   */
  private scoreCandidatesWithDream(
    candidates: Candidate[],
    profile: UserProfile
  ): DreamScoredCandidate[] {
    if (!this.dreamProfile) {
      // Fallback to V3 scoring
      console.warn('[NetRecDream] No Dream profile, using V3 scoring');
      return this.scoreCandidates(candidates, profile) as DreamScoredCandidate[];
    }

    return candidates.map(candidate => {
      // Build V3 features
      const rawFeatures = buildFeatures(candidate.media, profile);

      // Compute aggregate scores like V3's scoreCandidate does
      const cfScore = candidate.sources.includes("cf") ? 1.0 : 0;

      let contentScore =
        rawFeatures.genreOverlap * 0.5 +
        rawFeatures.tagOverlap * 0.3 +
        (rawFeatures.studioMatch ? 0.1 : 0) +
        (rawFeatures.formatMatch ? 0.05 : 0) +
        (rawFeatures.sourceMatch ? 0.05 : 0);

      const freshnessScore = rawFeatures.isFresh ? 1.0 : 0.3;

      let relationScore = rawFeatures.relationType ? 0.4 : 0;
      if (candidate.sources.includes("relations")) {
        relationScore = 1.0;
      }

      const feedbackScore = rawFeatures.positiveSimilarity * 0.3;
      const negativeSignal = rawFeatures.negativeSimilarity * 0.4;
      const interactionScore = (rawFeatures.wasClicked ? 0.15 : 0) + (rawFeatures.wasViewed ? 0.2 : 0);

      // Create the aggregated features object for Dream scoring
      const aggregatedFeatures = {
        cf: cfScore,
        content: contentScore,
        freshness: freshnessScore,
        relations: relationScore,
        feedback: feedbackScore,
        negativeSignal: negativeSignal,
        interaction: interactionScore,
        // Also pass raw features
        genreOverlap: rawFeatures.genreOverlap,
        tagOverlap: rawFeatures.tagOverlap,
        studioMatch: rawFeatures.studioMatch ? 1 : 0,
        formatMatch: rawFeatures.formatMatch ? 1 : 0,
        sourceMatch: rawFeatures.sourceMatch ? 1 : 0,
        sequelPotential: rawFeatures.hasSequel ? 1 : 0
      };

      // Calculate Dream score breakdown
      const dreamBreakdown = calculateDreamScore(
        candidate,
        this.dreamProfile!,
        aggregatedFeatures
      );

      // Store prediction for learning
      const prediction: Prediction = {
        mediaId: candidate.media.id,
        predictedScore: dreamBreakdown.dreamScore,
        scoreBreakdown: dreamBreakdown
      };
      this.lastPredictions.set(candidate.media.id, prediction);

      // Build scored candidate - use dreamScore for both meta and final so MMR works correctly
      const scoredCandidate: DreamScoredCandidate = {
        ...candidate,
        scores: {
          cf: dreamBreakdown.cf,
          content: dreamBreakdown.content,
          freshness: dreamBreakdown.freshness,
          relationBoost: dreamBreakdown.relations,
          statusMult: 1.0,
          timeDecay: 1.0,
          binge: 0,
          meta: dreamBreakdown.dreamScore, // Use dreamScore for meta so MMR uses it correctly
          mmr: 0,
          final: dreamBreakdown.dreamScore
        },
        features: rawFeatures,
        reasons: [],
        dreamBreakdown
      };

      // Generate reasons
      scoredCandidate.reasons = [
        ...generateReasons(scoredCandidate, profile.entries),
        ...generateDreamReasons(candidate, this.dreamProfile!, dreamBreakdown)
      ];

      // Deduplicate reasons
      scoredCandidate.reasons = [...new Set(scoredCandidate.reasons)];

      return scoredCandidate;
    });
  }

  /**
   * Create Dream recommendation results
   */
  private createDreamResults(
    scored: DreamScoredCandidate[],
    profile: UserProfile
  ): DreamRecommendationResult[] {
    return scored.map(candidate => {
      const dreamBreakdown = candidate.dreamBreakdown;

      return {
        media: candidate.media,
        score: candidate.scores.final,
        reasons: candidate.reasons,
        confidence: calculateConfidence(candidate),
        sources: candidate.sources,

        // Dream-specific fields
        dreamScore: dreamBreakdown?.dreamScore || candidate.scores.final,
        dreamConfidence: dreamBreakdown?.confidence || 50,
        dreamBreakdown: dreamBreakdown || null,
        explanation: dreamBreakdown ? explainDreamScore(dreamBreakdown) : null
      };
    });
  }

  /**
   * Process feedback for learning
   */
  async processFeedback(
    mediaId: number,
    feedbackType: 'like' | 'dislike' | null,
    reasons?: string[],
    mediaData?: {
      title?: string;
      genres?: string[];
      tags?: string[];
      studios?: string[];
      year?: number;
      episodes?: number;
    }
  ): Promise<void> {
    if (!this.dreamProfile || !feedbackType) return;

    console.log(`[NetRecDream] Processing feedback: ${feedbackType} for media ${mediaId}`);

    // Get prediction if available
    let prediction = this.lastPredictions.get(mediaId);

    // IMPROVEMENT: If no prediction in RAM (e.g., after app restart), generate one on-the-fly
    // This allows the engine to learn even for feedback given on anime recommended in a previous session
    if (!prediction && mediaData) {
      console.log(`[NetRecDream] No cached prediction, generating on-the-fly...`);

      // Build a minimal media object from the provided data
      const reconstructedMedia = {
        id: mediaId,
        title: { english: mediaData.title, romaji: mediaData.title },
        genres: mediaData.genres,
        tags: mediaData.tags?.map(t => ({ name: t, rank: 50 })),
        studios: mediaData.studios ? { nodes: mediaData.studios.map(s => ({ name: s })) } : undefined,
        startDate: mediaData.year ? { year: mediaData.year } : undefined,
        episodes: mediaData.episodes
      };

      const candidate = { media: reconstructedMedia as any, sources: ['feedback_replay'] };

      // Calculate what the engine "would have" predicted
      const aggregatedFeatures = {
        cf: 0.5, // Neutral since we don't know original source
        content: 0.5,
        freshness: 0.5,
        relations: 0,
        feedback: 0,
        negativeSignal: 0,
        interaction: 0,
        genreOverlap: 0.5,
        tagOverlap: 0.5,
        studioMatch: 0,
        formatMatch: 0,
        sourceMatch: 0,
        sequelPotential: 0
      };

      const breakdown = calculateDreamScore(candidate, this.dreamProfile, aggregatedFeatures);
      prediction = {
        mediaId,
        predictedScore: breakdown.dreamScore,
        scoreBreakdown: breakdown
      };
    }

    // Create feedback event
    const event: FeedbackEvent = {
      mediaId,
      type: feedbackType,
      reasons: reasons as any, // GranularReason[]
      timestamp: Date.now(),
      prediction,
      mediaData
    };

    // Update Dream profile
    this.dreamProfile = await updateDreamProfile(this.dreamProfile, event);

    // Update cluster affinity
    await updateClusterAffinity(this.dreamProfile, mediaId, feedbackType);

    // IMPROVEMENT: Automatic cluster retraining every 50 feedbacks
    // This keeps the clusters fresh as the user's taste evolves
    const totalFeedback = this.dreamProfile.learning.events.filter(e => e.type === 'feedback_received').length;
    if (totalFeedback > 0 && totalFeedback % 50 === 0) {
      console.log(`[NetRecDream] Triggering periodic cluster retraining (${totalFeedback} feedbacks)...`);
      // Fire & forget - don't block UI
      this.retrainClusters().catch(err => console.error('[NetRecDream] Cluster retraining failed:', err));
    }

    console.log(`[NetRecDream] Profile updated, confidence: ${this.dreamProfile.confidenceLevel.toFixed(2)}`);
  }

  /**
   * Get current Dream profile
   */
  getDreamProfile(): DreamProfile | null {
    return this.dreamProfile;
  }

  /**
   * Get profile insights for display
   */
  getProfileInsights(): ProfileInsights | null {
    if (!this.dreamProfile) return null;

    const profile = this.dreamProfile;

    // Import getBingeProfile from implicit-signals
    let bingeProfileName = 'Unknown';
    try {
      const { getBingeProfile } = require('./implicit-signals');
      bingeProfileName = getBingeProfile(profile.metrics.bingeVelocity);
    } catch {
      // Fallback
    }

    // Calculate weight changes
    let weightInsights: string[] = [];
    try {
      const { analyzeWeightChanges, generateWeightInsights } = require('./weight-adapter');
      const analysis = analyzeWeightChanges(profile.weights);
      weightInsights = generateWeightInsights(analysis);
    } catch {
      // Fallback
    }

    return {
      bingeProfile: bingeProfileName,
      bingeVelocity: profile.metrics.bingeVelocity,
      completionRate: Math.round(profile.metrics.completionistScore * 100),
      dropRate: Math.round(profile.metrics.dropRate * 100),
      clusterCount: profile.clusters.clusters.length,
      topClusters: profile.clusters.clusters
        .filter(c => c.userAffinity > 0.3)
        .sort((a, b) => b.userAffinity - a.userAffinity)
        .slice(0, 3)
        .map(c => c.name),
      avoidedClusters: profile.clusters.clusters
        .filter(c => c.userAffinity < -0.3)
        .sort((a, b) => a.userAffinity - b.userAffinity)
        .slice(0, 3)
        .map(c => c.name),
      tolerances: {
        oldAnime: profile.metrics.toleranceForOld,
        longSeries: profile.metrics.toleranceForLong,
        slowPace: profile.metrics.toleranceForSlowPace
      },
      confidenceLevel: profile.confidenceLevel,
      totalFeedback: profile.learning.events.filter(e => e.type === 'feedback_received').length,
      weightInsights,
      blacklistedTags: profile.rules.blacklistedTags,
      whitelistedGenres: profile.rules.whitelistedGenres,
      preferredStudios: profile.rules.whitelistedStudios
    };
  }

  /**
   * Force cluster retraining
   */
  async retrainClusters(): Promise<void> {
    if (!this.dreamProfile) return;

    console.log(`[NetRecDream] Force retraining clusters...`);

    const { discoverClusters } = await import('./semantic-clustering');
    const newClusters = await discoverClusters(this.dreamProfile);

    if (newClusters.clusters.length > 0) {
      this.dreamProfile.clusters = newClusters;
      await saveDreamProfile(this.dreamProfile);
      console.log(`[NetRecDream] Retrained ${newClusters.clusters.length} clusters`);
    }
  }

  /**
   * Reset Dream profile to defaults
   */
  async resetProfile(userId: string): Promise<void> {
    const { resetDreamProfile } = await import('./profile-manager');
    this.dreamProfile = await resetDreamProfile(userId);
    console.log(`[NetRecDream] Profile reset for ${userId}`);
  }
}

// =============================================================================
// EXTENDED TYPES
// =============================================================================

export interface DreamScoredCandidate extends ScoredCandidate {
  dreamBreakdown?: DreamScoreBreakdown;
}

export interface DreamRecommendationResult extends RecommendationResult {
  dreamScore: number;
  dreamConfidence: number;
  dreamBreakdown: DreamScoreBreakdown | null;
  explanation: string | null;
}

export interface ProfileInsights {
  bingeProfile: string;
  bingeVelocity: number;
  completionRate: number;
  dropRate: number;
  clusterCount: number;
  topClusters: string[];
  avoidedClusters: string[];
  tolerances: {
    oldAnime: number;
    longSeries: number;
    slowPace: number;
  };
  confidenceLevel: number;
  totalFeedback: number;
  weightInsights: string[];
  blacklistedTags: string[];
  whitelistedGenres: string[];
  preferredStudios: string[];
}

// =============================================================================
// FACTORY
// =============================================================================

let dreamEngineInstance: AnimeNetRecDream | null = null;

/**
 * Create or get Dream engine instance
 */
export function createDreamEngine(config?: Partial<EngineConfig>): AnimeNetRecDream {
  if (!dreamEngineInstance) {
    dreamEngineInstance = new AnimeNetRecDream(config);
  }
  return dreamEngineInstance;
}

/**
 * Get existing Dream engine instance
 */
export function getDreamEngine(): AnimeNetRecDream | null {
  return dreamEngineInstance;
}

/**
 * Reset Dream engine instance
 */
export function resetDreamEngine(): void {
  dreamEngineInstance = null;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if Dream engine should be used for a user
 */
export async function shouldUseDreamEngine(userId: string): Promise<boolean> {
  const profile = await loadDreamProfile(userId);

  // Use Dream engine if:
  // 1. User has a Dream profile with some confidence
  // 2. User has enough feedback data

  if (profile && profile.confidenceLevel >= 0.3) {
    return true;
  }

  // Check if user has enough feedback for meaningful learning
  try {
    const { getFeedbackStats } = await import('../feedback-store');
    const stats = await getFeedbackStats();
    return stats.totalLikes + stats.totalDislikes >= 10;
  } catch {
    return false;
  }
}

/**
 * Get recommendation using the best engine for the user
 */
export async function getSmartRecommendations(
  userId: string,
  topK: number = 12
): Promise<RecommendationResult[]> {
  const useDream = await shouldUseDreamEngine(userId);

  if (useDream) {
    const engine = createDreamEngine();
    return engine.recommend(userId, topK);
  } else {
    const engine = createV3Engine();
    return engine.recommend(userId, topK);
  }
}

// =============================================================================
// PRIVATE HELPER: Load user profile (exposed from parent class)
// =============================================================================

// Override to expose loadUserProfile
AnimeNetRecDream.prototype['loadUserProfile'] = async function(userName: string) {
  // Re-implement to have access in Dream engine
  const { fetchUserLibrary, fetchUserStats } = await import('../netrecV3/queries');
  const { loadUserFeedbacks, loadUserInteractions } = await import('../netrecV3/feedback');

  const entries = await fetchUserLibrary(userName);
  const stats = await fetchUserStats(userName).catch(() => undefined);
  const feedbacks = await loadUserFeedbacks(userName);
  const interactions = await loadUserInteractions(userName);

  let userPrefs: any = null;
  try {
    const { getPreferences } = await import('../preferences-store');
    userPrefs = await getPreferences();
  } catch {}

  return {
    userId: userName,
    entries,
    stats,
    feedbacks,
    interactions,
    preferences: {
      mode: 'balanced' as const,
      excludeGenres: userPrefs?.dislikedGenres || [],
      excludeTags: [],
      excludeStudios: [],
      neverShow: [],
      showAdult: false,
      favoriteGenres: userPrefs?.favoriteGenres || [],
      selectedAnimeIds: userPrefs?.selectedAnimeIds || []
    }
  };
};

// Override to expose generateCandidates
AnimeNetRecDream.prototype['generateCandidates'] = async function(profile: any) {
  const { fetchTrending, fetchRecommendations } = await import('../netrecV3/queries');

  const candidates: any[] = [];

  // Generate CF candidates (simplified)
  const seeds = profile.entries
    .filter((e: any) => e.status === 'COMPLETED' && (e.score || 0) >= 7)
    .slice(0, 10)
    .map((e: any) => e.media.id);

  if (seeds.length > 0) {
    const recsMap = await fetchRecommendations(seeds);
    for (const [seedId, recs] of recsMap) {
      for (const rec of recs) {
        candidates.push({
          media: rec.media,
          sources: ['cf'],
          seedIds: [seedId]
        });
      }
    }
  }

  // Generate content candidates
  const trending = await fetchTrending(50);
  for (const media of trending) {
    candidates.push({
      media,
      sources: ['trending']
    });
  }

  // Generate relations candidates
  const highScored = profile.entries
    .filter((e: any) => e.status === 'COMPLETED' && (e.score || 0) >= 8)
    .slice(0, 10);

  for (const entry of highScored) {
    const relations = entry.media?.relations?.edges || [];
    for (const edge of relations) {
      if (edge.node && ['SEQUEL', 'PREQUEL', 'SIDE_STORY'].includes(edge.relationType)) {
        candidates.push({
          media: edge.node,
          sources: ['relations'],
          seedIds: [entry.media.id]
        });
      }
    }
  }

  return candidates;
};

// Override to expose scoreCandidates
AnimeNetRecDream.prototype['scoreCandidates'] = function(candidates: any[], profile: any) {
  return candidates.map((candidate: any) => {
    const features = buildFeatures(candidate.media, profile);

    const cfScore = candidate.sources.includes('cf') ? 1.0 : 0;
    const contentScore = (features.genreOverlap || 0) * 0.5 + (features.tagOverlap || 0) * 0.3;
    const freshnessScore = features.isFresh ? 1.0 : 0;
    const relationBoost = candidate.sources.includes('relations') ? 1.0 : 0;

    const metaScore = 0.4 * cfScore + 0.3 * contentScore + 0.08 * freshnessScore + 0.08 * relationBoost;

    return {
      ...candidate,
      scores: {
        cf: cfScore,
        content: contentScore,
        freshness: freshnessScore,
        relationBoost,
        statusMult: 1.0,
        timeDecay: 1.0,
        binge: 0,
        meta: metaScore,
        mmr: 0,
        final: metaScore
      },
      features,
      reasons: generateReasons({ media: candidate.media, scores: { meta: metaScore } } as any, profile.entries)
    };
  });
};
