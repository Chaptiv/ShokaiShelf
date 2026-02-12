// Achievement System Types

export type AchievementCategory = 'watching' | 'genre' | 'streak' | 'special';

export interface AchievementRequirement {
  type: 'count' | 'streak' | 'genre' | 'time' | 'custom';
  target: number;
  genreName?: string; // For genre achievements
  timeRange?: { start: number; end: number }; // For time-based (night owl, early bird)
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement: AchievementRequirement;
  hidden?: boolean; // Hidden until unlocked
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: number; // timestamp
}

export interface AchievementProgress {
  achievementId: string;
  current: number;
  target: number;
}

export interface AchievementStore {
  unlocked: UnlockedAchievement[];
  progress: Record<string, number>;
  lastChecked: number;
  streaks: {
    watchStreak: number;
    lastWatchDate: string | null; // ISO date
    appOpenStreak: number;
    lastAppOpenDate: string | null;
  };
}

// User data passed to achievement checks
export interface UserAchievementData {
  // Completed anime count
  completedCount: number;

  // Genre counts
  genreCounts: Record<string, number>;

  // Episode watching data
  episodesWatchedToday: number;
  lastEpisodeTime: number | null; // timestamp

  // Scores
  perfectScoreCount: number; // 10/10 anime

  // Hidden gems (low popularity anime completed)
  hiddenGemsCount: number;

  // Streaks
  watchStreak: number;
  appOpenStreak: number;

  // Time-based
  nightOwlEpisodes: number; // Episodes watched after 23:00
  earlyBirdEpisodes: number; // Episodes watched before 07:00
}

// Event types that can trigger achievement checks
export type AchievementEvent =
  | { type: 'anime_completed'; mediaId: number; genres: string[]; score?: number; popularity?: number }
  | { type: 'episode_watched'; mediaId: number; episode: number; timestamp: number }
  | { type: 'app_opened'; timestamp: number }
  | { type: 'library_synced'; data: UserAchievementData };
