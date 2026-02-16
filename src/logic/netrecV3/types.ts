/**
 * AnimeNetRec V3 - Type Definitions
 * 
 * Complete type system for the recommendation engine
 */

// ============================================================================
// ANILIST TYPES
// ============================================================================

export interface Media {
  id: number;
  title: {
    english?: string;
    romaji?: string;
    native?: string;
  };
  coverImage?: {
    large?: string;
    extraLarge?: string;
  };
  bannerImage?: string;
  genres?: string[];
  tags?: Tag[];
  studios?: {
    nodes?: Studio[];
  };
  relations?: {
    edges?: RelationEdge[];
  };
  episodes?: number;
  duration?: number;
  averageScore?: number;
  popularity?: number;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  format?: MediaFormat;
  source?: MediaSource;
  isAdult?: boolean;
  recommendations?: {
    nodes?: RecommendationNode[];
  };
}

export interface Tag {
  id: number;
  name: string;
  rank?: number;
  isMediaSpoiler?: boolean;
  isGeneralSpoiler?: boolean;
  isAdult?: boolean;
}

export interface Studio {
  id: number;
  name: string;
  isAnimationStudio?: boolean;
}

export interface RelationEdge {
  relationType?: RelationType;
  node?: Media;
}

export interface RecommendationNode {
  rating?: number;
  mediaRecommendation?: Media;
}

export type MediaFormat = 
  | "TV" 
  | "TV_SHORT" 
  | "MOVIE" 
  | "SPECIAL" 
  | "OVA" 
  | "ONA" 
  | "MUSIC";

export type MediaSource = 
  | "ORIGINAL" 
  | "MANGA" 
  | "LIGHT_NOVEL" 
  | "VISUAL_NOVEL" 
  | "VIDEO_GAME" 
  | "OTHER";

export type RelationType =
  | "SEQUEL"
  | "PREQUEL"
  | "SIDE_STORY"
  | "SPIN_OFF"
  | "ALTERNATIVE"
  | "ADAPTATION"
  | "CHARACTER"
  | "SUMMARY"
  | "OTHER";

export type MediaListStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "DROPPED"
  | "PAUSED"
  | "REPEATING";

export interface MediaListEntry {
  media: Media;
  status: MediaListStatus;
  score?: number;
  progress?: number;
  updatedAt?: number;
}

export interface UserStats {
  genres?: { genre: string; count: number; meanScore: number }[];
  tags?: { tag: Tag; count: number; meanScore: number }[];
  studios?: { studio: Studio; count: number; meanScore: number }[];
}

// ============================================================================
// ENGINE TYPES
// ============================================================================

export interface UserProfile {
  userId: string;
  entries: MediaListEntry[];
  stats?: UserStats;
  preferences?: UserPreferences;
  feedbacks?: UserFeedbacks;
  interactions?: UserInteractions;
  // Dream V4 addition
  dreamProfile?: import('../netrecDream/dream-types').DreamProfile;
}

export interface UserFeedbacks {
  likes: Set<number>;
  dislikes: Set<number>;
}

export interface UserInteractions {
  clicks: Set<number>; // User clicked on media card
  views: Set<number>; // User opened detail view
  impressions: Map<number, number>; // Media ID -> impression count
}

export interface UserContext {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek: "weekday" | "weekend";
  currentSeason: string; // e.g., "WINTER_2025"
  recentlyBinged: boolean;
  avgSessionLength: number;
}

export interface UserPreferences {
  mode: "safe" | "balanced" | "adventurous";
  excludeGenres?: string[];
  excludeTags?: string[];
  excludeStudios?: string[]; // NEW
  neverShow?: number[]; // NEW: Anime IDs to never show
  showAdult?: boolean;
  moodOverride?: string[];
  favoriteGenres?: string[]; // NEW: For boosting recommendations
  selectedAnimeIds?: number[]; // NEW: For cold start
}

export interface Candidate {
  media: Media;
  sources: CandidateSource[];
  seedIds?: number[]; // Which anime led to this recommendation
}

export type CandidateSource =
  | "cf"
  | "content"
  | "trending"
  | "relations"
  | "current-similar"; // NEW: Similar to currently watching

export interface ScoredCandidate extends Candidate {
  scores: {
    cf: number;
    content: number;
    freshness: number;
    relationBoost: number;
    statusMult: number;
    timeDecay: number;
    binge: number;
    meta: number;
    mmr: number;
    final: number;
  };
  features: Features;
  reasons: string[];
}

export interface Features {
  // Content Features
  genreOverlap: number;
  tagOverlap: number;
  studioMatch: boolean;
  formatMatch: boolean;
  sourceMatch: boolean;

  // Collaborative Features
  cfScore: number;
  cfRating: number;

  // Temporal Features
  daysSinceRelease: number;
  isFresh: boolean;

  // Relation Features
  hasSequel: boolean;
  hasPrequel: boolean;
  relationType?: RelationType;

  // User Context
  isInPTW: boolean;
  isDropped: boolean;
  isPaused: boolean;
  userScore?: number;

  // Bingeability
  episodeCount: number;
  avgDuration: number;
  bingeScore: number;

  // Feedback Features (Phase 2)
  isLiked: boolean;
  isDisliked: boolean;
  wasClicked: boolean;
  wasViewed: boolean;
  impressionCount: number;

  // Negative Signals
  negativeSimilarity: number; // Similarity to disliked anime
  positiveSimilarity: number; // Similarity to liked anime
}

export interface RecommendationResult {
  media: Media;
  score: number;
  reasons: string[];
  confidence: number;
  sources: CandidateSource[];
}

export interface EngineConfig {
  // Candidate Generation
  maxSeedsPerBatch: number;
  recsPerSeed: number;
  contentKNN: number;
  trendingFallback: number;

  // Meta Weights
  weights: {
    cf: number;
    content: number;
    freshness: number;
    relations: number;
    feedback: number; // NEW: Phase 2
    negativeSignal: number; // NEW: Phase 2
    interaction: number; // NEW: Phase 2
  };

  // Status Multipliers
  statusMultipliers: {
    completed: number;
    dropped: number;
    paused: number;
    planning: number;
    repeating: number;
  };

  // Time Decay
  timeDecayLambda: number;

  // MMR
  mmrLambda: {
    safe: number;
    balanced: number;
    adventurous: number;
  };

  // Filtering
  filterAdult: boolean;
  filterSpoilers: boolean;
  minScoreThreshold: number; // Minimum score (0-1) to include in results

  // Caching
  cacheEnabled: boolean;
  cacheTTL: number;

  // Phase 2: Feedback & Learning
  feedbackBoost: number; // Boost for liked anime similarity
  negativePenalty: number; // Penalty for disliked anime similarity
  clickBoost: number; // Boost for clicked anime
  viewBoost: number; // Boost for viewed anime
}

export const DEFAULT_CONFIG: EngineConfig = {
  maxSeedsPerBatch: 10,
  recsPerSeed: 20,
  contentKNN: 50,
  trendingFallback: 50,

  weights: {
    cf: 0.40, // Reduced slightly
    content: 0.30, // Reduced slightly
    freshness: 0.08,
    relations: 0.08,
    feedback: 0.10, // NEW: Phase 2
    negativeSignal: 0.02, // NEW: Phase 2 (penalty weight)
    interaction: 0.02, // NEW: Phase 2
  },

  statusMultipliers: {
    completed: 0, // Exclude
    dropped: 0.5, // Heavy penalty
    paused: 1.2, // Slight boost
    planning: 1.2, // Slight boost
    repeating: 1.3, // Rewatch potential
  },

  timeDecayLambda: 0.0001, // ~2.7 years half-life

  mmrLambda: {
    safe: 0.7,
    balanced: 0.5,
    adventurous: 0.3,
  },

  filterAdult: true,
  filterSpoilers: true,
  minScoreThreshold: 0.20, // Filter out recommendations below 20/100 points

  cacheEnabled: true,
  cacheTTL: 24 * 60 * 60 * 1000, // 24 hours

  // Phase 2: Feedback & Learning
  feedbackBoost: 0.3, // Boost multiplier for liked anime
  negativePenalty: 0.4, // Penalty multiplier for disliked anime
  clickBoost: 0.15, // Boost for clicked anime
  viewBoost: 0.2, // Boost for viewed anime
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  signature: string;
}

export interface RateLimitState {
  requestCount: number;
  resetTime: number;
  backoffUntil?: number;
}

export interface TelemetryEvent {
  type: "impression" | "click" | "feedback" | "skip";
  userId: string;
  mediaId: number;
  timestamp: number;
  scores?: Partial<ScoredCandidate["scores"]>;
  context: {
    mode: string;
    sessionDuration: number;
    timeOfDay: number;
  };
}