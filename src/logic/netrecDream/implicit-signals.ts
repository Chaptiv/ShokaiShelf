/**
 * NetRecDream V4 - Implicit Signal Processor
 *
 * Analyzes user watch history to derive behavioral metrics:
 * - Binge velocity (episodes per day)
 * - Drop forensics (when and why users drop anime)
 * - Tolerance scores (old anime, long series, slow pacing)
 * - Engagement patterns
 */

import {
  BehavioralMetrics,
  DropAnalysis,
  ToleranceScores,
  DEFAULT_BEHAVIORAL_METRICS
} from './dream-types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface MediaListEntry {
  id: number;
  mediaId: number;
  status: string;
  score?: number;
  progress?: number;
  repeat?: number;
  startedAt?: { year?: number; month?: number; day?: number };
  completedAt?: { year?: number; month?: number; day?: number };
  updatedAt?: number;
  createdAt?: number;
  media?: {
    id: number;
    episodes?: number;
    duration?: number;
    genres?: string[];
    tags?: { name: string; rank?: number }[];
    studios?: { nodes: { name: string }[] };
    startDate?: { year?: number };
    format?: string;
    averageScore?: number;
  };
}

// =============================================================================
// MAIN CALCULATOR
// =============================================================================

/**
 * Calculate all behavioral metrics from user's watch history
 */
export function calculateAllBehavioralMetrics(entries: MediaListEntry[]): BehavioralMetrics {
  if (entries.length === 0) {
    return { ...DEFAULT_BEHAVIORAL_METRICS };
  }

  const bingeVelocity = calculateBingeVelocity(entries);
  const completionistScore = calculateCompletionistScore(entries);
  const dropRate = calculateDropRate(entries);
  const dropAnalysis = analyzeDropPatterns(entries);
  const toleranceScores = calculateToleranceScores(entries);
  const engagementMetrics = calculateEngagementMetrics(entries);

  return {
    bingeVelocity,
    completionistScore,
    dropRate,
    avgDropPoint: dropAnalysis.avgDropPoint,
    vibeCheckDrops: dropAnalysis.vibeCheckDrops,
    boredomDrops: dropAnalysis.boredomDrops,
    burnoutDrops: dropAnalysis.burnoutDrops,
    toleranceForOld: toleranceScores.toleranceForOld,
    toleranceForLong: toleranceScores.toleranceForLong,
    toleranceForSlowPace: toleranceScores.toleranceForSlowPace,
    ...engagementMetrics
  };
}

// =============================================================================
// BINGE VELOCITY
// =============================================================================

/**
 * Calculate median episodes per day when actively watching
 *
 * Uses median instead of mean to be robust against outliers
 * (e.g., binge-watching one show in a day)
 */
export function calculateBingeVelocity(entries: MediaListEntry[]): number {
  const velocities: number[] = [];

  const completed = entries.filter(e => e.status === 'COMPLETED');

  for (const entry of completed) {
    const episodes = entry.media?.episodes || entry.progress || 0;
    if (episodes <= 0) continue;

    // Calculate days to complete
    const days = calculateDaysToComplete(entry);
    if (days <= 0) continue;

    // Episodes per day
    const velocity = episodes / days;
    velocities.push(velocity);
  }

  if (velocities.length === 0) {
    return DEFAULT_BEHAVIORAL_METRICS.bingeVelocity;
  }

  // Return median
  velocities.sort((a, b) => a - b);
  const mid = Math.floor(velocities.length / 2);

  if (velocities.length % 2 === 0) {
    return (velocities[mid - 1] + velocities[mid]) / 2;
  }

  return velocities[mid];
}

/**
 * Calculate days between start and completion
 */
function calculateDaysToComplete(entry: MediaListEntry): number {
  const startDate = parseDate(entry.startedAt);
  const endDate = parseDate(entry.completedAt);

  if (!startDate || !endDate) {
    // Fallback: use updatedAt and createdAt
    if (entry.updatedAt && entry.createdAt) {
      const diffMs = (entry.updatedAt - entry.createdAt) * 1000;
      const days = diffMs / (1000 * 60 * 60 * 24);
      return Math.max(days, 1); // Minimum 1 day
    }
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);

  // Minimum 1 day (same-day completion)
  return Math.max(days, 1);
}

/**
 * Parse date object to Date
 */
function parseDate(date?: { year?: number; month?: number; day?: number }): Date | null {
  if (!date || !date.year) return null;

  const year = date.year;
  const month = (date.month || 1) - 1; // JS months are 0-indexed
  const day = date.day || 1;

  return new Date(year, month, day);
}

// =============================================================================
// COMPLETIONIST SCORE
// =============================================================================

/**
 * Calculate percentage of started anime that were completed
 */
export function calculateCompletionistScore(entries: MediaListEntry[]): number {
  // Count started anime (any status except PLANNING)
  const started = entries.filter(e =>
    ['CURRENT', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING'].includes(e.status)
  );

  if (started.length === 0) return 0.5; // Default to neutral

  // Count completed
  const completed = entries.filter(e =>
    e.status === 'COMPLETED' || e.status === 'REPEATING'
  );

  return completed.length / started.length;
}

// =============================================================================
// DROP RATE
// =============================================================================

/**
 * Calculate percentage of started anime that were dropped
 */
export function calculateDropRate(entries: MediaListEntry[]): number {
  const started = entries.filter(e =>
    ['CURRENT', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING'].includes(e.status)
  );

  if (started.length === 0) return 0.2; // Default

  const dropped = entries.filter(e => e.status === 'DROPPED');

  return dropped.length / started.length;
}

// =============================================================================
// DROP FORENSICS
// =============================================================================

/**
 * Analyze when and why users drop anime
 *
 * Categories:
 * - Vibe Check Drops (progress < 25%): Disliked first impression
 * - Boredom Drops (25% ≤ progress < 67%): Lost interest mid-season
 * - Burnout Drops (progress ≥ 67%): Fatigue near end
 */
export function analyzeDropPatterns(entries: MediaListEntry[]): DropAnalysis {
  const dropped = entries.filter(e => e.status === 'DROPPED');

  const analysis: DropAnalysis = {
    avgDropPoint: 0.25, // Default
    vibeCheckDrops: 0,
    boredomDrops: 0,
    burnoutDrops: 0,
    totalDrops: dropped.length,
    dropsByGenre: {},
    dropsByTag: {},
    dropsByStudio: {}
  };

  if (dropped.length === 0) return analysis;

  const dropPoints: number[] = [];

  for (const entry of dropped) {
    const progress = entry.progress || 0;
    const totalEpisodes = entry.media?.episodes || 12; // Default to 12 if unknown

    // Calculate normalized progress (0-1)
    const normalizedProgress = Math.min(progress / totalEpisodes, 1);
    dropPoints.push(normalizedProgress);

    // Categorize drop
    if (normalizedProgress < 0.25) {
      analysis.vibeCheckDrops++;
    } else if (normalizedProgress < 0.67) {
      analysis.boredomDrops++;
    } else {
      analysis.burnoutDrops++;
    }

    // Track drops by genre
    for (const genre of entry.media?.genres || []) {
      analysis.dropsByGenre[genre] = (analysis.dropsByGenre[genre] || 0) + 1;
    }

    // Track drops by tag (top 5 tags only)
    const tags = (entry.media?.tags || [])
      .sort((a, b) => (b.rank || 0) - (a.rank || 0))
      .slice(0, 5);

    for (const tag of tags) {
      analysis.dropsByTag[tag.name] = (analysis.dropsByTag[tag.name] || 0) + 1;
    }

    // Track drops by studio
    for (const studio of entry.media?.studios?.nodes || []) {
      analysis.dropsByStudio[studio.name] = (analysis.dropsByStudio[studio.name] || 0) + 1;
    }
  }

  // Calculate average drop point
  analysis.avgDropPoint = dropPoints.reduce((a, b) => a + b, 0) / dropPoints.length;

  return analysis;
}

// =============================================================================
// TOLERANCE SCORES
// =============================================================================

/**
 * Calculate tolerance scores based on viewing history
 */
export function calculateToleranceScores(entries: MediaListEntry[]): ToleranceScores {
  return {
    toleranceForOld: calculateOldAnimeTolerance(entries),
    toleranceForLong: calculateLongSeriesTolerance(entries),
    toleranceForSlowPace: calculateSlowPaceTolerance(entries)
  };
}

/**
 * Calculate willingness to watch older anime (pre-2010)
 */
function calculateOldAnimeTolerance(entries: MediaListEntry[]): number {
  const currentYear = new Date().getFullYear();

  // Filter to entries with year data
  const withYear = entries.filter(e => e.media?.startDate?.year);

  if (withYear.length === 0) return 0.5; // Default to neutral

  // Old anime = before 2010
  const oldAnime = withYear.filter(e => (e.media?.startDate?.year || currentYear) < 2010);

  if (oldAnime.length === 0) return 0.3; // User doesn't watch old anime

  // Calculate completion rate for old anime
  const oldCompleted = oldAnime.filter(e =>
    e.status === 'COMPLETED' || e.status === 'REPEATING'
  );

  const completionRate = oldCompleted.length / oldAnime.length;

  // Calculate average score for old anime
  const oldWithScores = oldAnime.filter(e => e.score && e.score > 0);
  const avgOldScore = oldWithScores.length > 0
    ? oldWithScores.reduce((sum, e) => sum + (e.score || 0), 0) / oldWithScores.length
    : 0;

  // Combine completion rate and score preference
  // High completion + high scores = high tolerance
  const scoreFactor = avgOldScore > 0 ? avgOldScore / 10 : 0.5;

  return (completionRate * 0.6) + (scoreFactor * 0.4);
}

/**
 * Calculate willingness to watch long series (50+ episodes)
 */
function calculateLongSeriesTolerance(entries: MediaListEntry[]): number {
  // Filter to entries with episode data
  const withEpisodes = entries.filter(e => e.media?.episodes);

  if (withEpisodes.length === 0) return 0.5;

  // Long series = 50+ episodes
  const longSeries = withEpisodes.filter(e => (e.media?.episodes || 0) >= 50);

  if (longSeries.length === 0) return 0.3; // User doesn't watch long series

  // Calculate completion rate for long series
  const longCompleted = longSeries.filter(e =>
    e.status === 'COMPLETED' || e.status === 'REPEATING'
  );

  // Also check for currently watching (commitment to long series)
  const longCurrent = longSeries.filter(e => e.status === 'CURRENT');

  // Dropped long series is a strong negative signal
  const longDropped = longSeries.filter(e => e.status === 'DROPPED');

  const completionRate = longCompleted.length / longSeries.length;
  const currentRate = longCurrent.length / longSeries.length;
  const dropRate = longDropped.length / longSeries.length;

  // Score: completion helps, current helps a bit, drops hurt
  return Math.max(0, Math.min(1,
    (completionRate * 0.7) + (currentRate * 0.3) - (dropRate * 0.4)
  ));
}

/**
 * Calculate tolerance for slow-paced anime
 * Inferred from drops of anime tagged with "Slow Paced" or similar
 */
function calculateSlowPaceTolerance(entries: MediaListEntry[]): number {
  const slowPaceTags = ['Slow Paced', 'Slice of Life', 'Iyashikei', 'Atmospheric'];

  // Find anime with slow pace tags
  const slowPaceAnime = entries.filter(e => {
    const tags = (e.media?.tags || []).map(t => t.name);
    return slowPaceTags.some(tag => tags.includes(tag));
  });

  if (slowPaceAnime.length === 0) return 0.5;

  const completed = slowPaceAnime.filter(e =>
    e.status === 'COMPLETED' || e.status === 'REPEATING'
  );

  const dropped = slowPaceAnime.filter(e => e.status === 'DROPPED');

  // Early drops (vibe check) of slow paced anime = low tolerance
  const earlyDrops = dropped.filter(e => {
    const progress = e.progress || 0;
    const total = e.media?.episodes || 12;
    return progress / total < 0.25;
  });

  const completionRate = completed.length / slowPaceAnime.length;
  const earlyDropRate = earlyDrops.length / slowPaceAnime.length;

  // High completion = high tolerance, early drops = low tolerance
  return Math.max(0, Math.min(1,
    completionRate - (earlyDropRate * 0.5)
  ));
}

// =============================================================================
// ENGAGEMENT METRICS
// =============================================================================

interface EngagementMetrics {
  avgSessionLength: number;
  weeklyActiveHours: number;
  preferredFormats: string[];
  lastActiveDate: number;
  daysSinceLastWatch: number;
}

/**
 * Calculate engagement metrics from watch history
 */
function calculateEngagementMetrics(entries: MediaListEntry[]): EngagementMetrics {
  // Calculate preferred formats
  const formatCounts: Record<string, number> = {};

  for (const entry of entries) {
    const format = entry.media?.format || 'TV';
    formatCounts[format] = (formatCounts[format] || 0) + 1;
  }

  const sortedFormats = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([format]) => format);

  const preferredFormats = sortedFormats.slice(0, 3);

  // Calculate last active date
  const timestamps = entries
    .map(e => e.updatedAt || e.createdAt || 0)
    .filter(t => t > 0);

  const lastActiveDate = timestamps.length > 0
    ? Math.max(...timestamps) * 1000 // Convert to ms
    : Date.now();

  const daysSinceLastWatch = Math.floor(
    (Date.now() - lastActiveDate) / (1000 * 60 * 60 * 24)
  );

  // Estimate average session length from episode durations
  const avgDuration = entries
    .filter(e => e.media?.duration)
    .reduce((sum, e) => sum + (e.media?.duration || 24), 0)
    / Math.max(entries.filter(e => e.media?.duration).length, 1);

  // Assume 3 episodes per session as default
  const avgSessionLength = 3;

  // Estimate weekly hours from recent activity
  const weeklyActiveHours = estimateWeeklyHours(entries, avgDuration);

  return {
    avgSessionLength,
    weeklyActiveHours,
    preferredFormats,
    lastActiveDate,
    daysSinceLastWatch
  };
}

/**
 * Estimate weekly watching hours from entry patterns
 */
function estimateWeeklyHours(entries: MediaListEntry[], avgDuration: number): number {
  const now = Date.now();
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

  // Count entries updated in last week
  const recentEntries = entries.filter(e => {
    const updated = (e.updatedAt || 0) * 1000;
    return updated >= oneWeekAgo;
  });

  if (recentEntries.length === 0) {
    // No recent activity, estimate from overall patterns
    const totalCompleted = entries.filter(e => e.status === 'COMPLETED').length;
    const oldestEntry = Math.min(
      ...entries.map(e => (e.createdAt || Date.now() / 1000) * 1000)
    );
    const weeksSinceStart = Math.max(
      (now - oldestEntry) / (7 * 24 * 60 * 60 * 1000),
      1
    );

    // Average 12 episodes per completed anime, avgDuration minutes each
    const totalHours = (totalCompleted * 12 * avgDuration) / 60;
    return Math.round(totalHours / weeksSinceStart * 10) / 10;
  }

  // Sum progress made in recent entries
  // This is a simplification - real implementation would track progress deltas
  const episodesWatched = recentEntries.reduce((sum, e) => {
    // Assume half of current progress was this week for active entries
    if (e.status === 'CURRENT') {
      return sum + Math.min((e.progress || 0) / 2, 5);
    }
    // Completed this week
    if (e.status === 'COMPLETED') {
      return sum + (e.media?.episodes || 12);
    }
    return sum;
  }, 0);

  const hoursWatched = (episodesWatched * avgDuration) / 60;
  return Math.round(hoursWatched * 10) / 10;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get drop statistics for display
 */
export function getDropStats(entries: MediaListEntry[]): {
  total: number;
  byCategory: { vibeCheck: number; boredom: number; burnout: number };
  topDroppedGenres: string[];
  topDroppedStudios: string[];
} {
  const analysis = analyzeDropPatterns(entries);

  const sortedGenres = Object.entries(analysis.dropsByGenre)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);

  const sortedStudios = Object.entries(analysis.dropsByStudio)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([studio]) => studio);

  return {
    total: analysis.totalDrops,
    byCategory: {
      vibeCheck: analysis.vibeCheckDrops,
      boredom: analysis.boredomDrops,
      burnout: analysis.burnoutDrops
    },
    topDroppedGenres: sortedGenres,
    topDroppedStudios: sortedStudios
  };
}

/**
 * Get binge profile description
 */
export function getBingeProfile(velocity: number): string {
  if (velocity >= 8) return 'Power Binger';
  if (velocity >= 5) return 'Heavy Watcher';
  if (velocity >= 3) return 'Steady Viewer';
  if (velocity >= 1.5) return 'Casual Watcher';
  return 'Slow Burner';
}

/**
 * Get tolerance level description
 */
export function getToleranceDescription(score: number): string {
  if (score >= 0.8) return 'Very High';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Moderate';
  if (score >= 0.2) return 'Low';
  return 'Very Low';
}
