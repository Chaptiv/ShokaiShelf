/**
 * AnimeNetRec V3 - Main Export
 * 
 * Import this file to use the recommendation engine
 */

// Core Engine
export { AnimeNetRecV3, createEngine } from "./engine";

// Types
export type {
  UserProfile,
  UserPreferences,
  UserFeedbacks,
  UserInteractions,
  UserContext,
  Candidate,
  ScoredCandidate,
  RecommendationResult,
  EngineConfig,
  Features,
  Media,
  MediaListEntry,
  MediaListStatus,
  UserStats,
  TelemetryEvent,
} from "./types";

export { DEFAULT_CONFIG } from "./types";

// Queries
export {
  fetchUserLibrary,
  fetchUserStats,
  fetchRecommendations,
  fetchTrending,
  fetchMediaDetails,
  searchAnime,
} from "./queries";

// Features
export {
  buildFeatures,
  extractUserPreferences,
  buildTFIDFVector,
  cosineSimilarity,
  genreOverlap,
  tagOverlap,
  studioMatch,
  freshnessScore,
  timeDecay,
  relationBoost,
  bingeabilityScore,
} from "./features";

// Filters
export {
  applyFilters,
  filterCompleted,
  filterAdult,
  filterGenres,
  filterTags,
  filterStudios, // NEW!
  filterNeverShow, // NEW!
  deduplicate,
  validateMedia,
  validateCandidates,
  isSafeToRecommend,
} from "./filters";

// MMR
export {
  mmrReRank,
  getLambdaForMode,
  adaptiveLambda,
  calculateDiversityScore,
  calculateGenreDiversity,
  calculateStudioDiversity,
  diversityReport,
} from "./mmr";

// Explanation
export {
  generateReasons,
  generateDetailedExplanation,
  calculateConfidence,
  exportExplanation,
  isSpoilerFree,
  sanitizeExplanation,
} from "./explain";

// Cache
export {
  cacheManager,
  rateLimiter,
  requestQueue,
  cachedFetch,
  batchFetch,
} from "./cache";

// Feedback (Phase 2 + NEW Telemetry)
export {
  loadUserFeedbacks,
  loadUserInteractions,
  saveClick,
  saveView,
  saveImpression,
  saveSkip, // NEW!
  batchSaveImpressions, // NEW!
  getFeedbackSummary,
  getInteractionSummary,
} from "./feedback";

// ============================================================================
// QUICK START EXAMPLE
// ============================================================================

/**
 * Quick start usage:
 * 
 * ```typescript
 * import { createEngine } from "@logic/netrecV3";
 * 
 * const engine = createEngine();
 * const results = await engine.recommend("username", 12);
 * 
 * for (const rec of results) {
 *   console.log(rec.media.title.english);
 *   console.log("Score:", rec.score);
 *   console.log("Reasons:", rec.reasons);
 *   console.log("Confidence:", rec.confidence);
 * }
 * ```
 */

// ============================================================================
// VERSION INFO
// ============================================================================

export const VERSION = "3.3.0";
export const RELEASE_DATE = "2025-01-12";
export const CODE_NAME = "Ultimate - Phase 3: Current-Similar + Relations + UserStats + Advanced Filtering";