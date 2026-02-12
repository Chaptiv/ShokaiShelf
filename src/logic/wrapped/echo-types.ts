// ShokaiShelf Echo - Types
// Das ultimative persönliche Anime-Rückblick Erlebnis

export type EchoPeriodType = 'monthly' | 'yearly';

// User Profile Data
export interface EchoUserProfile {
  id: number;
  username: string;
  avatar: string | null;
  bannerImage?: string | null;
}

// Top Anime with full details
export interface EchoTopAnime {
  mediaId: number;
  title: string;
  coverImage: string | null;
  score: number;
  episodes: number;
  genres: string[];
  completedAt: string | null;
  reason: 'highest_rated' | 'most_binged' | 'most_rewatched' | 'discovery';
}

// Watch Pattern - when do you watch?
export interface EchoWatchPattern {
  peakHour: number; // 0-23
  peakDay: string; // Monday, Tuesday, etc.
  nightOwlScore: number; // 0-100 (how much late night watching)
  weekendWarrior: boolean; // watches mostly on weekends
  bingeStreak: number; // longest consecutive days watching
}

// Milestone achieved this period
export interface EchoMilestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  achievedAt: number;
}

// Score Distribution
export interface EchoScoreDistribution {
  average: number;
  distribution: { score: number; count: number }[];
  perfectScores: number; // 10/10 anime
  harshCritic: boolean; // avg < 6
  easilyPleased: boolean; // avg > 8
}

// Genre Affinity with emoji and color
export interface EchoGenreAffinity {
  name: string;
  count: number;
  percentage: number;
  emoji: string;
  color: string;
  growth: number; // compared to last period
}

// Studio Stats
export interface EchoStudioStats {
  name: string;
  count: number;
  topAnime: { title: string; coverImage: string | null }[];
  isFavorite: boolean;
}

// Hidden Gem - underrated anime you loved
export interface EchoHiddenGem {
  mediaId: number;
  title: string;
  coverImage: string | null;
  yourScore: number;
  popularity: number;
  averageScore: number;
}

// The main Echo Data structure
export interface EchoData {
  // Meta
  period: string; // "2025-01" or "2025"
  type: EchoPeriodType;
  generatedAt: number;

  // User Profile
  user: EchoUserProfile;

  // Core Stats
  stats: {
    episodesWatched: number;
    hoursWatched: number;
    minutesWatched: number;
    animeCompleted: number;
    animeStarted: number;
    animeDropped: number;
    animePaused: number;
    totalAnime: number;
    completionRate: number; // percentage
  };

  // Top 5 Anime of the period
  topAnime: EchoTopAnime[];

  // Genre Analysis
  genres: EchoGenreAffinity[];
  genreVariety: number; // how many different genres (1-10 scale)
  dominantMood: string; // "Action-packed", "Emotional", "Chill", etc.

  // Studio Love
  topStudios: EchoStudioStats[];
  studioLoyalty: number; // 0-100, how much you stick to same studios

  // Watch Patterns
  watchPattern: EchoWatchPattern;

  // Score Analysis
  scoreDistribution: EchoScoreDistribution;

  // Discoveries
  hiddenGems: EchoHiddenGem[];
  newGenres: string[];
  newStudios: string[];

  // Highlights
  longestBinge: { anime: string; episodes: number; coverImage: string | null } | null;
  fastestFinish: { anime: string; days: number; coverImage: string | null } | null;
  biggestSurprise: { anime: string; expectedScore: number; actualScore: number; coverImage: string | null } | null;

  // Persona
  persona: {
    name: string;
    title: string;
    description: string;
    emoji: string;
    color: string;
    traits: string[];
  };

  // Milestones
  milestones: EchoMilestone[];

  // Fun Facts
  funFacts: string[];

  // Comparison to previous period
  comparison: {
    episodesDelta: number;
    hoursDelta: number;
    completionDelta: number;
    trend: 'up' | 'down' | 'stable';
    message: string;
  } | null;

  // Anime of the Period
  animeOfThePeriod: {
    mediaId: number;
    title: string;
    coverImage: string | null;
    reason: string;
    score: number;
  } | null;
}

// Entry type for processing
export interface EchoAnimeEntry {
  mediaId: number;
  title: string;
  status: string;
  progress: number;
  score: number;
  startedAt: { year: number | null; month: number | null; day: number | null } | null;
  completedAt: { year: number | null; month: number | null; day: number | null } | null;
  updatedAt: number;
  episodes: number | null;
  duration: number | null; // minutes per episode
  genres: string[];
  studios: string[];
  coverImage: string | null;
  bannerImage: string | null;
  popularity: number | null;
  averageScore: number | null;
}

export interface EchoAvailablePeriods {
  monthly: string[];
  yearly: string[];
}

// Genre emoji and color mapping
export const GENRE_STYLES: Record<string, { emoji: string; color: string }> = {
  Action: { emoji: '⚔️', color: '#ef4444' },
  Adventure: { emoji: '🗺️', color: '#f97316' },
  Comedy: { emoji: '😂', color: '#fbbf24' },
  Drama: { emoji: '🎭', color: '#a855f7' },
  Fantasy: { emoji: '✨', color: '#8b5cf6' },
  Horror: { emoji: '👻', color: '#1f2937' },
  Mystery: { emoji: '🔍', color: '#6366f1' },
  Psychological: { emoji: '🧠', color: '#ec4899' },
  Romance: { emoji: '💕', color: '#f472b6' },
  'Sci-Fi': { emoji: '🚀', color: '#06b6d4' },
  'Slice of Life': { emoji: '☕', color: '#84cc16' },
  Sports: { emoji: '⚽', color: '#22c55e' },
  Supernatural: { emoji: '👁️', color: '#7c3aed' },
  Thriller: { emoji: '💀', color: '#dc2626' },
  Mecha: { emoji: '🤖', color: '#3b82f6' },
  Music: { emoji: '🎵', color: '#14b8a6' },
  Ecchi: { emoji: '🔥', color: '#f43f5e' },
  Shounen: { emoji: '💪', color: '#f59e0b' },
  Shoujo: { emoji: '🌸', color: '#fb7185' },
  Seinen: { emoji: '🎯', color: '#64748b' },
  Josei: { emoji: '💄', color: '#e879f9' },
};

// Persona definitions
export const PERSONAS = {
  bingeMonster: {
    name: 'The Binge Monster',
    title: 'Unstoppable Force',
    emoji: '🔥',
    color: '#ef4444',
    traits: ['Dedicated', 'Passionate', 'Unstoppable'],
  },
  curator: {
    name: 'The Curator',
    title: 'Quality Connoisseur',
    emoji: '🎭',
    color: '#8b5cf6',
    traits: ['Selective', 'Critical', 'Refined'],
  },
  explorer: {
    name: 'The Explorer',
    title: 'Genre Pioneer',
    emoji: '🧭',
    color: '#06b6d4',
    traits: ['Adventurous', 'Open-minded', 'Curious'],
  },
  romantic: {
    name: 'The Hopeless Romantic',
    title: 'Heart of Gold',
    emoji: '💕',
    color: '#f472b6',
    traits: ['Emotional', 'Dreamy', 'Compassionate'],
  },
  actionHero: {
    name: 'The Shonen Protagonist',
    title: 'Battle Ready',
    emoji: '⚔️',
    color: '#f97316',
    traits: ['Hyped', 'Energetic', 'Never gives up'],
  },
  nightOwl: {
    name: 'The Night Owl',
    title: 'Midnight Watcher',
    emoji: '🦉',
    color: '#6366f1',
    traits: ['Nocturnal', 'Dedicated', 'One more episode...'],
  },
  completionist: {
    name: 'The Completionist',
    title: 'No Anime Left Behind',
    emoji: '✅',
    color: '#22c55e',
    traits: ['Determined', 'Thorough', 'Committed'],
  },
  cozyVibes: {
    name: 'The Cozy Camper',
    title: 'Chill Mode Activated',
    emoji: '☕',
    color: '#84cc16',
    traits: ['Relaxed', 'Peaceful', 'Good vibes only'],
  },
};
