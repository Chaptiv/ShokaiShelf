/**
 * NetRecDream V4 - Public API
 *
 * Adaptive Learning Recommendation Engine for Anime
 * Extends NetRecV3 with behavioral metrics, semantic clustering,
 * and personalized weight learning.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type {
  DreamProfile,
  DynamicWeights,
  BehavioralMetrics,
  SemanticRules,
  DiscoveredClusters,
  TagCluster,
  LearningHistory,
  LearningEvent,
  LearningEventType,
  FeedbackType,
  GranularReason,
  GranularFeedbackEntry,
  UserContext,
  DreamScoreBreakdown,
  Prediction,
  FeedbackEvent,
  DropAnalysis,
  ToleranceScores,
  MigrationResult,
  MigrationOptions
} from './dream-types';

export {
  DEFAULT_DYNAMIC_WEIGHTS,
  DEFAULT_BEHAVIORAL_METRICS,
  DEFAULT_SEMANTIC_RULES,
  DEFAULT_DISCOVERED_CLUSTERS,
  DEFAULT_LEARNING_HISTORY,
  REASON_IMPACT_MAP,
  STORAGE_KEYS,
  DREAM_VERSION,
  isDreamProfile,
  isGranularReason
} from './dream-types';

// =============================================================================
// PROFILE MANAGEMENT
// =============================================================================

export {
  initializeDreamProfile,
  loadDreamProfile,
  saveDreamProfile,
  updateDreamProfile,
  resetDreamProfile,
  deleteDreamProfile,
  hasDreamProfile,
  getProfileStats
} from './profile-manager';

export type { ProfileStats } from './profile-manager';

// =============================================================================
// IMPLICIT SIGNALS
// =============================================================================

export {
  calculateAllBehavioralMetrics,
  calculateBingeVelocity,
  calculateCompletionistScore,
  calculateDropRate,
  analyzeDropPatterns,
  calculateToleranceScores,
  getDropStats,
  getBingeProfile,
  getToleranceDescription
} from './implicit-signals';

// =============================================================================
// SEMANTIC CLUSTERING
// =============================================================================

export {
  discoverClusters,
  buildTagCooccurrenceMatrix,
  calculateClusterAffinity,
  generateClusterName,
  findMatchingClusters,
  getClusterScoreModifier,
  updateClusterAffinity
} from './semantic-clustering';

// =============================================================================
// WEIGHT ADAPTATION
// =============================================================================

export {
  adaptWeights,
  analyzeWeightChanges,
  generateWeightInsights,
  resetWeights,
  softResetWeights,
  batchLearnWeights
} from './weight-adapter';

export type { WeightChange, WeightAnalysis } from './weight-adapter';

// =============================================================================
// DREAM SCORING
// =============================================================================

export {
  calculateDreamScore,
  applyVetoRules,
  applyClusterBoost,
  applyBehavioralModifiers,
  applyToleranceAdjustment,
  generateDreamReasons,
  explainDreamScore
} from './dream-scoring';

// =============================================================================
// DREAM ENGINE
// =============================================================================

export {
  AnimeNetRecDream,
  createDreamEngine,
  getDreamEngine,
  resetDreamEngine,
  shouldUseDreamEngine,
  getSmartRecommendations
} from './dream-engine';

export type {
  DreamScoredCandidate,
  DreamRecommendationResult,
  ProfileInsights
} from './dream-engine';

// =============================================================================
// MIGRATION
// =============================================================================

export {
  migrateV3ToDream,
  getMigrationStatus,
  setMigrationStatus,
  revertToV3,
  canRevertToV3,
  checkAndMigrate
} from './migration';

export type { MigrationStatus } from './migration';

// =============================================================================
// VERSION INFO
// =============================================================================

export const VERSION = {
  name: 'NetRecDream',
  version: '4.0.0',
  codename: 'Adaptive Learning Engine',
  features: [
    'Adaptive weight learning',
    'Behavioral metrics analysis',
    'Semantic tag clustering',
    'Granular feedback collection',
    'Tolerance-based scoring',
    'Veto system with hard constraints',
    'Profile insights and analytics'
  ]
};
