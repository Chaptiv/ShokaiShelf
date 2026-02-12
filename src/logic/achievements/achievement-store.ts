// Achievement Storage - localStorage based
import type { AchievementStore, UnlockedAchievement } from './achievement-types';

const STORAGE_KEY = 'shokai.achievements';

const DEFAULT_STORE: AchievementStore = {
  unlocked: [],
  progress: {},
  lastChecked: 0,
  streaks: {
    watchStreak: 0,
    lastWatchDate: null,
    appOpenStreak: 0,
    lastAppOpenDate: null,
  },
};

// Get the current store
export function getAchievementStore(): AchievementStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_STORE };

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_STORE,
      ...parsed,
      streaks: { ...DEFAULT_STORE.streaks, ...parsed.streaks },
    };
  } catch (e) {
    console.error('[AchievementStore] Failed to load:', e);
    return { ...DEFAULT_STORE };
  }
}

// Save the store
export function saveAchievementStore(store: AchievementStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('[AchievementStore] Failed to save:', e);
  }
}

// Check if achievement is unlocked
export function isAchievementUnlocked(achievementId: string): boolean {
  const store = getAchievementStore();
  return store.unlocked.some(a => a.id === achievementId);
}

// Unlock an achievement
export function unlockAchievement(achievementId: string): UnlockedAchievement | null {
  const store = getAchievementStore();

  // Already unlocked
  if (store.unlocked.some(a => a.id === achievementId)) {
    return null;
  }

  const unlocked: UnlockedAchievement = {
    id: achievementId,
    unlockedAt: Date.now(),
  };

  store.unlocked.push(unlocked);
  store.lastChecked = Date.now();
  saveAchievementStore(store);

  console.log('[AchievementStore] Unlocked:', achievementId);
  return unlocked;
}

// Get all unlocked achievements
export function getUnlockedAchievements(): UnlockedAchievement[] {
  return getAchievementStore().unlocked;
}

// Get all defined achievements (wrapper)
import { ACHIEVEMENTS } from './achievement-definitions';
export function getAllAchievements() {
  return ACHIEVEMENTS;
}

// Update progress for an achievement
export function updateProgress(achievementId: string, value: number): void {
  const store = getAchievementStore();
  store.progress[achievementId] = value;
  saveAchievementStore(store);
}

// Get progress for an achievement
export function getProgress(achievementId: string): number {
  return getAchievementStore().progress[achievementId] ?? 0;
}

// Update watch streak
export function updateWatchStreak(): number {
  const store = getAchievementStore();
  const today = new Date().toISOString().split('T')[0];

  if (store.streaks.lastWatchDate === today) {
    // Already watched today, no change
    return store.streaks.watchStreak;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (store.streaks.lastWatchDate === yesterday) {
    // Consecutive day
    store.streaks.watchStreak += 1;
  } else {
    // Streak broken or first watch
    store.streaks.watchStreak = 1;
  }

  store.streaks.lastWatchDate = today;
  saveAchievementStore(store);

  console.log('[AchievementStore] Watch streak:', store.streaks.watchStreak);
  return store.streaks.watchStreak;
}

// Update app open streak
export function updateAppOpenStreak(): number {
  const store = getAchievementStore();
  const today = new Date().toISOString().split('T')[0];

  if (store.streaks.lastAppOpenDate === today) {
    // Already opened today, no change
    return store.streaks.appOpenStreak;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (store.streaks.lastAppOpenDate === yesterday) {
    // Consecutive day
    store.streaks.appOpenStreak += 1;
  } else {
    // Streak broken or first open
    store.streaks.appOpenStreak = 1;
  }

  store.streaks.lastAppOpenDate = today;
  saveAchievementStore(store);

  console.log('[AchievementStore] App open streak:', store.streaks.appOpenStreak);
  return store.streaks.appOpenStreak;
}

// Get current streaks
export function getStreaks() {
  const store = getAchievementStore();
  return store.streaks;
}

// Clear all achievements (for testing)
export function clearAchievements(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[AchievementStore] Cleared all achievements');
}
