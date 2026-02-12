// Wrapped Engine - Generates monthly/yearly statistics
import type { WrappedData, WrappedPeriodType, WrappedAnimeEntry, AvailablePeriods } from './wrapped-types';
import { generateFunFacts } from './fun-facts';

// Generate wrapped data for a specific period
export async function generateWrapped(
  userId: string,
  period: string,
  type: WrappedPeriodType,
  entries: WrappedAnimeEntry[]
): Promise<WrappedData> {
  // Filter entries by period
  const periodEntries = filterEntriesByPeriod(entries, period, type);

  // Calculate main stats
  const episodesWatched = calculateEpisodesWatched(periodEntries);
  const hoursWatched = Math.round(episodesWatched * 24 / 60); // Assuming 24 min per episode
  const animeCompleted = periodEntries.filter(e => e.status === 'COMPLETED').length;
  const animeStarted = periodEntries.filter(e => wasStartedInPeriod(e, period, type)).length;
  const animeDropped = periodEntries.filter(e => e.status === 'DROPPED').length;

  // Calculate rankings
  const topGenres = calculateTopGenres(periodEntries);
  const topStudios = calculateTopStudios(periodEntries);

  // Find highlights
  const longestBinge = findLongestBinge(periodEntries);
  const fastestCompletion = findFastestCompletion(periodEntries);
  const highestRated = findHighestRated(periodEntries);

  // Find discoveries
  const newGenresExplored = findNewGenres(periodEntries, entries, period, type);
  const firstTimeStudios = findFirstTimeStudios(periodEntries, entries, period, type);

  // Determine Persona
  const persona = determinePersona(periodEntries, episodesWatched, animeCompleted, animeDropped, topGenres, newGenresExplored);

  // Calculate comparison to previous period
  const previousPeriod = getPreviousPeriod(period, type);
  const previousEntries = previousPeriod ? filterEntriesByPeriod(entries, previousPeriod, type) : [];
  const comparison = previousPeriod ? {
    episodesDelta: episodesWatched - calculateEpisodesWatched(previousEntries),
    completionDelta: animeCompleted - previousEntries.filter(e => e.status === 'COMPLETED').length,
    hoursDelta: hoursWatched - Math.round(calculateEpisodesWatched(previousEntries) * 24 / 60),
  } : null;

  // Build wrapped data
  const wrappedData: WrappedData = {
    period,
    type,
    userId,
    episodesWatched,
    hoursWatched,
    animeCompleted,
    animeStarted,
    animeDropped,
    topGenres,
    topStudios,
    longestBinge,
    fastestCompletion,
    mostRewatched: null, // Would need watch history data
    highestRated,
    newGenresExplored,
    firstTimeStudios,
    persona,
    funFacts: [],
    comparison,
    generatedAt: Date.now(),
  };

  // Generate fun facts
  wrappedData.funFacts = generateFunFacts(wrappedData);

  return wrappedData;
}

// ... (existing helper functions)

// Determine Persona based on stats
function determinePersona(
  entries: WrappedAnimeEntry[],
  episodes: number,
  completed: number,
  dropped: number,
  topGenres: { name: string; count: number; percentage: number }[],
  newGenres: string[]
): { name: string; description: string; trait: string } {
  // 1. Check for specific genre dominance
  if (topGenres.length > 0) {
    const top = topGenres[0];
    if (top.name === 'Action' && top.percentage > 40) {
      return {
        name: 'The Shonen Protagonist',
        description: 'You live for the hype. Training arcs, tournaments, and power-ups are your daily bread.',
        trait: 'Action Hero'
      };
    }
    if (top.name === 'Romance' && top.percentage > 30) {
      return {
        name: 'The Hopeless Romantic',
        description: 'You believe in true love, red threads of fate, and possibly high school drama.',
        trait: 'Heart of Gold'
      };
    }
    if ((top.name === 'Sci-Fi' || top.name === 'Mecha') && top.percentage > 30) {
      return {
        name: 'The Pilot',
        description: 'Giant robots and futuristic dystopias. You probably understand quantum physics now.',
        trait: 'Futurist'
      };
    }
    if (top.name === 'Slice of Life' && top.percentage > 30) {
      return {
        name: 'The Cozy Camper',
        description: 'You appreciate the little things. No world-ending threats, just good vibes and tea.',
        trait: 'Chill Vibes'
      };
    }
  }

  // 2. Check for watching habits
  if (dropped > completed && dropped > 5) {
    return {
      name: 'The Critic',
      description: 'You know what you like, and you don\'t waste time on anything else. Ruthless efficiency.',
      trait: 'High Standards'
    };
  }

  if (newGenres.length > 5) {
    return {
      name: 'The Explorer',
      description: 'You stepped way out of your comfort zone this period. New horizons, new favorites.',
      trait: 'Adventurous'
    };
  }

  if (episodes > 300 && completed > 10) { // Approx 10 eps/day for a month? Adjusted for general use.
     // If monthly, 300 is 10/day. If yearly, 300 is < 1/day.
     // Let's make it relative? Hard without knowing the specific period length in days perfectly.
     // Assuming "period" gives us a hint, but let's stick to absolute heavy numbers for "Binger".
     // Actually, let's just use a high raw number.
     return {
       name: 'The Binge Monster',
       description: 'Sleep is for the weak. Just one more episode... until the sun comes up.',
       trait: 'Unstoppable'
     };
  }

  // Default
  return {
    name: 'The Casual Enjoyer',
    description: 'You watch what you like, when you like. A balanced diet of anime.',
    trait: 'Balanced'
  };
}

// Get available periods from entries
export function getAvailablePeriods(entries: WrappedAnimeEntry[]): AvailablePeriods {
  const monthSet = new Set<string>();
  const yearSet = new Set<string>();

  for (const entry of entries) {
    // From updatedAt timestamp
    if (entry.updatedAt) {
      const date = new Date(entry.updatedAt * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      monthSet.add(`${year}-${month}`);
      yearSet.add(String(year));
    }

    // From completedAt
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

// Filter entries by period
function filterEntriesByPeriod(
  entries: WrappedAnimeEntry[],
  period: string,
  type: WrappedPeriodType
): WrappedAnimeEntry[] {
  return entries.filter(entry => {
    // Check completedAt
    if (entry.completedAt?.year) {
      if (type === 'yearly') {
        return String(entry.completedAt.year) === period;
      } else if (type === 'monthly' && entry.completedAt.month) {
        const entryPeriod = `${entry.completedAt.year}-${String(entry.completedAt.month).padStart(2, '0')}`;
        return entryPeriod === period;
      }
    }

    // Check updatedAt as fallback
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
}

// Calculate total episodes watched
function calculateEpisodesWatched(entries: WrappedAnimeEntry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.status === 'COMPLETED' && entry.episodes) {
      return sum + entry.episodes;
    }
    return sum + entry.progress;
  }, 0);
}

// Check if entry was started in period
function wasStartedInPeriod(entry: WrappedAnimeEntry, period: string, type: WrappedPeriodType): boolean {
  if (!entry.startedAt?.year) return false;

  if (type === 'yearly') {
    return String(entry.startedAt.year) === period;
  } else if (entry.startedAt.month) {
    const entryPeriod = `${entry.startedAt.year}-${String(entry.startedAt.month).padStart(2, '0')}`;
    return entryPeriod === period;
  }

  return false;
}

// Calculate top genres
function calculateTopGenres(entries: WrappedAnimeEntry[]): { name: string; count: number; percentage: number }[] {
  const genreCounts: Record<string, number> = {};
  let totalGenreOccurrences = 0;

  for (const entry of entries) {
    for (const genre of entry.genres) {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      totalGenreOccurrences++;
    }
  }

  return Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalGenreOccurrences) * 100),
    }));
}

// Calculate top studios
function calculateTopStudios(entries: WrappedAnimeEntry[]): { name: string; count: number }[] {
  const studioCounts: Record<string, number> = {};

  for (const entry of entries) {
    for (const studio of entry.studios) {
      studioCounts[studio] = (studioCounts[studio] || 0) + 1;
    }
  }

  return Object.entries(studioCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

// Find longest binge (most episodes of a single anime in the period)
function findLongestBinge(entries: WrappedAnimeEntry[]): { anime: string; episodes: number; date: string } | null {
  const completed = entries
    .filter(e => e.status === 'COMPLETED' && e.episodes)
    .sort((a, b) => (b.episodes || 0) - (a.episodes || 0));

  if (completed.length === 0) return null;

  const top = completed[0];
  const date = top.completedAt
    ? `${top.completedAt.year}-${String(top.completedAt.month || 1).padStart(2, '0')}-${String(top.completedAt.day || 1).padStart(2, '0')}`
    : 'Unknown';

  return {
    anime: top.title,
    episodes: top.episodes || top.progress,
    date,
  };
}

// Find fastest completion
function findFastestCompletion(entries: WrappedAnimeEntry[]): { anime: string; days: number } | null {
  const completedWithDates = entries.filter(e =>
    e.status === 'COMPLETED' &&
    e.startedAt?.year && e.startedAt?.month && e.startedAt?.day &&
    e.completedAt?.year && e.completedAt?.month && e.completedAt?.day
  );

  if (completedWithDates.length === 0) return null;

  const withDays = completedWithDates.map(e => {
    const start = new Date(e.startedAt!.year!, e.startedAt!.month! - 1, e.startedAt!.day!);
    const end = new Date(e.completedAt!.year!, e.completedAt!.month! - 1, e.completedAt!.day!);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return { anime: e.title, days: Math.max(1, days) };
  });

  return withDays.sort((a, b) => a.days - b.days)[0];
}

// Find highest rated
function findHighestRated(entries: WrappedAnimeEntry[]): { anime: string; score: number } | null {
  const rated = entries.filter(e => e.score > 0).sort((a, b) => b.score - a.score);
  if (rated.length === 0) return null;
  return { anime: rated[0].title, score: rated[0].score };
}

// Find new genres explored in this period
function findNewGenres(
  periodEntries: WrappedAnimeEntry[],
  allEntries: WrappedAnimeEntry[],
  period: string,
  type: WrappedPeriodType
): string[] {
  const previousPeriod = getPreviousPeriod(period, type);
  if (!previousPeriod) return [];

  // Get all genres from before this period
  const previousGenres = new Set<string>();
  for (const entry of allEntries) {
    if (!isInPeriod(entry, period, type) && !isAfterPeriod(entry, period, type)) {
      for (const genre of entry.genres) {
        previousGenres.add(genre);
      }
    }
  }

  // Find genres in this period that weren't in previous
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

// Find first time studios
function findFirstTimeStudios(
  periodEntries: WrappedAnimeEntry[],
  allEntries: WrappedAnimeEntry[],
  period: string,
  type: WrappedPeriodType
): string[] {
  // Get all studios from before this period
  const previousStudios = new Set<string>();
  for (const entry of allEntries) {
    if (!isInPeriod(entry, period, type) && !isAfterPeriod(entry, period, type)) {
      for (const studio of entry.studios) {
        previousStudios.add(studio);
      }
    }
  }

  // Find studios in this period that weren't watched before
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

// Check if entry is in period
function isInPeriod(entry: WrappedAnimeEntry, period: string, type: WrappedPeriodType): boolean {
  if (entry.completedAt?.year) {
    if (type === 'yearly') {
      return String(entry.completedAt.year) === period;
    } else if (entry.completedAt.month) {
      return `${entry.completedAt.year}-${String(entry.completedAt.month).padStart(2, '0')}` === period;
    }
  }
  return false;
}

// Check if entry is after period
function isAfterPeriod(entry: WrappedAnimeEntry, period: string, type: WrappedPeriodType): boolean {
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

// Get previous period
function getPreviousPeriod(period: string, type: WrappedPeriodType): string | null {
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
