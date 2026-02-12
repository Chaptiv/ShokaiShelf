// Wrapped System Types

export type WrappedPeriodType = 'monthly' | 'yearly';

export interface WrappedData {
  period: string; // "2025-01" (monthly) or "2025" (yearly)
  type: WrappedPeriodType;
  userId: string;

  // Main Stats
  episodesWatched: number;
  hoursWatched: number;
  animeCompleted: number;
  animeStarted: number;
  animeDropped: number;

  // Rankings
  topGenres: { name: string; count: number; percentage: number }[];
  topStudios: { name: string; count: number }[];

  // Highlights
  longestBinge: { anime: string; episodes: number; date: string } | null;
  fastestCompletion: { anime: string; days: number } | null;
  mostRewatched: { anime: string; count: number } | null;
  highestRated: { anime: string; score: number } | null;

  // Discoveries
  newGenresExplored: string[];
  firstTimeStudios: string[];

  // Personality
  persona: {
    name: string;
    description: string;
    trait: string; // e.g., "The Specialist", "The Binger"
  };

  // Fun Facts
  funFacts: string[];

  // Comparison to previous period
  comparison: {
    episodesDelta: number;
    completionDelta: number;
    hoursDelta: number;
  } | null;

  // Generated timestamp
  generatedAt: number;
}

export interface WrappedAnimeEntry {
  mediaId: number;
  title: string;
  status: string;
  progress: number;
  score: number;
  startedAt: { year: number | null; month: number | null; day: number | null } | null;
  completedAt: { year: number | null; month: number | null; day: number | null } | null;
  updatedAt: number;
  episodes: number | null;
  genres: string[];
  studios: string[];
  coverImage: string | null;
}

export interface AvailablePeriods {
  monthly: string[]; // ["2025-01", "2024-12", ...]
  yearly: string[]; // ["2025", "2024", ...]
}
