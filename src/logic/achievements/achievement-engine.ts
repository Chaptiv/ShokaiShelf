// Achievement Engine - Checks and unlocks achievements
import type { AchievementEvent, UserAchievementData, AchievementDefinition, UnlockedAchievement } from './achievement-types';
import { ACHIEVEMENTS, getAchievementById } from './achievement-definitions';
import {
  isAchievementUnlocked,
  unlockAchievement,
  getProgress,
  updateProgress,
  updateWatchStreak,
  updateAppOpenStreak,
  getStreaks,
} from './achievement-store';

// Callback for when achievements are unlocked
type AchievementUnlockCallback = (achievement: AchievementDefinition, unlocked: UnlockedAchievement) => void;

let unlockCallback: AchievementUnlockCallback | null = null;

// Set the callback for achievement unlocks
export function onAchievementUnlock(callback: AchievementUnlockCallback): void {
  unlockCallback = callback;
}

// Process an achievement event
export async function processEvent(event: AchievementEvent): Promise<AchievementDefinition[]> {
  const newlyUnlocked: AchievementDefinition[] = [];

  switch (event.type) {
    case 'anime_completed':
      newlyUnlocked.push(...checkCompletionAchievements(event));
      newlyUnlocked.push(...checkGenreAchievements(event.genres));
      if (event.score === 100 || event.score === 10) {
        newlyUnlocked.push(...checkPerfectScoreAchievements());
      }
      if (event.popularity && event.popularity < 10000) {
        newlyUnlocked.push(...checkHiddenGemAchievements());
      }
      newlyUnlocked.push(...checkSpecialDateAchievements());
      break;

    case 'episode_watched':
      const watchStreak = updateWatchStreak();
      newlyUnlocked.push(...checkStreakAchievements('watch', watchStreak));
      newlyUnlocked.push(...checkBingeAchievements());
      newlyUnlocked.push(...checkTimeAchievements(event.timestamp));
      break;

    case 'app_opened':
      const appStreak = updateAppOpenStreak();
      newlyUnlocked.push(...checkStreakAchievements('app', appStreak));
      break;

    case 'library_synced':
      newlyUnlocked.push(...checkAllAchievements(event.data));
      break;
  }

  return newlyUnlocked;
}

// Check completion count achievements
function checkCompletionAchievements(event: AchievementEvent & { type: 'anime_completed' }): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  const completionAchievements = ['first_complete', 'ten_complete', 'fifty_complete', 'hundred_complete', 'two_hundred_complete'];

  for (const id of completionAchievements) {
    if (isAchievementUnlocked(id)) continue;

    const currentCount = getProgress('completed_count') + 1;
    updateProgress('completed_count', currentCount);

    const achievement = getAchievementById(id);
    if (achievement && currentCount >= achievement.requirement.target) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Check genre achievements
function checkGenreAchievements(genres: string[]): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];

  for (const genre of genres) {
    const progressKey = `genre_${genre.toLowerCase().replace(/\s+/g, '_')}`;
    const currentCount = getProgress(progressKey) + 1;
    updateProgress(progressKey, currentCount);

    // Check all genre achievements
    const genreAchievements = ACHIEVEMENTS.filter(
      a => a.category === 'genre' &&
           a.requirement.type === 'genre' &&
           a.requirement.genreName?.toLowerCase() === genre.toLowerCase()
    );

    for (const achievement of genreAchievements) {
      if (isAchievementUnlocked(achievement.id)) continue;
      if (currentCount >= achievement.requirement.target) {
        const result = tryUnlock(achievement);
        if (result) unlocked.push(result);
      }
    }
  }

  // Check variety achievement
  const uniqueGenres = countUniqueGenres();
  const varietyAchievement = getAchievementById('variety_10');
  if (varietyAchievement && !isAchievementUnlocked('variety_10') && uniqueGenres >= 10) {
    const result = tryUnlock(varietyAchievement);
    if (result) unlocked.push(result);
  }

  return unlocked;
}

// Count unique genres with at least 1 completed anime
function countUniqueGenres(): number {
  let count = 0;
  const genreKeys = Object.keys(localStorage).filter(k => k.startsWith('shokai.achievements'));

  try {
    const stored = localStorage.getItem('shokai.achievements');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.progress) {
        count = Object.keys(data.progress).filter(k => k.startsWith('genre_') && data.progress[k] > 0).length;
      }
    }
  } catch (e) {
    // Ignore
  }

  return count;
}

// Check streak achievements
function checkStreakAchievements(type: 'watch' | 'app', streak: number): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];

  const streakAchievements = type === 'watch'
    ? ['daily_3', 'daily_7', 'daily_14', 'daily_30', 'daily_100']
    : ['app_daily_7', 'app_daily_30'];

  for (const id of streakAchievements) {
    if (isAchievementUnlocked(id)) continue;

    const achievement = getAchievementById(id);
    if (achievement && streak >= achievement.requirement.target) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Check binge achievements
function checkBingeAchievements(): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  const today = new Date().toISOString().split('T')[0];
  const progressKey = `binge_${today}`;

  const currentCount = getProgress(progressKey) + 1;
  updateProgress(progressKey, currentCount);

  const bingeAchievements = ['binge_12', 'binge_24', 'binge_48'];

  for (const id of bingeAchievements) {
    if (isAchievementUnlocked(id)) continue;

    const achievement = getAchievementById(id);
    if (achievement && currentCount >= achievement.requirement.target) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Check time-based achievements (night owl, early bird)
function checkTimeAchievements(timestamp: number): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  const hour = new Date(timestamp).getHours();

  // Night owl: 23:00 - 05:00
  if (hour >= 23 || hour < 5) {
    const currentCount = getProgress('night_owl_count') + 1;
    updateProgress('night_owl_count', currentCount);

    if (!isAchievementUnlocked('night_owl') && currentCount >= 10) {
      const achievement = getAchievementById('night_owl');
      if (achievement) {
        const result = tryUnlock(achievement);
        if (result) unlocked.push(result);
      }
    }
  }

  // Early bird: 04:00 - 07:00
  if (hour >= 4 && hour < 7) {
    const currentCount = getProgress('early_bird_count') + 1;
    updateProgress('early_bird_count', currentCount);

    if (!isAchievementUnlocked('early_bird') && currentCount >= 10) {
      const achievement = getAchievementById('early_bird');
      if (achievement) {
        const result = tryUnlock(achievement);
        if (result) unlocked.push(result);
      }
    }
  }

  return unlocked;
}

// Check perfect score achievements
function checkPerfectScoreAchievements(): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  const currentCount = getProgress('perfect_score_count') + 1;
  updateProgress('perfect_score_count', currentCount);

  const achievements = ['perfectionist_5', 'perfectionist_10'];

  for (const id of achievements) {
    if (isAchievementUnlocked(id)) continue;

    const achievement = getAchievementById(id);
    if (achievement && currentCount >= achievement.requirement.target) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Check hidden gem achievements
function checkHiddenGemAchievements(): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  const currentCount = getProgress('hidden_gem_count') + 1;
  updateProgress('hidden_gem_count', currentCount);

  const achievements = ['explorer_5', 'explorer_10'];

  for (const id of achievements) {
    if (isAchievementUnlocked(id)) continue;

    const achievement = getAchievementById(id);
    if (achievement && currentCount >= achievement.requirement.target) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Check special date achievements
function checkSpecialDateAchievements(): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // New Year's Day
  if (month === 1 && day === 1 && !isAchievementUnlocked('new_year')) {
    const achievement = getAchievementById('new_year');
    if (achievement) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  // Christmas
  if (month === 12 && day === 25 && !isAchievementUnlocked('christmas_watch')) {
    const achievement = getAchievementById('christmas_watch');
    if (achievement) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Check all achievements based on full user data
function checkAllAchievements(data: UserAchievementData): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];

  // Update all progress from synced data
  updateProgress('completed_count', data.completedCount);
  updateProgress('perfect_score_count', data.perfectScoreCount);
  updateProgress('hidden_gem_count', data.hiddenGemsCount);
  updateProgress('night_owl_count', data.nightOwlEpisodes);
  updateProgress('early_bird_count', data.earlyBirdEpisodes);

  for (const [genre, count] of Object.entries(data.genreCounts)) {
    const progressKey = `genre_${genre.toLowerCase().replace(/\s+/g, '_')}`;
    updateProgress(progressKey, count);
  }

  // Check all achievements
  for (const achievement of ACHIEVEMENTS) {
    if (isAchievementUnlocked(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.id) {
      case 'first_complete':
      case 'ten_complete':
      case 'fifty_complete':
      case 'hundred_complete':
      case 'two_hundred_complete':
        shouldUnlock = data.completedCount >= achievement.requirement.target;
        break;

      case 'perfectionist_5':
      case 'perfectionist_10':
        shouldUnlock = data.perfectScoreCount >= achievement.requirement.target;
        break;

      case 'explorer_5':
      case 'explorer_10':
        shouldUnlock = data.hiddenGemsCount >= achievement.requirement.target;
        break;

      case 'night_owl':
        shouldUnlock = data.nightOwlEpisodes >= achievement.requirement.target;
        break;

      case 'early_bird':
        shouldUnlock = data.earlyBirdEpisodes >= achievement.requirement.target;
        break;

      case 'variety_10':
        shouldUnlock = Object.keys(data.genreCounts).filter(g => data.genreCounts[g] > 0).length >= 10;
        break;

      case 'daily_3':
      case 'daily_7':
      case 'daily_14':
      case 'daily_30':
      case 'daily_100':
        shouldUnlock = data.watchStreak >= achievement.requirement.target;
        break;

      case 'app_daily_7':
      case 'app_daily_30':
        shouldUnlock = data.appOpenStreak >= achievement.requirement.target;
        break;

      default:
        // Genre achievements
        if (achievement.category === 'genre' && achievement.requirement.genreName) {
          const genreCount = data.genreCounts[achievement.requirement.genreName] ?? 0;
          shouldUnlock = genreCount >= achievement.requirement.target;
        }
    }

    if (shouldUnlock) {
      const result = tryUnlock(achievement);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

// Try to unlock an achievement
function tryUnlock(achievement: AchievementDefinition): AchievementDefinition | null {
  const result = unlockAchievement(achievement.id);

  if (result && unlockCallback) {
    unlockCallback(achievement, result);
  }

  return result ? achievement : null;
}

// Get achievement progress for display
export function getAchievementProgress(achievementId: string): { current: number; target: number } {
  const achievement = getAchievementById(achievementId);
  if (!achievement) return { current: 0, target: 0 };

  let current = 0;
  const target = achievement.requirement.target;

  switch (achievementId) {
    case 'first_complete':
    case 'ten_complete':
    case 'fifty_complete':
    case 'hundred_complete':
    case 'two_hundred_complete':
      current = getProgress('completed_count');
      break;

    case 'perfectionist_5':
    case 'perfectionist_10':
      current = getProgress('perfect_score_count');
      break;

    case 'explorer_5':
    case 'explorer_10':
      current = getProgress('hidden_gem_count');
      break;

    case 'night_owl':
      current = getProgress('night_owl_count');
      break;

    case 'early_bird':
      current = getProgress('early_bird_count');
      break;

    case 'variety_10':
      current = countUniqueGenres();
      break;

    case 'daily_3':
    case 'daily_7':
    case 'daily_14':
    case 'daily_30':
    case 'daily_100':
      current = getStreaks().watchStreak;
      break;

    case 'app_daily_7':
    case 'app_daily_30':
      current = getStreaks().appOpenStreak;
      break;

    case 'binge_12':
    case 'binge_24':
    case 'binge_48':
      const today = new Date().toISOString().split('T')[0];
      current = getProgress(`binge_${today}`);
      break;

    default:
      // Genre achievements
      if (achievement.category === 'genre' && achievement.requirement.genreName) {
        const progressKey = `genre_${achievement.requirement.genreName.toLowerCase().replace(/\s+/g, '_')}`;
        current = getProgress(progressKey);
      }
  }

  return { current, target };
}

// Re-export for convenience
export { ACHIEVEMENTS, getAchievementById, getAchievementsByCategory } from './achievement-definitions';
export { isAchievementUnlocked, getUnlockedAchievements } from './achievement-store';

// Sync achievements with historical data
export function syncAchievementsWithHistory(entries: any[]): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];

  // Calculate historical data
  let completedCount = 0;
  let perfectScoreCount = 0;
  let hiddenGemsCount = 0;
  const genreCounts: Record<string, number> = {};
  
  // We can't easily reconstruct streaks or precise watch times from just the list
  // so we'll focus on what we can prove: completion, genres, scores.

  for (const entry of entries) {
    // Check completion
    if (entry.status === 'COMPLETED') {
      completedCount++;
      
      // Check genres
      if (entry.media?.genres) {
        for (const genre of entry.media.genres) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      }

      // Check scores (AniList 0-100 or 0-10)
      const score = entry.score || 0;
      if (score === 10 || score === 100) {
        perfectScoreCount++;
      }

      // Check popularity
      if (entry.media?.popularity && entry.media.popularity < 10000) {
        hiddenGemsCount++;
      }
    }
  }

  const data: UserAchievementData = {
    completedCount,
    genreCounts,
    perfectScoreCount,
    hiddenGemsCount,
    // Defaults for things we can't prove from history
    episodesWatchedToday: 0,
    lastEpisodeTime: null,
    watchStreak: 0,
    appOpenStreak: 0,
    nightOwlEpisodes: 0,
    earlyBirdEpisodes: 0
  };

  unlocked.push(...checkAllAchievements(data));
  return unlocked;
}
