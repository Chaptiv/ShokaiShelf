// ShokaiShelf Echo - Engine
// Generates the ultimate personalized anime recap

import type {
  EchoData,
  EchoPeriodType,
  EchoAnimeEntry,
  EchoAvailablePeriods,
  EchoUserProfile,
  EchoTopAnime,
  EchoGenreAffinity,
  EchoStudioStats,
  EchoHiddenGem,
  EchoMilestone,
  EchoScoreDistribution,
  EchoWatchPattern,
} from './echo-types';
import { GENRE_STYLES, PERSONAS } from './echo-types';
import { generateEchoFunFacts } from './echo-fun-facts';
import { devLog, devWarn, logError } from "@utils/logger";


// =============================================================================
// MAIN GENERATION
// =============================================================================

export async function generateEcho(
  user: EchoUserProfile,
  period: string,
  type: EchoPeriodType,
  entries: EchoAnimeEntry[],
  allEntries: EchoAnimeEntry[]
): Promise<EchoData> {
  // Filter entries by period
  const periodEntries = filterEntriesByPeriod(entries, period, type);

  // Core stats
  const stats = calculateCoreStats(periodEntries);

  // Top Anime
  const topAnime = calculateTopAnime(periodEntries);

  // Genre Analysis
  const genres = calculateGenreAffinity(periodEntries, allEntries, period, type);
  const genreVariety = Math.min(10, Math.round(genres.length * 1.5));
  const dominantMood = determineDominantMood(genres);

  // Studio Stats
  const topStudios = calculateStudioStats(periodEntries);
  const studioLoyalty = calculateStudioLoyalty(periodEntries);

  // Watch Patterns
  const watchPattern = analyzeWatchPattern(periodEntries);

  // Score Distribution
  const scoreDistribution = analyzeScoreDistribution(periodEntries);

  // Discoveries
  const hiddenGems = findHiddenGems(periodEntries);
  const newGenres = findNewGenres(periodEntries, allEntries, period, type);
  const newStudios = findNewStudios(periodEntries, allEntries, period, type);

  // Highlights
  const longestBinge = findLongestBinge(periodEntries);
  const fastestFinish = findFastestFinish(periodEntries);
  const biggestSurprise = findBiggestSurprise(periodEntries);

  // Persona
  const persona = determinePersona(
    stats,
    genres,
    watchPattern,
    scoreDistribution,
    periodEntries.length
  );

  // Milestones
  const milestones = calculateMilestones(periodEntries, allEntries, period);

  // Comparison
  const comparison = calculateComparison(entries, period, type, stats);

  // Anime of the Period
  const animeOfThePeriod = determineAnimeOfPeriod(periodEntries, topAnime);

  // Build Echo Data
  const echoData: EchoData = {
    period,
    type,
    generatedAt: Date.now(),
    user,
    stats,
    topAnime,
    genres,
    genreVariety,
    dominantMood,
    topStudios,
    studioLoyalty,
    watchPattern,
    scoreDistribution,
    hiddenGems,
    newGenres,
    newStudios,
    longestBinge,
    fastestFinish,
    biggestSurprise,
    persona,
    milestones,
    funFacts: [],
    comparison,
    animeOfThePeriod,
  };

  // Generate fun facts
  echoData.funFacts = generateEchoFunFacts(echoData);

  return echoData;
}

// =============================================================================
// CORE STATS
// =============================================================================

function calculateCoreStats(entries: EchoAnimeEntry[]) {
  const completed = entries.filter(e => e.status === 'COMPLETED');
  const started = entries.filter(e => e.status === 'CURRENT');
  const dropped = entries.filter(e => e.status === 'DROPPED');
  const paused = entries.filter(e => e.status === 'PAUSED');

  let episodesWatched = 0;
  let minutesWatched = 0;

  for (const entry of entries) {
    const eps = entry.status === 'COMPLETED' && entry.episodes
      ? entry.episodes
      : entry.progress;
    episodesWatched += eps;

    // Calculate minutes (default 24 min per episode if duration unknown)
    const duration = entry.duration || 24;
    minutesWatched += eps * duration;
  }

  const hoursWatched = Math.round(minutesWatched / 60);
  const totalAnime = entries.length;
  const completionRate = totalAnime > 0
    ? Math.round((completed.length / totalAnime) * 100)
    : 0;

  return {
    episodesWatched,
    hoursWatched,
    minutesWatched,
    animeCompleted: completed.length,
    animeStarted: started.length,
    animeDropped: dropped.length,
    animePaused: paused.length,
    totalAnime,
    completionRate,
  };
}

// =============================================================================
// TOP ANIME
// =============================================================================

function calculateTopAnime(entries: EchoAnimeEntry[]): EchoTopAnime[] {
  const completed = entries.filter(e => e.status === 'COMPLETED' && e.score > 0);

  if (completed.length === 0) return [];

  // Sort by score, then by episodes (for tie-breaking)
  const sorted = completed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.episodes || 0) - (a.episodes || 0);
  });

  return sorted.slice(0, 5).map((entry, index) => ({
    mediaId: entry.mediaId,
    title: entry.title,
    coverImage: entry.coverImage,
    score: entry.score,
    episodes: entry.episodes || entry.progress,
    genres: entry.genres.slice(0, 3),
    completedAt: entry.completedAt
      ? `${entry.completedAt.year}-${String(entry.completedAt.month || 1).padStart(2, '0')}`
      : null,
    reason: index === 0 ? 'highest_rated' as const : 'highest_rated' as const,
  }));
}

// =============================================================================
// GENRE ANALYSIS
// =============================================================================

function calculateGenreAffinity(
  periodEntries: EchoAnimeEntry[],
  allEntries: EchoAnimeEntry[],
  period: string,
  type: EchoPeriodType
): EchoGenreAffinity[] {
  const genreCounts: Record<string, number> = {};
  let total = 0;

  for (const entry of periodEntries) {
    for (const genre of entry.genres) {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      total++;
    }
  }

  // If no genres found, return empty array
  if (total === 0) {
    devWarn('[Echo] No genres found in period entries');
    return [];
  }

  // Calculate previous period counts for growth
  const prevPeriod = getPreviousPeriod(period, type);
  const prevEntries = prevPeriod ? filterEntriesByPeriod(allEntries, prevPeriod, type) : [];
  const prevCounts: Record<string, number> = {};
  for (const entry of prevEntries) {
    for (const genre of entry.genres) {
      prevCounts[genre] = (prevCounts[genre] || 0) + 1;
    }
  }

  return Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => {
      const style = GENRE_STYLES[name] || { emoji: '📺', color: '#6b7280' };
      const prevCount = prevCounts[name] || 0;
      const growth = prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : 0;

      return {
        name,
        count,
        percentage: Math.round((count / total) * 100),
        emoji: style.emoji,
        color: style.color,
        growth,
      };
    });
}

function determineDominantMood(genres: EchoGenreAffinity[]): string {
  if (genres.length === 0) return 'Balanced';

  const top = genres[0]?.name;
  const moodMap: Record<string, string> = {
    Action: 'Action-Packed',
    Adventure: 'Epic Journey',
    Comedy: 'Laughter Mode',
    Drama: 'Deep & Emotional',
    Romance: 'Love is in the Air',
    'Slice of Life': 'Cozy Vibes',
    Horror: 'Spooky Season',
    Thriller: 'Edge of Seat',
    'Sci-Fi': 'Futuristic',
    Fantasy: 'Magical',
    Mystery: 'Detective Mode',
    Sports: 'Competitive Spirit',
  };

  return moodMap[top] || 'Eclectic Taste';
}

// =============================================================================
// STUDIO STATS
// =============================================================================

function calculateStudioStats(entries: EchoAnimeEntry[]): EchoStudioStats[] {
  const studioData: Record<string, { count: number; anime: EchoAnimeEntry[] }> = {};

  for (const entry of entries) {
    for (const studio of entry.studios) {
      if (!studioData[studio]) {
        studioData[studio] = { count: 0, anime: [] };
      }
      studioData[studio].count++;
      studioData[studio].anime.push(entry);
    }
  }

  return Object.entries(studioData)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data], index) => ({
      name,
      count: data.count,
      topAnime: data.anime
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(e => ({ title: e.title, coverImage: e.coverImage })),
      isFavorite: index === 0 && data.count >= 3,
    }));
}

function calculateStudioLoyalty(entries: EchoAnimeEntry[]): number {
  if (entries.length === 0) return 0;

  const studioCounts: Record<string, number> = {};
  for (const entry of entries) {
    for (const studio of entry.studios) {
      studioCounts[studio] = (studioCounts[studio] || 0) + 1;
    }
  }

  const counts = Object.values(studioCounts);
  if (counts.length === 0) return 0;

  const max = Math.max(...counts);
  const total = entries.length;

  return Math.round((max / total) * 100);
}

// =============================================================================
// WATCH PATTERNS
// =============================================================================

function analyzeWatchPattern(entries: EchoAnimeEntry[]): EchoWatchPattern {
  // Simulate watch patterns based on updatedAt timestamps
  const hourCounts: number[] = new Array(24).fill(0);
  const dayCounts: Record<string, number> = {
    Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0,
    Thursday: 0, Friday: 0, Saturday: 0,
  };

  let consecutiveDays = 0;
  let maxStreak = 0;
  const watchDates = new Set<string>();

  for (const entry of entries) {
    if (entry.updatedAt) {
      const date = new Date(entry.updatedAt * 1000);
      const hour = date.getHours();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      hourCounts[hour]++;
      dayCounts[dayName]++;
      watchDates.add(date.toISOString().split('T')[0]);
    }
  }

  // Calculate streak
  const sortedDates = Array.from(watchDates).sort();
  let currentStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  // Night owl score (22:00 - 04:00)
  const nightHours = hourCounts.slice(22).reduce((a, b) => a + b, 0) + hourCounts.slice(0, 5).reduce((a, b) => a + b, 0);
  const totalWatches = hourCounts.reduce((a, b) => a + b, 0);
  const nightOwlScore = totalWatches > 0 ? Math.round((nightHours / totalWatches) * 100) : 0;

  // Weekend warrior
  const weekendWatches = (dayCounts.Saturday || 0) + (dayCounts.Sunday || 0);
  const weekendWarrior = totalWatches > 0 && weekendWatches / totalWatches > 0.5;

  return {
    peakHour,
    peakDay,
    nightOwlScore,
    weekendWarrior,
    bingeStreak: maxStreak,
  };
}

// =============================================================================
// SCORE ANALYSIS
// =============================================================================

function analyzeScoreDistribution(entries: EchoAnimeEntry[]): EchoScoreDistribution {
  const scored = entries.filter(e => e.score > 0);

  if (scored.length === 0) {
    return {
      average: 0,
      distribution: [],
      perfectScores: 0,
      harshCritic: false,
      easilyPleased: false,
    };
  }

  const distribution: Record<number, number> = {};
  let sum = 0;

  for (const entry of scored) {
    const score = Math.round(entry.score);
    distribution[score] = (distribution[score] || 0) + 1;
    sum += entry.score;
  }

  const average = Math.round((sum / scored.length) * 10) / 10;
  const perfectScores = scored.filter(e => e.score >= 10).length;

  return {
    average,
    distribution: Object.entries(distribution)
      .map(([score, count]) => ({ score: parseInt(score), count }))
      .sort((a, b) => a.score - b.score),
    perfectScores,
    harshCritic: average < 6,
    easilyPleased: average > 8,
  };
}

// =============================================================================
// DISCOVERIES
// =============================================================================

function findHiddenGems(entries: EchoAnimeEntry[]): EchoHiddenGem[] {
  return entries
    .filter(e =>
      e.score >= 8 &&
      e.popularity !== null &&
      e.popularity < 50000 &&
      e.averageScore !== null
    )
    .sort((a, b) => (a.popularity || 0) - (b.popularity || 0))
    .slice(0, 3)
    .map(e => ({
      mediaId: e.mediaId,
      title: e.title,
      coverImage: e.coverImage,
      yourScore: e.score,
      popularity: e.popularity || 0,
      averageScore: e.averageScore || 0,
    }));
}

function findNewGenres(
  periodEntries: EchoAnimeEntry[],
  allEntries: EchoAnimeEntry[],
  period: string,
  type: EchoPeriodType
): string[] {
  const previousGenres = new Set<string>();

  for (const entry of allEntries) {
    if (!isInPeriod(entry, period, type) && !isAfterPeriod(entry, period, type)) {
      for (const genre of entry.genres) {
        previousGenres.add(genre);
      }
    }
  }

  const newGenres = new Set<string>();
  for (const entry of periodEntries) {
    for (const genre of entry.genres) {
      if (!previousGenres.has(genre)) {
        newGenres.add(genre);
      }
    }
  }

  return Array.from(newGenres);
}

function findNewStudios(
  periodEntries: EchoAnimeEntry[],
  allEntries: EchoAnimeEntry[],
  period: string,
  type: EchoPeriodType
): string[] {
  const previousStudios = new Set<string>();

  for (const entry of allEntries) {
    if (!isInPeriod(entry, period, type) && !isAfterPeriod(entry, period, type)) {
      for (const studio of entry.studios) {
        previousStudios.add(studio);
      }
    }
  }

  const newStudios = new Set<string>();
  for (const entry of periodEntries) {
    for (const studio of entry.studios) {
      if (!previousStudios.has(studio)) {
        newStudios.add(studio);
      }
    }
  }

  return Array.from(newStudios).slice(0, 5);
}

// =============================================================================
// HIGHLIGHTS
// =============================================================================

function findLongestBinge(entries: EchoAnimeEntry[]) {
  const completed = entries
    .filter(e => e.status === 'COMPLETED' && e.episodes)
    .sort((a, b) => (b.episodes || 0) - (a.episodes || 0));

  if (completed.length === 0) return null;

  const top = completed[0];
  return {
    anime: top.title,
    episodes: top.episodes || top.progress,
    coverImage: top.coverImage,
  };
}

function findFastestFinish(entries: EchoAnimeEntry[]) {
  const completed = entries.filter(e =>
    e.status === 'COMPLETED' &&
    e.startedAt?.year && e.startedAt?.month && e.startedAt?.day &&
    e.completedAt?.year && e.completedAt?.month && e.completedAt?.day
  );

  if (completed.length === 0) return null;

  const withDays = completed.map(e => {
    const start = new Date(e.startedAt!.year!, e.startedAt!.month! - 1, e.startedAt!.day!);
    const end = new Date(e.completedAt!.year!, e.completedAt!.month! - 1, e.completedAt!.day!);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return { ...e, days: Math.max(1, days) };
  }).sort((a, b) => a.days - b.days);

  const fastest = withDays[0];
  return {
    anime: fastest.title,
    days: fastest.days,
    coverImage: fastest.coverImage,
  };
}

function findBiggestSurprise(entries: EchoAnimeEntry[]) {
  const surprises = entries
    .filter(e => e.score > 0 && e.averageScore !== null && e.averageScore > 0)
    .map(e => ({
      ...e,
      scoreDiff: e.score - (e.averageScore! / 10),
    }))
    .sort((a, b) => Math.abs(b.scoreDiff) - Math.abs(a.scoreDiff));

  if (surprises.length === 0) return null;

  const top = surprises[0];
  if (Math.abs(top.scoreDiff) < 1) return null; // Not surprising enough

  return {
    anime: top.title,
    expectedScore: Math.round(top.averageScore! / 10),
    actualScore: top.score,
    coverImage: top.coverImage,
  };
}

// =============================================================================
// PERSONA
// =============================================================================

function determinePersona(
  stats: ReturnType<typeof calculateCoreStats>,
  genres: EchoGenreAffinity[],
  watchPattern: EchoWatchPattern,
  scoreDistribution: EchoScoreDistribution,
  entryCount: number
) {
  const topGenre = genres[0]?.name;

  // Night Owl
  if (watchPattern.nightOwlScore > 60) {
    return {
      ...PERSONAS.nightOwl,
      description: 'Sleep is for the weak. You know the magic of late-night anime sessions.',
    };
  }

  // Binge Monster
  if (stats.episodesWatched > 200 && stats.animeCompleted > 8) {
    return {
      ...PERSONAS.bingeMonster,
      description: 'Just one more episode... and suddenly the sun is rising. You are unstoppable.',
    };
  }

  // Curator / Harsh Critic
  if (scoreDistribution.harshCritic && stats.animeDropped > stats.animeCompleted * 0.3) {
    return {
      ...PERSONAS.curator,
      description: 'You have refined taste and zero tolerance for mediocrity. Time is precious.',
    };
  }

  // Completionist
  if (stats.completionRate > 85 && stats.animeDropped === 0) {
    return {
      ...PERSONAS.completionist,
      description: 'You finish what you start. Every anime deserves a fair chance.',
    };
  }

  // Explorer
  if (genres.length >= 6) {
    return {
      ...PERSONAS.explorer,
      description: 'Your taste knows no bounds. Every genre is an adventure waiting to happen.',
    };
  }

  // Genre-based personas
  if (topGenre === 'Action' && genres[0]?.percentage > 35) {
    return {
      ...PERSONAS.actionHero,
      description: 'You live for the hype. Training arcs, power-ups, and epic battles fuel your soul.',
    };
  }

  if (topGenre === 'Romance' && genres[0]?.percentage > 30) {
    return {
      ...PERSONAS.romantic,
      description: 'Love stories make your heart flutter. You believe in destined encounters.',
    };
  }

  if (topGenre === 'Slice of Life' && genres[0]?.percentage > 25) {
    return {
      ...PERSONAS.cozyVibes,
      description: 'No world-ending threats, just good vibes and healing moments.',
    };
  }

  // Default
  return {
    name: 'The Balanced Watcher',
    title: 'All-Rounder',
    emoji: '⚖️',
    color: '#6366f1',
    traits: ['Versatile', 'Open-minded', 'Balanced'],
    description: 'You appreciate all anime has to offer. A true connoisseur of the medium.',
  };
}

// =============================================================================
// MILESTONES
// =============================================================================

function calculateMilestones(
  periodEntries: EchoAnimeEntry[],
  allEntries: EchoAnimeEntry[],
  period: string
): EchoMilestone[] {
  const milestones: EchoMilestone[] = [];
  const now = Date.now();

  // Calculate totals
  const totalCompleted = allEntries.filter(e => e.status === 'COMPLETED').length;
  const periodCompleted = periodEntries.filter(e => e.status === 'COMPLETED').length;
  const previousTotal = totalCompleted - periodCompleted;

  // Check milestone thresholds
  const thresholds = [10, 25, 50, 100, 150, 200, 250, 300, 500, 1000];

  for (const threshold of thresholds) {
    if (previousTotal < threshold && totalCompleted >= threshold) {
      milestones.push({
        id: `completed_${threshold}`,
        title: `${threshold} Anime Club`,
        description: `Reached ${threshold} completed anime!`,
        icon: threshold >= 100 ? '🏆' : threshold >= 50 ? '🎖️' : '🎯',
        achievedAt: now,
      });
    }
  }

  // Episode milestones
  const totalEpisodes = allEntries.reduce((sum, e) =>
    sum + (e.status === 'COMPLETED' && e.episodes ? e.episodes : e.progress), 0);

  if (totalEpisodes >= 1000) {
    milestones.push({
      id: 'episodes_1000',
      title: 'Episode Veteran',
      description: 'Watched over 1,000 episodes!',
      icon: '📺',
      achievedAt: now,
    });
  }

  if (totalEpisodes >= 5000) {
    milestones.push({
      id: 'episodes_5000',
      title: 'Episode Legend',
      description: 'Watched over 5,000 episodes!',
      icon: '⭐',
      achievedAt: now,
    });
  }

  return milestones.slice(0, 3); // Max 3 milestones
}

// =============================================================================
// COMPARISON
// =============================================================================

function calculateComparison(
  entries: EchoAnimeEntry[],
  period: string,
  type: EchoPeriodType,
  currentStats: ReturnType<typeof calculateCoreStats>
) {
  const prevPeriod = getPreviousPeriod(period, type);
  if (!prevPeriod) return null;

  const prevEntries = filterEntriesByPeriod(entries, prevPeriod, type);
  const prevStats = calculateCoreStats(prevEntries);

  const episodesDelta = currentStats.episodesWatched - prevStats.episodesWatched;
  const hoursDelta = currentStats.hoursWatched - prevStats.hoursWatched;
  const completionDelta = currentStats.animeCompleted - prevStats.animeCompleted;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  let message = 'Consistent watching habits!';

  if (episodesDelta > 50) {
    trend = 'up';
    message = `${Math.abs(episodesDelta)} more episodes than last ${type === 'monthly' ? 'month' : 'year'}!`;
  } else if (episodesDelta < -50) {
    trend = 'down';
    message = `Taking it easier this ${type === 'monthly' ? 'month' : 'year'}`;
  }

  return {
    episodesDelta,
    hoursDelta,
    completionDelta,
    trend,
    message,
  };
}

// =============================================================================
// ANIME OF THE PERIOD
// =============================================================================

function determineAnimeOfPeriod(
  entries: EchoAnimeEntry[],
  topAnime: EchoTopAnime[]
) {
  if (topAnime.length === 0) return null;

  const winner = topAnime[0];
  const entry = entries.find(e => e.mediaId === winner.mediaId);

  if (!entry) return null;

  // Determine reason
  let reason = 'Your highest rated anime';
  if (winner.score >= 10) {
    reason = 'A perfect 10 - absolute masterpiece';
  } else if (winner.episodes > 24) {
    reason = 'Long journey, but worth every episode';
  } else if (winner.score >= 9) {
    reason = 'Nearly perfect - an instant classic';
  }

  return {
    mediaId: winner.mediaId,
    title: winner.title,
    coverImage: winner.coverImage,
    reason,
    score: winner.score,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

export function getEchoAvailablePeriods(entries: EchoAnimeEntry[]): EchoAvailablePeriods {
  const monthSet = new Set<string>();
  const yearSet = new Set<string>();

  for (const entry of entries) {
    if (entry.updatedAt) {
      const date = new Date(entry.updatedAt * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      monthSet.add(`${year}-${month}`);
      yearSet.add(String(year));
    }

    if (entry.completedAt?.year) {
      const year = entry.completedAt.year;
      if (entry.completedAt.month) {
        const month = String(entry.completedAt.month).padStart(2, '0');
        monthSet.add(`${year}-${month}`);
      }
      yearSet.add(String(year));
    }
  }

  return {
    monthly: Array.from(monthSet).sort().reverse(),
    yearly: Array.from(yearSet).sort().reverse(),
  };
}

function filterEntriesByPeriod(
  entries: EchoAnimeEntry[],
  period: string,
  type: EchoPeriodType
): EchoAnimeEntry[] {
  const filtered = entries.filter(entry => {
    // Priority 1: completedAt (most accurate)
    if (entry.completedAt?.year) {
      if (type === 'yearly') {
        return String(entry.completedAt.year) === period;
      } else if (entry.completedAt.month) {
        const entryPeriod = `${entry.completedAt.year}-${String(entry.completedAt.month).padStart(2, '0')}`;
        return entryPeriod === period;
      }
    }

    // Priority 2: startedAt (for currently watching)
    if (entry.startedAt?.year) {
      if (type === 'yearly') {
        return String(entry.startedAt.year) === period;
      } else if (entry.startedAt.month) {
        const entryPeriod = `${entry.startedAt.year}-${String(entry.startedAt.month).padStart(2, '0')}`;
        return entryPeriod === period;
      }
    }

    // Priority 3: updatedAt (fallback)
    if (entry.updatedAt) {
      const date = new Date(entry.updatedAt * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      if (type === 'yearly') {
        return String(year) === period;
      } else {
        return `${year}-${month}` === period;
      }
    }

    return false;
  });

  devLog(`[Echo] Filtered ${filtered.length} entries for period ${period} (${type})`);
  return filtered;
}

function isInPeriod(entry: EchoAnimeEntry, period: string, type: EchoPeriodType): boolean {
  if (entry.completedAt?.year) {
    if (type === 'yearly') {
      return String(entry.completedAt.year) === period;
    } else if (entry.completedAt.month) {
      return `${entry.completedAt.year}-${String(entry.completedAt.month).padStart(2, '0')}` === period;
    }
  }
  return false;
}

function isAfterPeriod(entry: EchoAnimeEntry, period: string, type: EchoPeriodType): boolean {
  if (!entry.completedAt?.year) return false;

  if (type === 'yearly') {
    return entry.completedAt.year > parseInt(period);
  } else {
    const [pYear, pMonth] = period.split('-').map(Number);
    if (entry.completedAt.year > pYear) return true;
    if (entry.completedAt.year === pYear && entry.completedAt.month && entry.completedAt.month > pMonth) return true;
  }
  return false;
}

function getPreviousPeriod(period: string, type: EchoPeriodType): string | null {
  if (type === 'yearly') {
    return String(parseInt(period) - 1);
  } else {
    const [year, month] = period.split('-').map(Number);
    if (month === 1) {
      return `${year - 1}-12`;
    } else {
      return `${year}-${String(month - 1).padStart(2, '0')}`;
    }
  }
}
