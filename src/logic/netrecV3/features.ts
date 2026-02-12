/**
 * AnimeNetRec V3 - Feature Engineering
 * 
 * Extract and compute all features for scoring
 */

import type { Media, MediaListEntry, Features, UserProfile, Tag } from "./types";

// ============================================================================
// CONTENT FEATURES
// ============================================================================

/**
 * Calculate genre overlap (Jaccard similarity)
 */
export function genreOverlap(media: Media, userGenres: string[]): number {
  if (!media.genres || media.genres.length === 0) return 0;
  if (userGenres.length === 0) return 0;

  const mediaSet = new Set(media.genres);
  const userSet = new Set(userGenres);
  
  const intersection = new Set([...mediaSet].filter((x) => userSet.has(x)));
  const union = new Set([...mediaSet, ...userSet]);

  return intersection.size / union.size;
}

/**
 * Calculate tag overlap with rank weighting
 */
export function tagOverlap(media: Media, userTags: Set<string>): number {
  if (!media.tags || media.tags.length === 0) return 0;
  if (userTags.size === 0) return 0;

  // Filter non-spoiler tags
  const safeTags = media.tags.filter(
    (t) => !t.isMediaSpoiler && !t.isGeneralSpoiler && !t.isAdult
  );

  if (safeTags.length === 0) return 0;

  // Weighted by rank
  let totalWeight = 0;
  let matchWeight = 0;

  for (const tag of safeTags) {
    const weight = tag.rank || 50;
    totalWeight += weight;
    if (userTags.has(tag.name)) {
      matchWeight += weight;
    }
  }

  return totalWeight > 0 ? matchWeight / totalWeight : 0;
}

/**
 * Check studio match
 */
export function studioMatch(media: Media, userStudios: Set<string>): boolean {
  if (!media.studios?.nodes || media.studios.nodes.length === 0) return false;
  if (userStudios.size === 0) return false;

  for (const studio of media.studios.nodes) {
    if (userStudios.has(studio.name)) return true;
  }

  return false;
}

/**
 * Format match
 */
export function formatMatch(media: Media, userFormats: Set<string>): boolean {
  if (!media.format) return false;
  return userFormats.has(media.format);
}

/**
 * Source match
 */
export function sourceMatch(media: Media, userSources: Set<string>): boolean {
  if (!media.source) return false;
  return userSources.has(media.source);
}

// ============================================================================
// TEMPORAL FEATURES
// ============================================================================

/**
 * Calculate days since release
 */
export function daysSinceRelease(media: Media): number {
  if (!media.startDate?.year) return 9999;

  const now = new Date();
  const release = new Date(
    media.startDate.year,
    (media.startDate.month || 1) - 1,
    media.startDate.day || 1
  );

  const diff = now.getTime() - release.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Freshness score (boost recent releases)
 */
export function freshnessScore(media: Media): number {
  const days = daysSinceRelease(media);
  
  // Fresh if released in last 365 days
  if (days <= 365) {
    return 1.0 - (days / 365) * 0.5; // 1.0 -> 0.5
  }
  
  return 0;
}

/**
 * Time decay (exponential)
 */
export function timeDecay(daysSince: number, lambda: number = 0.0001): number {
  return Math.exp(-lambda * daysSince);
}

// ============================================================================
// RELATION FEATURES
// ============================================================================

/**
 * Calculate relation boost
 */
export function relationBoost(
  media: Media,
  watchedIds: Set<number>
): { boost: number; relationType?: string } {
  if (!media.relations?.edges || media.relations.edges.length === 0) {
    return { boost: 0 };
  }

  let maxBoost = 0;
  let bestRelationType: string | undefined;

  for (const edge of media.relations.edges) {
    if (!edge.node || !edge.relationType) continue;
    if (!watchedIds.has(edge.node.id)) continue;

    let boost = 0;
    switch (edge.relationType) {
      case "SEQUEL":
        boost = 0.4;
        break;
      case "PREQUEL":
        boost = 0.3;
        break;
      case "SPIN_OFF":
      case "SIDE_STORY":
        boost = 0.15;
        break;
      case "ALTERNATIVE":
        boost = 0.1;
        break;
      default:
        boost = 0;
    }

    if (boost > maxBoost) {
      maxBoost = boost;
      bestRelationType = edge.relationType;
    }
  }

  return { boost: maxBoost, relationType: bestRelationType };
}

// ============================================================================
// STATUS FEATURES
// ============================================================================

/**
 * Status multiplier
 */
export function statusMultiplier(
  media: Media,
  entries: MediaListEntry[]
): number {
  const entry = entries.find((e) => e.media.id === media.id);
  if (!entry) return 1.0; // Not in list = neutral

  switch (entry.status) {
    case "COMPLETED":
      return 0; // Exclude
    case "DROPPED":
      return 0.5; // Heavy penalty
    case "PAUSED":
      return 1.2; // Slight boost
    case "PLANNING":
      return 1.2; // Slight boost
    case "REPEATING":
      return 1.3; // Rewatch potential
    case "CURRENT":
      return 0; // Exclude (already watching)
    default:
      return 1.0;
  }
}

// ============================================================================
// BINGEABILITY
// ============================================================================

/**
 * Calculate bingeability score
 */
export function bingeabilityScore(media: Media): number {
  const episodes = media.episodes || 0;
  const duration = media.duration || 24; // Default 24min

  // Total watch time in minutes
  const totalMinutes = episodes * duration;

  // Optimal binge range: 4-12 hours (240-720 minutes)
  if (totalMinutes >= 240 && totalMinutes <= 720) {
    return 1.0;
  }

  // Too short (<2 hours)
  if (totalMinutes < 120) {
    return 0.5;
  }

  // Too long (>24 hours)
  if (totalMinutes > 1440) {
    return 0.3;
  }

  // Middle ground
  return 0.7;
}

// ============================================================================
// USER PROFILE EXTRACTION
// ============================================================================

/**
 * Extract user preferences from watch history
 */
export function extractUserPreferences(entries: MediaListEntry[]): {
  genres: string[];
  tags: Set<string>;
  studios: Set<string>;
  formats: Set<string>;
  sources: Set<string>;
  avgScore: number;
} {
  const genreCount = new Map<string, number>();
  const tags = new Set<string>();
  const studios = new Set<string>();
  const formats = new Set<string>();
  const sources = new Set<string>();
  let totalScore = 0;
  let scoreCount = 0;

  for (const entry of entries) {
    // Skip low-scored or dropped
    if (entry.status === "DROPPED") continue;
    if (entry.score && entry.score < 5) continue;

    const media = entry.media;

    // Genres (weighted by score)
    if (media.genres) {
      const weight = entry.score || 7; // Default 7
      for (const genre of media.genres) {
        genreCount.set(genre, (genreCount.get(genre) || 0) + weight);
      }
    }

    // Tags (non-spoiler, high rank)
    if (media.tags) {
      for (const tag of media.tags) {
        if (!tag.isMediaSpoiler && !tag.isGeneralSpoiler && (tag.rank || 0) >= 60) {
          tags.add(tag.name);
        }
      }
    }

    // Studios (main only)
    if (media.studios?.nodes) {
      for (const studio of media.studios.nodes) {
        if (studio.isAnimationStudio) {
          studios.add(studio.name);
        }
      }
    }

    // Format
    if (media.format) {
      formats.add(media.format);
    }

    // Source
    if (media.source) {
      sources.add(media.source);
    }

    // Score
    if (entry.score) {
      totalScore += entry.score;
      scoreCount++;
    }
  }

  // Sort genres by count
  const sortedGenres = Array.from(genreCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0]);

  return {
    genres: sortedGenres,
    tags,
    studios,
    formats,
    sources,
    avgScore: scoreCount > 0 ? totalScore / scoreCount : 7,
  };
}

// ============================================================================
// FEATURE BUILDER
// ============================================================================

/**
 * Build complete feature set for a media
 */
export function buildFeatures(
  media: Media,
  profile: UserProfile
): Features {
  const prefs = extractUserPreferences(profile.entries);
  const watchedIds = new Set(profile.entries.map((e) => e.media.id));
  const entry = profile.entries.find((e) => e.media.id === media.id);

  const genreOvlp = genreOverlap(media, prefs.genres);
  const tagOvlp = tagOverlap(media, prefs.tags);
  const studioMtch = studioMatch(media, prefs.studios);
  const formatMtch = formatMatch(media, prefs.formats);
  const sourceMtch = sourceMatch(media, prefs.sources);

  const days = daysSinceRelease(media);
  const fresh = freshnessScore(media);

  const relation = relationBoost(media, watchedIds);
  const statusMult = statusMultiplier(media, profile.entries);
  const binge = bingeabilityScore(media);

  // Phase 2: Feedback Features
  const feedbacks = profile.feedbacks;
  const interactions = profile.interactions;

  let positiveSim = 0;
  let negativeSim = 0;

  if (feedbacks) {
    const likedAnime = extractLikedAnime(feedbacks.likes, profile.entries);
    const dislikedAnime = extractDislikedAnime(feedbacks.dislikes, profile.entries);

    positiveSim = calculatePositiveSimilarity(media, likedAnime);
    negativeSim = calculateNegativeSimilarity(media, dislikedAnime);
  }

  return {
    // Content
    genreOverlap: genreOvlp,
    tagOverlap: tagOvlp,
    studioMatch: studioMtch,
    formatMatch: formatMtch,
    sourceMatch: sourceMtch,

    // Collaborative (computed elsewhere)
    cfScore: 0,
    cfRating: 0,

    // Temporal
    daysSinceRelease: days,
    isFresh: days <= 365,

    // Relations
    hasSequel: relation.relationType === "SEQUEL",
    hasPrequel: relation.relationType === "PREQUEL",
    relationType: relation.relationType as any,

    // User Context
    isInPTW: entry?.status === "PLANNING",
    isDropped: entry?.status === "DROPPED",
    isPaused: entry?.status === "PAUSED",
    userScore: entry?.score,

    // Bingeability
    episodeCount: media.episodes || 0,
    avgDuration: media.duration || 24,
    bingeScore: binge,

    // Feedback Features (Phase 2)
    isLiked: feedbacks?.likes.has(media.id) || false,
    isDisliked: feedbacks?.dislikes.has(media.id) || false,
    wasClicked: interactions?.clicks.has(media.id) || false,
    wasViewed: interactions?.views.has(media.id) || false,
    impressionCount: interactions?.impressions.get(media.id) || 0,

    // Negative Signals
    negativeSimilarity: negativeSim,
    positiveSimilarity: positiveSim,
  };
}

// ============================================================================
// TF-IDF (for Content-Based)
// ============================================================================

/**
 * Build TF-IDF vector for media
 */
export function buildTFIDFVector(media: Media): Map<string, number> {
  const vector = new Map<string, number>();

  // Genres
  if (media.genres) {
    for (const genre of media.genres) {
      vector.set(`genre:${genre}`, 1.0);
    }
  }

  // Tags (weighted by rank)
  if (media.tags) {
    for (const tag of media.tags) {
      if (!tag.isMediaSpoiler && !tag.isGeneralSpoiler) {
        const weight = (tag.rank || 50) / 100;
        vector.set(`tag:${tag.name}`, weight);
      }
    }
  }

  // Studios
  if (media.studios?.nodes) {
    for (const studio of media.studios.nodes) {
      vector.set(`studio:${studio.name}`, 1.0);
    }
  }

  // Format
  if (media.format) {
    vector.set(`format:${media.format}`, 0.5);
  }

  // Source
  if (media.source) {
    vector.set(`source:${media.source}`, 0.3);
  }

  return vector;
}

/**
 * Cosine similarity between two TF-IDF vectors
 */
export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Dot product and norm A
  for (const [key, valueA] of vecA) {
    normA += valueA * valueA;
    const valueB = vecB.get(key) || 0;
    dotProduct += valueA * valueB;
  }

  // Norm B
  for (const valueB of vecB.values()) {
    normB += valueB * valueB;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// FEEDBACK FEATURES (Phase 2)
// ============================================================================

/**
 * Calculate similarity to liked anime (positive signal)
 */
export function calculatePositiveSimilarity(
  media: Media,
  likedAnime: Media[]
): number {
  if (likedAnime.length === 0) return 0;

  const mediaVec = buildTFIDFVector(media);
  let maxSimilarity = 0;

  for (const liked of likedAnime) {
    const likedVec = buildTFIDFVector(liked);
    const similarity = cosineSimilarity(mediaVec, likedVec);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

/**
 * Calculate similarity to disliked anime (negative signal)
 */
export function calculateNegativeSimilarity(
  media: Media,
  dislikedAnime: Media[]
): number {
  if (dislikedAnime.length === 0) return 0;

  const mediaVec = buildTFIDFVector(media);
  let maxSimilarity = 0;

  for (const disliked of dislikedAnime) {
    const dislikedVec = buildTFIDFVector(disliked);
    const similarity = cosineSimilarity(mediaVec, dislikedVec);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

/**
 * Extract liked anime from user profile
 */
export function extractLikedAnime(
  likedIds: Set<number>,
  entries: MediaListEntry[]
): Media[] {
  return entries
    .filter((e) => likedIds.has(e.media.id))
    .map((e) => e.media);
}

/**
 * Extract disliked anime from user profile
 */
export function extractDislikedAnime(
  dislikedIds: Set<number>,
  entries: MediaListEntry[]
): Media[] {
  return entries
    .filter((e) => dislikedIds.has(e.media.id))
    .map((e) => e.media);
}