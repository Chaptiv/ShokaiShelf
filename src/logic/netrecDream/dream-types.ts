/**
 * NetRecDream V4 - Core Type System & Profile Foundation
 *
 * Dream V4 introduces adaptive learning, behavioral metrics, and semantic clustering
 * for personalized anime recommendations that evolve with user preferences.
 */

// =============================================================================
// CORE PROFILE TYPES
// =============================================================================

/**
 * Main Dream Profile - Stores all learning data for a user
 * Storage key: `netrec.dream.profile.${userId}`
 */
export interface DreamProfile {
  userId: string;
  version: number;
  weights: DynamicWeights;
  metrics: BehavioralMetrics;
  rules: SemanticRules;
  clusters: DiscoveredClusters;
  learning: LearningHistory;
  lastUpdated: number;
  confidenceLevel: number; // 0-1, based on amount of data collected
}

/**
 * Adaptive weights that learn from user feedback
 * Unlike V3's static DEFAULT_CONFIG, these evolve per-user
 */
export interface DynamicWeights {
  cf: number;              // Collaborative filtering weight (starts at 0.40)
  content: number;         // Content-based matching weight (starts at 0.30)
  freshness: number;       // Time-based freshness weight (starts at 0.08)
  relations: number;       // Sequel/prequel boost weight (starts at 0.08)
  feedback: number;        // Liked anime similarity weight (starts at 0.10)
  negativeSignal: number;  // Disliked anime penalty weight (starts at 0.02)
  interaction: number;     // Click/view interaction weight (starts at 0.02)
  learningRate: number;    // How fast to adapt (0.01-0.1)
  lastAdjusted: number;
}

/**
 * Default weights for new profiles - matches V3 defaults
 */
export const DEFAULT_DYNAMIC_WEIGHTS: DynamicWeights = {
  cf: 0.40,
  content: 0.30,
  freshness: 0.08,
  relations: 0.08,
  feedback: 0.10,
  negativeSignal: 0.02,
  interaction: 0.02,
  learningRate: 0.05,
  lastAdjusted: Date.now()
};

// =============================================================================
// BEHAVIORAL METRICS
// =============================================================================

/**
 * Metrics derived from user's watch history and behavior patterns
 */
export interface BehavioralMetrics {
  // Core watching patterns
  bingeVelocity: number;         // Median episodes/day when watching
  completionistScore: number;    // Percentage of started anime completed (0-1)
  dropRate: number;              // Percentage of started anime dropped (0-1)

  // Drop Forensics - When and why users drop anime
  avgDropPoint: number;          // Average episode when dropping (normalized 0-1)
  vibeCheckDrops: number;        // Count of drops at ep 1-3 (disliked first impression)
  boredomDrops: number;          // Count of drops at ep 4-8 (lost interest mid-season)
  burnoutDrops: number;          // Count of drops at ep 9+ (fatigue near end)

  // Tolerance Scores - Learned from history
  toleranceForOld: number;       // Willingness to watch pre-2010 anime (0-1)
  toleranceForLong: number;      // Willingness to watch 50+ episodes (0-1)
  toleranceForSlowPace: number;  // Inferred from drops of slow-paced anime (0-1)

  // Engagement metrics
  avgSessionLength: number;      // Average episodes per viewing session
  weeklyActiveHours: number;     // Estimated hours of anime per week
  preferredFormats: string[];    // Most watched formats (TV, MOVIE, OVA, etc.)

  // Recency patterns
  lastActiveDate: number;        // Last anime activity timestamp
  daysSinceLastWatch: number;    // Days since last completed/updated entry
}

/**
 * Default behavioral metrics for new users
 */
export const DEFAULT_BEHAVIORAL_METRICS: BehavioralMetrics = {
  bingeVelocity: 2.0,
  completionistScore: 0.5,
  dropRate: 0.2,
  avgDropPoint: 0.25,
  vibeCheckDrops: 0,
  boredomDrops: 0,
  burnoutDrops: 0,
  toleranceForOld: 0.5,
  toleranceForLong: 0.5,
  toleranceForSlowPace: 0.5,
  avgSessionLength: 3,
  weeklyActiveHours: 5,
  preferredFormats: ['TV'],
  lastActiveDate: Date.now(),
  daysSinceLastWatch: 0
};

// =============================================================================
// SEMANTIC RULES (Veto System)
// =============================================================================

/**
 * Hard rules for content filtering - multiplicative penalties/boosts
 */
export interface SemanticRules {
  blacklistedTags: string[];     // Hard vetos (score *= 0.05)
  whitelistedTags: string[];     // Preferred tags (score *= 1.2)
  blacklistedStudios: string[];  // Avoided studios (score *= 0.3)
  whitelistedStudios: string[];  // Preferred studios (score *= 1.3)
  blacklistedGenres: string[];   // Avoided genres (score *= 0.2)
  whitelistedGenres: string[];   // Preferred genres (score *= 1.25)
  preferredClusters: string[];   // Discovered cluster IDs user likes
  avoidedClusters: string[];     // Discovered cluster IDs user dislikes
  minYear: number | null;        // Don't recommend before this year
  maxEpisodes: number | null;    // Don't recommend longer than this
}

/**
 * Default semantic rules for new profiles
 */
export const DEFAULT_SEMANTIC_RULES: SemanticRules = {
  blacklistedTags: [],
  whitelistedTags: [],
  blacklistedStudios: [],
  whitelistedStudios: [],
  blacklistedGenres: [],
  whitelistedGenres: [],
  preferredClusters: [],
  avoidedClusters: [],
  minYear: null,
  maxEpisodes: null
};

// =============================================================================
// ML-DISCOVERED CLUSTERS
// =============================================================================

/**
 * Container for all discovered tag clusters
 */
export interface DiscoveredClusters {
  clusters: TagCluster[];
  lastTraining: number;
  trainingDataSize: number;      // Number of feedback events used for training
  coherenceThreshold: number;    // Minimum coherence to keep a cluster
}

/**
 * A single discovered tag cluster from user patterns
 */
export interface TagCluster {
  id: string;                    // Auto-generated cluster ID
  name: string;                  // Human-readable name (e.g., "DarkPsychological")
  tags: string[];                // Core tags in this cluster
  coherence: number;             // 0-1, how tight the cluster is
  userAffinity: number;          // -1 to 1, user's preference for this cluster
  sampleAnime: number[];         // Example anime IDs in this cluster
  createdAt: number;
  lastUpdated: number;
}

/**
 * Default clusters container for new profiles
 */
export const DEFAULT_DISCOVERED_CLUSTERS: DiscoveredClusters = {
  clusters: [],
  lastTraining: 0,
  trainingDataSize: 0,
  coherenceThreshold: 0.5
};

// =============================================================================
// LEARNING HISTORY
// =============================================================================

/**
 * Records learning events for debugging and analysis
 */
export interface LearningHistory {
  events: LearningEvent[];
  createdAt: number;
  totalEvents: number;
  lastPruned: number;            // When old events were cleaned up
}

/**
 * A single learning event
 */
export interface LearningEvent {
  timestamp: number;
  type: LearningEventType;
  mediaId?: number;
  mediaTitle?: string;
  feedbackType?: FeedbackType;
  reasons?: GranularReason[];
  weightAdjustments?: Partial<DynamicWeights>;
  predictionError?: number;      // Difference between predicted and actual
  notes?: string;
}

export type LearningEventType =
  | 'feedback_received'
  | 'weights_adjusted'
  | 'cluster_trained'
  | 'cluster_updated'
  | 'rule_added'
  | 'rule_removed'
  | 'migration_completed'
  | 'profile_reset';

/**
 * Default learning history for new profiles
 */
export const DEFAULT_LEARNING_HISTORY: LearningHistory = {
  events: [],
  createdAt: Date.now(),
  totalEvents: 0,
  lastPruned: Date.now()
};

// =============================================================================
// GRANULAR FEEDBACK SYSTEM
// =============================================================================

/**
 * Base feedback type (compatible with V3)
 */
export type FeedbackType = 'like' | 'dislike' | null;

/**
 * Granular reasons for feedback - allows detailed learning
 */
export type GranularReason =
  // Pacing
  | 'pacing_too_slow'
  | 'pacing_too_fast'
  | 'pacing_perfect'
  // Art style
  | 'artstyle_dislike'
  | 'artstyle_love'
  | 'artstyle_unique'
  // Plot/Story
  | 'plot_boring'
  | 'plot_amazing'
  | 'plot_predictable'
  | 'plot_confusing'
  // Characters
  | 'character_annoying'
  | 'character_lovable'
  | 'character_relatable'
  | 'character_development_great'
  // Genre/Mood
  | 'genre_mismatch'
  | 'genre_perfect'
  | 'mood_wrong'
  | 'mood_perfect'
  // Visual/Audio
  | 'visual_masterpiece'
  | 'audio_amazing'
  | 'animation_poor'
  | 'animation_stunning'
  | 'ost_memorable'
  // Content concerns
  | 'too_dark'
  | 'too_lighthearted'
  | 'too_fanservice'
  | 'too_violent'
  | 'too_slow_start'
  // Positive overall
  | 'emotional_impact'
  | 'rewatchable'
  | 'underrated_gem';

/**
 * Maps reasons to their impact on weights and rules
 */
export const REASON_IMPACT_MAP: Record<GranularReason, ReasonImpact> = {
  pacing_too_slow: { affectsWeight: 'content', direction: -1, magnitude: 0.05, affectsTag: 'Slow Paced' },
  pacing_too_fast: { affectsWeight: 'content', direction: -1, magnitude: 0.03, affectsTag: 'Fast Paced' },
  pacing_perfect: { affectsWeight: 'content', direction: 1, magnitude: 0.04 },
  artstyle_dislike: { affectsWeight: 'content', direction: -1, magnitude: 0.06 },
  artstyle_love: { affectsWeight: 'content', direction: 1, magnitude: 0.05 },
  artstyle_unique: { affectsWeight: 'content', direction: 1, magnitude: 0.04 },
  plot_boring: { affectsWeight: 'cf', direction: -1, magnitude: 0.05 },
  plot_amazing: { affectsWeight: 'cf', direction: 1, magnitude: 0.06 },
  plot_predictable: { affectsWeight: 'cf', direction: -1, magnitude: 0.03 },
  plot_confusing: { affectsWeight: 'cf', direction: -1, magnitude: 0.04 },
  character_annoying: { affectsWeight: 'content', direction: -1, magnitude: 0.05 },
  character_lovable: { affectsWeight: 'content', direction: 1, magnitude: 0.05 },
  character_relatable: { affectsWeight: 'cf', direction: 1, magnitude: 0.04 },
  character_development_great: { affectsWeight: 'cf', direction: 1, magnitude: 0.05 },
  genre_mismatch: { affectsWeight: 'content', direction: -1, magnitude: 0.08 },
  genre_perfect: { affectsWeight: 'content', direction: 1, magnitude: 0.06 },
  mood_wrong: { affectsWeight: 'content', direction: -1, magnitude: 0.04 },
  mood_perfect: { affectsWeight: 'content', direction: 1, magnitude: 0.04 },
  visual_masterpiece: { affectsWeight: 'content', direction: 1, magnitude: 0.05 },
  audio_amazing: { affectsWeight: 'content', direction: 1, magnitude: 0.04 },
  animation_poor: { affectsWeight: 'content', direction: -1, magnitude: 0.06 },
  animation_stunning: { affectsWeight: 'content', direction: 1, magnitude: 0.06 },
  ost_memorable: { affectsWeight: 'content', direction: 1, magnitude: 0.03 },
  too_dark: { affectsWeight: 'content', direction: -1, magnitude: 0.05, affectsTag: 'Gore' },
  too_lighthearted: { affectsWeight: 'content', direction: -1, magnitude: 0.03 },
  too_fanservice: { affectsWeight: 'content', direction: -1, magnitude: 0.06, affectsTag: 'Ecchi' },
  too_violent: { affectsWeight: 'content', direction: -1, magnitude: 0.05, affectsTag: 'Gore' },
  too_slow_start: { affectsWeight: 'content', direction: -1, magnitude: 0.04, affectsTag: 'Slow Start' },
  emotional_impact: { affectsWeight: 'cf', direction: 1, magnitude: 0.05 },
  rewatchable: { affectsWeight: 'cf', direction: 1, magnitude: 0.04 },
  underrated_gem: { affectsWeight: 'cf', direction: 1, magnitude: 0.05 }
};

export interface ReasonImpact {
  affectsWeight: keyof Pick<DynamicWeights, 'cf' | 'content' | 'feedback' | 'freshness'>;
  direction: 1 | -1;
  magnitude: number;
  affectsTag?: string;           // Optional tag to blacklist/whitelist
}

/**
 * Extended feedback entry with granular reasons
 */
export interface GranularFeedbackEntry {
  mediaId: number;
  type: FeedbackType;
  timestamp: number;
  mediaTitle?: string;
  confidence?: number;
  reasons?: GranularReason[];
  context?: UserContext;
}

/**
 * Context at the time of feedback
 */
export interface UserContext {
  episodeProgress?: number;      // How far they watched
  totalEpisodes?: number;
  timeSpentMinutes?: number;     // Estimated watch time
  wasFromRecommendation?: boolean;
  recommendationSource?: string; // 'cf', 'content', etc.
  sessionMood?: 'exploring' | 'binging' | 'casual';
}

// =============================================================================
// SCORING TYPES
// =============================================================================

/**
 * Extended scoring result with Dream-specific components
 */
export interface DreamScoreBreakdown {
  // Base V3 scores
  cf: number;
  content: number;
  freshness: number;
  relations: number;
  feedback: number;
  negativeSignal: number;
  interaction: number;

  // Dream-specific scores
  clusterBoost: number;          // From semantic clustering
  vetoMultiplier: number;        // From semantic rules
  behavioralModifier: number;    // From behavioral metrics
  toleranceAdjustment: number;   // For old/long anime

  // Final scores
  baseScore: number;             // Linear weighted sum
  dreamScore: number;            // After all multipliers
  confidence: number;            // 0-100
}

/**
 * Prediction result for learning
 */
export interface Prediction {
  mediaId: number;
  predictedScore: number;
  actualFeedback?: FeedbackType;
  error?: number;
  scoreBreakdown: DreamScoreBreakdown;
}

// =============================================================================
// FEEDBACK EVENTS
// =============================================================================

/**
 * Event passed to the learning system when feedback is received
 */
export interface FeedbackEvent {
  mediaId: number;
  type: FeedbackType;
  reasons?: GranularReason[];
  timestamp: number;
  prediction?: Prediction;
  mediaData?: {
    title?: string;
    genres?: string[];
    tags?: string[];
    studios?: string[];
    year?: number;
    episodes?: number;
  };
}

// =============================================================================
// DROP ANALYSIS
// =============================================================================

/**
 * Result of analyzing user's drop patterns
 */
export interface DropAnalysis {
  avgDropPoint: number;
  vibeCheckDrops: number;
  boredomDrops: number;
  burnoutDrops: number;
  totalDrops: number;
  dropsByGenre: Record<string, number>;
  dropsByTag: Record<string, number>;
  dropsByStudio: Record<string, number>;
}

/**
 * Tolerance scores derived from watch history
 */
export interface ToleranceScores {
  toleranceForOld: number;
  toleranceForLong: number;
  toleranceForSlowPace: number;
}

// =============================================================================
// MIGRATION TYPES
// =============================================================================

/**
 * V3 to Dream migration result
 */
export interface MigrationResult {
  success: boolean;
  dreamProfile: DreamProfile;
  v3BackupKey: string;
  warnings: string[];
  errors: string[];
  migrationDuration: number;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  preserveV3Backup: boolean;
  forceReinitialize: boolean;
  importExistingFeedback: boolean;
}

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  profile: (userId: string) => `netrec.dream.profile.${userId}`,
  snapshots: (userId: string) => `netrec.dream.snapshots.${userId}`,
  v3Backup: (userId: string) => `netrec.dream.v3_backup.${userId}`,
  clusters: (userId: string) => `netrec.dream.clusters.${userId}`,
  learningLog: (userId: string) => `netrec.dream.learning.${userId}`,
  migrationStatus: (userId: string) => `netrec.dream.migration.${userId}`
} as const;

// =============================================================================
// HELPER TYPE GUARDS
// =============================================================================

export function isDreamProfile(obj: unknown): obj is DreamProfile {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Partial<DreamProfile>;
  return (
    typeof p.userId === 'string' &&
    typeof p.version === 'number' &&
    typeof p.weights === 'object' &&
    typeof p.metrics === 'object' &&
    typeof p.confidenceLevel === 'number'
  );
}

export function isGranularReason(value: string): value is GranularReason {
  return Object.keys(REASON_IMPACT_MAP).includes(value);
}

// =============================================================================
// VERSION INFO
// =============================================================================

export const DREAM_VERSION = {
  major: 4,
  minor: 0,
  patch: 0,
  name: 'Dream',
  codename: 'Adaptive Learning Engine',
  releaseDate: '2025-01-01'
} as const;
