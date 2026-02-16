/**
 * NetRecDream V4 - Profile Manager
 *
 * Handles initialization, loading, saving, and updating of DreamProfiles.
 * Provides versioning and snapshot capabilities for profile recovery.
 */

import { devLog, devWarn, logError } from "@utils/logger";
import {
  DreamProfile,
  DynamicWeights,
  BehavioralMetrics,
  SemanticRules,
  DiscoveredClusters,
  LearningHistory,
  LearningEvent,
  FeedbackEvent,
  GranularReason,
  STORAGE_KEYS,
  DEFAULT_DYNAMIC_WEIGHTS,
  DEFAULT_BEHAVIORAL_METRICS,
  DEFAULT_SEMANTIC_RULES,
  DEFAULT_DISCOVERED_CLUSTERS,
  DEFAULT_LEARNING_HISTORY,
  isDreamProfile,
  REASON_IMPACT_MAP
} from './dream-types';

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Get storage interface (Electron Store or localStorage fallback)
 */
function getStorage(): {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
} {
  // Try Electron Store first
  if (typeof window !== 'undefined' && (window as any).shokai?.store) {
    return {
      get: async (key: string) => (window as any).shokai.store.get(key),
      set: async (key: string, value: unknown) => (window as any).shokai.store.set(key, value)
    };
  }

  // Fallback to localStorage
  return {
    get: async (key: string) => {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    },
    set: async (key: string, value: unknown) => {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };
}

// =============================================================================
// PROFILE INITIALIZATION
// =============================================================================

/**
 * Initialize a new DreamProfile from V3 user profile data
 */
export async function initializeDreamProfile(
  userId: string,
  v3Entries: MediaListEntry[],
  existingFeedback?: { likes: number[]; dislikes: number[] }
): Promise<DreamProfile> {
  devLog(`[DreamProfileManager] Initializing new profile for ${userId}`);

  // Import behavioral metrics calculator (will be implemented in implicit-signals.ts)
  const { calculateAllBehavioralMetrics } = await import('./implicit-signals');

  // Calculate initial metrics from watch history
  const metrics = v3Entries.length > 0
    ? calculateAllBehavioralMetrics(v3Entries)
    : { ...DEFAULT_BEHAVIORAL_METRICS };

  // Initialize rules from preferences (if available)
  const rules = initializeRulesFromHistory(v3Entries);

  // Calculate initial confidence based on data available
  const confidenceLevel = calculateInitialConfidence(v3Entries, existingFeedback);

  const profile: DreamProfile = {
    userId,
    version: 1,
    weights: { ...DEFAULT_DYNAMIC_WEIGHTS, lastAdjusted: Date.now() },
    metrics,
    rules,
    clusters: { ...DEFAULT_DISCOVERED_CLUSTERS },
    learning: {
      events: [{
        timestamp: Date.now(),
        type: 'migration_completed',
        notes: `Initialized from ${v3Entries.length} entries`
      }],
      createdAt: Date.now(),
      totalEvents: 1,
      lastPruned: Date.now()
    },
    lastUpdated: Date.now(),
    confidenceLevel
  };

  // Save the new profile
  await saveDreamProfile(profile);

  devLog(`[DreamProfileManager] Profile initialized with confidence: ${confidenceLevel.toFixed(2)}`);
  return profile;
}

/**
 * Initialize semantic rules from user's watch history
 */
function initializeRulesFromHistory(entries: MediaListEntry[]): SemanticRules {
  const rules: SemanticRules = { ...DEFAULT_SEMANTIC_RULES };

  // Analyze completed anime for preferred patterns
  const completed = entries.filter(e => e.status === 'COMPLETED');
  const dropped = entries.filter(e => e.status === 'DROPPED');

  // Count studios from completed vs dropped
  const studioScores: Record<string, { completed: number; dropped: number }> = {};

  for (const entry of completed) {
    const studios = entry.media?.studios?.nodes || [];
    for (const studio of studios) {
      if (!studioScores[studio.name]) {
        studioScores[studio.name] = { completed: 0, dropped: 0 };
      }
      studioScores[studio.name].completed++;
    }
  }

  for (const entry of dropped) {
    const studios = entry.media?.studios?.nodes || [];
    for (const studio of studios) {
      if (!studioScores[studio.name]) {
        studioScores[studio.name] = { completed: 0, dropped: 0 };
      }
      studioScores[studio.name].dropped++;
    }
  }

  // Studios with 3+ completed and 0 drops → whitelist
  // Studios with 3+ drops and 0 completed → blacklist
  for (const [studio, scores] of Object.entries(studioScores)) {
    if (scores.completed >= 3 && scores.dropped === 0) {
      rules.whitelistedStudios.push(studio);
    } else if (scores.dropped >= 3 && scores.completed === 0) {
      rules.blacklistedStudios.push(studio);
    }
  }

  // Similar analysis for genres
  const genreScores: Record<string, { completed: number; dropped: number; avgScore: number }> = {};

  for (const entry of completed) {
    const genres = entry.media?.genres || [];
    const score = entry.score || 0;
    for (const genre of genres) {
      if (!genreScores[genre]) {
        genreScores[genre] = { completed: 0, dropped: 0, avgScore: 0 };
      }
      genreScores[genre].completed++;
      genreScores[genre].avgScore += score;
    }
  }

  for (const entry of dropped) {
    const genres = entry.media?.genres || [];
    for (const genre of genres) {
      if (!genreScores[genre]) {
        genreScores[genre] = { completed: 0, dropped: 0, avgScore: 0 };
      }
      genreScores[genre].dropped++;
    }
  }

  // Calculate average scores and determine preferences
  for (const [genre, scores] of Object.entries(genreScores)) {
    if (scores.completed > 0) {
      scores.avgScore /= scores.completed;
    }

    // High completion with high scores → whitelist
    if (scores.completed >= 5 && scores.avgScore >= 7.5 && scores.dropped <= 1) {
      rules.whitelistedGenres.push(genre);
    }
    // High drop rate → blacklist
    else if (scores.dropped >= 3 && scores.completed <= 1) {
      rules.blacklistedGenres.push(genre);
    }
  }

  return rules;
}

/**
 * Calculate initial confidence level based on available data
 */
function calculateInitialConfidence(
  entries: MediaListEntry[],
  feedback?: { likes: number[]; dislikes: number[] }
): number {
  let confidence = 0;

  // Entries contribute up to 0.4 confidence
  const entryScore = Math.min(entries.length / 50, 1) * 0.4;
  confidence += entryScore;

  // Completed entries contribute up to 0.2 confidence
  const completed = entries.filter(e => e.status === 'COMPLETED').length;
  const completedScore = Math.min(completed / 30, 1) * 0.2;
  confidence += completedScore;

  // Feedback contributes up to 0.3 confidence
  if (feedback) {
    const totalFeedback = feedback.likes.length + feedback.dislikes.length;
    const feedbackScore = Math.min(totalFeedback / 20, 1) * 0.3;
    confidence += feedbackScore;
  }

  // Base confidence of 0.1 for having any data
  if (entries.length > 0) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

// =============================================================================
// PROFILE LOADING
// =============================================================================

/**
 * Load existing DreamProfile from storage
 */
export async function loadDreamProfile(userId: string): Promise<DreamProfile | null> {
  const storage = getStorage();
  const key = STORAGE_KEYS.profile(userId);

  try {
    const data = await storage.get(key);

    if (!data) {
      devLog(`[DreamProfileManager] No profile found for ${userId}`);
      return null;
    }

    if (!isDreamProfile(data)) {
      devWarn(`[DreamProfileManager] Invalid profile data for ${userId}, returning null`);
      return null;
    }

    // Validate and potentially upgrade profile version
    const profile = validateAndUpgradeProfile(data);

    devLog(`[DreamProfileManager] Loaded profile for ${userId} (v${profile.version}, confidence: ${profile.confidenceLevel.toFixed(2)})`);
    return profile;
  } catch (error) {
    logError(`[DreamProfileManager] Error loading profile for ${userId}:`, error);
    return null;
  }
}

/**
 * Validate and upgrade profile to latest version if needed
 */
function validateAndUpgradeProfile(profile: DreamProfile): DreamProfile {
  const upgraded = { ...profile };

  // Ensure all required fields exist with defaults
  if (!upgraded.weights) upgraded.weights = { ...DEFAULT_DYNAMIC_WEIGHTS };
  if (!upgraded.metrics) upgraded.metrics = { ...DEFAULT_BEHAVIORAL_METRICS };
  if (!upgraded.rules) upgraded.rules = { ...DEFAULT_SEMANTIC_RULES };
  if (!upgraded.clusters) upgraded.clusters = { ...DEFAULT_DISCOVERED_CLUSTERS };
  if (!upgraded.learning) upgraded.learning = { ...DEFAULT_LEARNING_HISTORY };

  // Add any new fields from later versions
  if (upgraded.metrics.preferredFormats === undefined) {
    upgraded.metrics.preferredFormats = ['TV'];
  }
  if (upgraded.rules.whitelistedTags === undefined) {
    upgraded.rules.whitelistedTags = [];
  }

  return upgraded;
}

// =============================================================================
// PROFILE SAVING
// =============================================================================

/**
 * Save DreamProfile to storage with versioning
 */
export async function saveDreamProfile(profile: DreamProfile): Promise<void> {
  const storage = getStorage();
  const key = STORAGE_KEYS.profile(profile.userId);

  // Update timestamp
  profile.lastUpdated = Date.now();

  try {
    await storage.set(key, profile);
    devLog(`[DreamProfileManager] Saved profile for ${profile.userId}`);

    // Create snapshot every 10 learning events
    if (profile.learning.totalEvents % 10 === 0 && profile.learning.totalEvents > 0) {
      await createProfileSnapshot(profile);
    }
  } catch (error) {
    logError(`[DreamProfileManager] Error saving profile for ${profile.userId}:`, error);
    throw error;
  }
}

/**
 * Create a snapshot for recovery purposes
 */
async function createProfileSnapshot(profile: DreamProfile): Promise<void> {
  const storage = getStorage();
  const key = STORAGE_KEYS.snapshots(profile.userId);

  try {
    const existingSnapshots = (await storage.get(key)) as ProfileSnapshot[] || [];

    const snapshot: ProfileSnapshot = {
      timestamp: Date.now(),
      version: profile.version,
      confidenceLevel: profile.confidenceLevel,
      totalEvents: profile.learning.totalEvents,
      weightsSnapshot: { ...profile.weights },
      metricsSnapshot: { ...profile.metrics }
    };

    // Keep only last 5 snapshots
    existingSnapshots.push(snapshot);
    if (existingSnapshots.length > 5) {
      existingSnapshots.shift();
    }

    await storage.set(key, existingSnapshots);
    devLog(`[DreamProfileManager] Created snapshot #${existingSnapshots.length} for ${profile.userId}`);
  } catch (error) {
    devWarn(`[DreamProfileManager] Failed to create snapshot:`, error);
  }
}

interface ProfileSnapshot {
  timestamp: number;
  version: number;
  confidenceLevel: number;
  totalEvents: number;
  weightsSnapshot: DynamicWeights;
  metricsSnapshot: BehavioralMetrics;
}

// =============================================================================
// PROFILE UPDATING
// =============================================================================

/**
 * Main update pipeline - called after feedback events
 */
export async function updateDreamProfile(
  profile: DreamProfile,
  event: FeedbackEvent
): Promise<DreamProfile> {
  devLog(`[DreamProfileManager] Updating profile for feedback on media ${event.mediaId}`);

  const updated = { ...profile };

  // 1. Record learning event
  const learningEvent: LearningEvent = {
    timestamp: event.timestamp,
    type: 'feedback_received',
    mediaId: event.mediaId,
    mediaTitle: event.mediaData?.title,
    feedbackType: event.type,
    reasons: event.reasons
  };

  updated.learning.events.push(learningEvent);
  updated.learning.totalEvents++;

  // 2. Update semantic rules based on feedback
  if (event.type && event.mediaData) {
    updateSemanticRules(updated.rules, event);
  }

  // 3. Adjust weights based on prediction error (if available)
  if (event.prediction && event.type) {
    const { adaptWeights } = await import('./weight-adapter');
    updated.weights = adaptWeights(updated.weights, event, event.prediction);

    // Record weight adjustment
    updated.learning.events.push({
      timestamp: Date.now(),
      type: 'weights_adjusted',
      mediaId: event.mediaId,
      predictionError: event.prediction.error
    });
    updated.learning.totalEvents++;
  }

  // 4. Process granular reasons
  if (event.reasons && event.reasons.length > 0) {
    processGranularReasons(updated, event.reasons, event.mediaData);
  }

  // 5. Update confidence level
  updated.confidenceLevel = Math.min(
    updated.confidenceLevel + 0.01, // Small boost per feedback
    1.0
  );

  // 6. Prune old learning events (keep last 500)
  if (updated.learning.events.length > 500) {
    updated.learning.events = updated.learning.events.slice(-500);
    updated.learning.lastPruned = Date.now();
  }

  // 7. Check if cluster retraining is needed
  const feedbackCount = updated.learning.events.filter(
    e => e.type === 'feedback_received'
  ).length;

  if (feedbackCount >= 20 && feedbackCount % 20 === 0) {
    // Trigger cluster retraining (async, non-blocking)
    triggerClusterRetraining(updated).catch(err => {
      devWarn('[DreamProfileManager] Cluster retraining failed:', err);
    });
  }

  // 8. Save updated profile
  await saveDreamProfile(updated);

  return updated;
}

/**
 * Update semantic rules based on feedback
 */
function updateSemanticRules(rules: SemanticRules, event: FeedbackEvent): void {
  const { type, mediaData } = event;
  if (!type || !mediaData) return;

  const { genres = [], tags = [], studios = [] } = mediaData;

  if (type === 'dislike') {
    // Check for repeated dislikes
    for (const tag of tags) {
      // This would need to track counts - simplified for now
      if (!rules.blacklistedTags.includes(tag) && tags.length <= 3) {
        // Only auto-blacklist if anime has few tags (more specific)
        // Full implementation would track dislike counts per tag
      }
    }
  } else if (type === 'like') {
    // Remove from blacklists if liked
    for (const tag of tags) {
      const idx = rules.blacklistedTags.indexOf(tag);
      if (idx !== -1) {
        rules.blacklistedTags.splice(idx, 1);
      }
    }
  }
}

/**
 * Process granular reasons to update profile
 */
function processGranularReasons(
  profile: DreamProfile,
  reasons: GranularReason[],
  mediaData?: FeedbackEvent['mediaData']
): void {
  for (const reason of reasons) {
    const impact = REASON_IMPACT_MAP[reason];
    if (!impact) continue;

    // If reason affects a specific tag, update rules
    if (impact.affectsTag && mediaData?.tags?.includes(impact.affectsTag)) {
      if (impact.direction < 0) {
        // Negative impact → potentially blacklist tag
        if (!profile.rules.blacklistedTags.includes(impact.affectsTag)) {
          // Only blacklist after multiple negative reasons (simplified)
          // Full implementation would track counts
        }
      } else {
        // Positive impact → potentially whitelist tag
        if (!profile.rules.whitelistedTags.includes(impact.affectsTag)) {
          profile.rules.whitelistedTags.push(impact.affectsTag);
        }
      }
    }
  }
}

/**
 * Trigger cluster retraining (async)
 */
async function triggerClusterRetraining(profile: DreamProfile): Promise<void> {
  devLog(`[DreamProfileManager] Triggering cluster retraining for ${profile.userId}`);

  try {
    const { discoverClusters } = await import('./semantic-clustering');
    const newClusters = await discoverClusters(profile);

    if (newClusters.clusters.length > 0) {
      profile.clusters = newClusters;

      profile.learning.events.push({
        timestamp: Date.now(),
        type: 'cluster_trained',
        notes: `Trained ${newClusters.clusters.length} clusters`
      });
      profile.learning.totalEvents++;

      await saveDreamProfile(profile);
    }
  } catch (error) {
    logError('[DreamProfileManager] Cluster retraining error:', error);
  }
}

// =============================================================================
// PROFILE UTILITIES
// =============================================================================

/**
 * Reset profile to defaults (keeps userId)
 */
export async function resetDreamProfile(userId: string): Promise<DreamProfile> {
  devLog(`[DreamProfileManager] Resetting profile for ${userId}`);

  const profile: DreamProfile = {
    userId,
    version: 1,
    weights: { ...DEFAULT_DYNAMIC_WEIGHTS },
    metrics: { ...DEFAULT_BEHAVIORAL_METRICS },
    rules: { ...DEFAULT_SEMANTIC_RULES },
    clusters: { ...DEFAULT_DISCOVERED_CLUSTERS },
    learning: {
      events: [{
        timestamp: Date.now(),
        type: 'profile_reset',
        notes: 'Profile reset to defaults'
      }],
      createdAt: Date.now(),
      totalEvents: 1,
      lastPruned: Date.now()
    },
    lastUpdated: Date.now(),
    confidenceLevel: 0.1
  };

  await saveDreamProfile(profile);
  return profile;
}

/**
 * Delete profile completely
 */
export async function deleteDreamProfile(userId: string): Promise<void> {
  const storage = getStorage();

  await storage.set(STORAGE_KEYS.profile(userId), null);
  await storage.set(STORAGE_KEYS.snapshots(userId), null);
  await storage.set(STORAGE_KEYS.learningLog(userId), null);

  devLog(`[DreamProfileManager] Deleted profile for ${userId}`);
}

/**
 * Check if Dream profile exists for user
 */
export async function hasDreamProfile(userId: string): Promise<boolean> {
  const profile = await loadDreamProfile(userId);
  return profile !== null;
}

/**
 * Get profile statistics for display
 */
export function getProfileStats(profile: DreamProfile): ProfileStats {
  return {
    totalFeedbackEvents: profile.learning.events.filter(
      e => e.type === 'feedback_received'
    ).length,
    totalWeightAdjustments: profile.learning.events.filter(
      e => e.type === 'weights_adjusted'
    ).length,
    clusterCount: profile.clusters.clusters.length,
    confidenceLevel: profile.confidenceLevel,
    daysSinceCreation: Math.floor(
      (Date.now() - profile.learning.createdAt) / (1000 * 60 * 60 * 24)
    ),
    blacklistedItems: (
      profile.rules.blacklistedTags.length +
      profile.rules.blacklistedStudios.length +
      profile.rules.blacklistedGenres.length
    ),
    whitelistedItems: (
      profile.rules.whitelistedTags.length +
      profile.rules.whitelistedStudios.length +
      profile.rules.whitelistedGenres.length
    )
  };
}

export interface ProfileStats {
  totalFeedbackEvents: number;
  totalWeightAdjustments: number;
  clusterCount: number;
  confidenceLevel: number;
  daysSinceCreation: number;
  blacklistedItems: number;
  whitelistedItems: number;
}

// =============================================================================
// TYPE IMPORTS (for type checking only)
// =============================================================================

interface MediaListEntry {
  id: number;
  mediaId: number;
  status: string;
  score?: number;
  progress?: number;
  progressVolumes?: number;
  repeat?: number;
  priority?: number;
  private?: boolean;
  notes?: string;
  hiddenFromStatusLists?: boolean;
  startedAt?: { year?: number; month?: number; day?: number };
  completedAt?: { year?: number; month?: number; day?: number };
  updatedAt?: number;
  createdAt?: number;
  media?: {
    id: number;
    episodes?: number;
    genres?: string[];
    tags?: { name: string }[];
    studios?: { nodes: { name: string }[] };
    startDate?: { year?: number };
    format?: string;
  };
}
