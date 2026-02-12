/**
 * NetRecDream V4 - Migration System
 *
 * Handles automatic migration from V3 to Dream V4.
 * Preserves V3 data as backup and creates Dream profile from existing data.
 */

import {
  DreamProfile,
  MigrationResult,
  MigrationOptions,
  STORAGE_KEYS,
  DEFAULT_DYNAMIC_WEIGHTS,
  DEFAULT_SEMANTIC_RULES,
  DEFAULT_DISCOVERED_CLUSTERS,
  DEFAULT_LEARNING_HISTORY
} from './dream-types';
import { calculateAllBehavioralMetrics } from './implicit-signals';
import { saveDreamProfile, loadDreamProfile } from './profile-manager';
import { discoverClusters } from './semantic-clustering';

// =============================================================================
// STORAGE HELPERS
// =============================================================================

function getStorage(): {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
} {
  if (typeof window !== 'undefined' && (window as any).shokai?.store) {
    return {
      get: async (key: string) => (window as any).shokai.store.get(key),
      set: async (key: string, value: unknown) => (window as any).shokai.store.set(key, value)
    };
  }

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
// MAIN MIGRATION FUNCTION
// =============================================================================

/**
 * Migrate from V3 to Dream V4
 */
export async function migrateV3ToDream(
  userName: string,
  options: Partial<MigrationOptions> = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  console.log(`[Migration] Starting V3 → Dream migration for ${userName}`);

  const opts: MigrationOptions = {
    preserveV3Backup: options.preserveV3Backup ?? true,
    forceReinitialize: options.forceReinitialize ?? false,
    importExistingFeedback: options.importExistingFeedback ?? true
  };

  try {
    // 1. Check if Dream profile already exists
    const existingProfile = await loadDreamProfile(userName);
    if (existingProfile && !opts.forceReinitialize) {
      console.log(`[Migration] Dream profile already exists, skipping migration`);
      return {
        success: true,
        dreamProfile: existingProfile,
        v3BackupKey: STORAGE_KEYS.v3Backup(userName),
        warnings: ['Dream profile already exists'],
        errors: [],
        migrationDuration: Date.now() - startTime
      };
    }

    // 2. Load V3 user data
    const v3Data = await loadV3UserData(userName);
    if (!v3Data.entries || v3Data.entries.length === 0) {
      warnings.push('No V3 entries found, creating minimal profile');
    }

    // 3. Create V3 backup if requested
    if (opts.preserveV3Backup) {
      await createV3Backup(userName, v3Data);
      console.log(`[Migration] V3 backup created`);
    }

    // 4. Load existing feedback
    let feedbackData = { likes: [] as number[], dislikes: [] as number[] };
    if (opts.importExistingFeedback) {
      try {
        const { exportFeedbackForEngine } = await import('../feedback-store');
        feedbackData = await exportFeedbackForEngine();
        console.log(`[Migration] Loaded ${feedbackData.likes.length} likes, ${feedbackData.dislikes.length} dislikes`);
      } catch (err) {
        warnings.push('Could not import existing feedback');
      }
    }

    // 5. Calculate behavioral metrics
    const metrics = v3Data.entries.length > 0
      ? calculateAllBehavioralMetrics(v3Data.entries)
      : getDefaultMetrics();

    // 6. Initialize semantic rules from history
    const rules = initializeSemanticRules(v3Data.entries);

    // 7. Calculate initial confidence
    const confidenceLevel = calculateInitialConfidence(
      v3Data.entries,
      feedbackData
    );

    // 8. Create Dream profile
    const dreamProfile: DreamProfile = {
      userId: userName,
      version: 1,
      weights: {
        ...DEFAULT_DYNAMIC_WEIGHTS,
        learningRate: confidenceLevel < 0.5 ? 0.05 : 0.02,
        lastAdjusted: Date.now()
      },
      metrics,
      rules,
      clusters: { ...DEFAULT_DISCOVERED_CLUSTERS },
      learning: {
        events: [{
          timestamp: Date.now(),
          type: 'migration_completed',
          notes: `Migrated from V3 with ${v3Data.entries.length} entries, ${feedbackData.likes.length + feedbackData.dislikes.length} feedback items`
        }],
        createdAt: Date.now(),
        totalEvents: 1,
        lastPruned: Date.now()
      },
      lastUpdated: Date.now(),
      confidenceLevel
    };

    // 9. Discover initial clusters if enough feedback
    if (feedbackData.likes.length + feedbackData.dislikes.length >= 10) {
      console.log(`[Migration] Discovering initial clusters...`);
      try {
        const clusters = await discoverClusters(dreamProfile);
        dreamProfile.clusters = clusters;
        console.log(`[Migration] Discovered ${clusters.clusters.length} clusters`);
      } catch (err) {
        warnings.push('Cluster discovery failed, will retry later');
      }
    }

    // 10. Save Dream profile
    await saveDreamProfile(dreamProfile);

    // 11. Mark migration as complete
    await setMigrationStatus(userName, 'complete');

    const duration = Date.now() - startTime;
    console.log(`[Migration] Complete in ${duration}ms. Confidence: ${confidenceLevel.toFixed(2)}`);

    return {
      success: true,
      dreamProfile,
      v3BackupKey: STORAGE_KEYS.v3Backup(userName),
      warnings,
      errors,
      migrationDuration: duration
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Migration failed: ${errMsg}`);
    console.error(`[Migration] Error:`, error);

    return {
      success: false,
      dreamProfile: createFallbackProfile(userName),
      v3BackupKey: '',
      warnings,
      errors,
      migrationDuration: Date.now() - startTime
    };
  }
}

// =============================================================================
// V3 DATA LOADING
// =============================================================================

interface V3UserData {
  entries: any[];
  stats?: any;
  preferences?: any;
  feedbacks?: { likes: Set<number>; dislikes: Set<number> };
}

async function loadV3UserData(userName: string): Promise<V3UserData> {
  try {
    const { fetchUserLibrary, fetchUserStats } = await import('../netrecV3/queries');
    const { loadUserFeedbacks } = await import('../netrecV3/feedback');

    const entries = await fetchUserLibrary(userName);
    const stats = await fetchUserStats(userName).catch(() => undefined);
    const feedbacks = await loadUserFeedbacks(userName);

    // Load preferences
    let preferences;
    try {
      const { getPreferences } = await import('../preferences-store');
      preferences = await getPreferences();
    } catch {}

    return { entries, stats, preferences, feedbacks };

  } catch (error) {
    console.error('[Migration] Error loading V3 data:', error);
    return { entries: [] };
  }
}

// =============================================================================
// V3 BACKUP
// =============================================================================

async function createV3Backup(userName: string, v3Data: V3UserData): Promise<void> {
  const storage = getStorage();
  const key = STORAGE_KEYS.v3Backup(userName);

  const backup = {
    timestamp: Date.now(),
    entryCount: v3Data.entries.length,
    stats: v3Data.stats,
    preferences: v3Data.preferences,
    feedbackLikes: v3Data.feedbacks ? Array.from(v3Data.feedbacks.likes) : [],
    feedbackDislikes: v3Data.feedbacks ? Array.from(v3Data.feedbacks.dislikes) : []
  };

  await storage.set(key, backup);
}

// =============================================================================
// SEMANTIC RULES INITIALIZATION
// =============================================================================

function initializeSemanticRules(entries: any[]): typeof DEFAULT_SEMANTIC_RULES {
  const rules = { ...DEFAULT_SEMANTIC_RULES };

  if (entries.length === 0) return rules;

  // Analyze completed vs dropped patterns
  const completed = entries.filter((e: any) => e.status === 'COMPLETED');
  const dropped = entries.filter((e: any) => e.status === 'DROPPED');

  // Studio analysis
  const studioScores: Record<string, { completed: number; dropped: number; avgScore: number }> = {};

  for (const entry of completed) {
    const studios = entry.media?.studios?.nodes || [];
    const score = entry.score || 0;
    for (const studio of studios) {
      if (!studioScores[studio.name]) {
        studioScores[studio.name] = { completed: 0, dropped: 0, avgScore: 0 };
      }
      studioScores[studio.name].completed++;
      studioScores[studio.name].avgScore += score;
    }
  }

  for (const entry of dropped) {
    const studios = entry.media?.studios?.nodes || [];
    for (const studio of studios) {
      if (!studioScores[studio.name]) {
        studioScores[studio.name] = { completed: 0, dropped: 0, avgScore: 0 };
      }
      studioScores[studio.name].dropped++;
    }
  }

  // Determine studio preferences
  for (const [studio, scores] of Object.entries(studioScores)) {
    if (scores.completed > 0) {
      scores.avgScore /= scores.completed;
    }

    if (scores.completed >= 3 && scores.dropped === 0 && scores.avgScore >= 7.5) {
      rules.whitelistedStudios.push(studio);
    } else if (scores.dropped >= 3 && scores.completed <= 1) {
      rules.blacklistedStudios.push(studio);
    }
  }

  // Genre analysis
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

  // Determine genre preferences
  for (const [genre, scores] of Object.entries(genreScores)) {
    if (scores.completed > 0) {
      scores.avgScore /= scores.completed;
    }

    if (scores.completed >= 5 && scores.avgScore >= 7.5) {
      rules.whitelistedGenres.push(genre);
    } else if (scores.dropped >= 3 && scores.completed <= 1) {
      rules.blacklistedGenres.push(genre);
    }
  }

  return rules;
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

function calculateInitialConfidence(
  entries: any[],
  feedback: { likes: number[]; dislikes: number[] }
): number {
  let confidence = 0;

  // Entry contribution (up to 0.4)
  const entryScore = Math.min(entries.length / 50, 1) * 0.4;
  confidence += entryScore;

  // Completed contribution (up to 0.2)
  const completed = entries.filter((e: any) => e.status === 'COMPLETED').length;
  const completedScore = Math.min(completed / 30, 1) * 0.2;
  confidence += completedScore;

  // Feedback contribution (up to 0.3)
  const totalFeedback = feedback.likes.length + feedback.dislikes.length;
  const feedbackScore = Math.min(totalFeedback / 20, 1) * 0.3;
  confidence += feedbackScore;

  // Base (0.1)
  if (entries.length > 0) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDefaultMetrics() {
  const { DEFAULT_BEHAVIORAL_METRICS } = require('./dream-types');
  return { ...DEFAULT_BEHAVIORAL_METRICS };
}

function createFallbackProfile(userName: string): DreamProfile {
  return {
    userId: userName,
    version: 1,
    weights: { ...DEFAULT_DYNAMIC_WEIGHTS },
    metrics: getDefaultMetrics(),
    rules: { ...DEFAULT_SEMANTIC_RULES },
    clusters: { ...DEFAULT_DISCOVERED_CLUSTERS },
    learning: { ...DEFAULT_LEARNING_HISTORY },
    lastUpdated: Date.now(),
    confidenceLevel: 0.1
  };
}

// =============================================================================
// MIGRATION STATUS
// =============================================================================

export async function getMigrationStatus(userName: string): Promise<MigrationStatus> {
  const storage = getStorage();
  const key = STORAGE_KEYS.migrationStatus(userName);

  const status = await storage.get(key) as MigrationStatusData | null;

  if (!status) {
    return 'not_started';
  }

  return status.status;
}

export async function setMigrationStatus(
  userName: string,
  status: MigrationStatus
): Promise<void> {
  const storage = getStorage();
  const key = STORAGE_KEYS.migrationStatus(userName);

  await storage.set(key, {
    status,
    timestamp: Date.now()
  });
}

export type MigrationStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';

interface MigrationStatusData {
  status: MigrationStatus;
  timestamp: number;
}

// =============================================================================
// ROLLBACK
// =============================================================================

/**
 * Revert to V3 by deleting Dream profile
 */
export async function revertToV3(userName: string): Promise<boolean> {
  console.log(`[Migration] Reverting ${userName} to V3...`);

  try {
    const storage = getStorage();

    // Delete Dream profile
    await storage.set(STORAGE_KEYS.profile(userName), null);

    // Delete clusters
    await storage.set(STORAGE_KEYS.clusters(userName), null);

    // Delete learning log
    await storage.set(STORAGE_KEYS.learningLog(userName), null);

    // Reset migration status
    await setMigrationStatus(userName, 'not_started');

    console.log(`[Migration] Reverted to V3 successfully`);
    return true;

  } catch (error) {
    console.error(`[Migration] Revert failed:`, error);
    return false;
  }
}

/**
 * Check if user can revert to V3
 */
export async function canRevertToV3(userName: string): Promise<boolean> {
  const storage = getStorage();
  const backupKey = STORAGE_KEYS.v3Backup(userName);
  const backup = await storage.get(backupKey);
  return backup !== null;
}

// =============================================================================
// AUTO-MIGRATION CHECK
// =============================================================================

/**
 * Check if user needs migration and perform if needed
 */
export async function checkAndMigrate(userName: string): Promise<{
  needsMigration: boolean;
  migrated: boolean;
  profile: DreamProfile | null;
}> {
  // Check if Dream profile exists
  const existingProfile = await loadDreamProfile(userName);

  if (existingProfile) {
    return {
      needsMigration: false,
      migrated: false,
      profile: existingProfile
    };
  }

  // Check migration status
  const status = await getMigrationStatus(userName);

  if (status === 'complete') {
    // Migration complete but profile missing? Re-migrate
    console.log(`[Migration] Profile missing after complete status, re-migrating...`);
  }

  // Perform migration
  const result = await migrateV3ToDream(userName);

  return {
    needsMigration: true,
    migrated: result.success,
    profile: result.success ? result.dreamProfile : null
  };
}
