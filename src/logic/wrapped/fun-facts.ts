// Fun Facts Generator for Wrapped
import type { WrappedData } from './wrapped-types';

type FunFactGenerator = (data: WrappedData) => string | null;

const FUN_FACT_GENERATORS: FunFactGenerator[] = [
  // Hours watched facts
  (data) => {
    if (data.hoursWatched >= 100) {
      const days = Math.floor(data.hoursWatched / 24);
      return `You watched ${data.hoursWatched} hours of anime - that's ${days} full days!`;
    }
    return null;
  },

  (data) => {
    if (data.hoursWatched >= 50 && data.hoursWatched < 100) {
      return `${data.hoursWatched} hours of anime watched. That's more than some people sleep in a week!`;
    }
    return null;
  },

  // Episode facts
  (data) => {
    if (data.episodesWatched >= 500) {
      return `${data.episodesWatched} episodes! You could have learned a new language... or watched more anime.`;
    }
    return null;
  },

  (data) => {
    if (data.episodesWatched >= 200 && data.episodesWatched < 500) {
      return `With ${data.episodesWatched} episodes, you're definitely not a casual viewer.`;
    }
    return null;
  },

  // Binge facts
  (data) => {
    if (data.longestBinge && data.longestBinge.episodes >= 24) {
      return `Your longest binge was ${data.longestBinge.episodes} episodes of ${data.longestBinge.anime}. Sleep is overrated anyway.`;
    }
    return null;
  },

  (data) => {
    if (data.longestBinge && data.longestBinge.episodes >= 12 && data.longestBinge.episodes < 24) {
      return `You binged ${data.longestBinge.episodes} episodes of ${data.longestBinge.anime} in one sitting. Respect.`;
    }
    return null;
  },

  // Fastest completion
  (data) => {
    if (data.fastestCompletion && data.fastestCompletion.days <= 1) {
      return `You finished ${data.fastestCompletion.anime} in just ${data.fastestCompletion.days} day. Speedrunning anime!`;
    }
    return null;
  },

  (data) => {
    if (data.fastestCompletion && data.fastestCompletion.days <= 3 && data.fastestCompletion.days > 1) {
      return `${data.fastestCompletion.anime} done in ${data.fastestCompletion.days} days. When it hits, it hits.`;
    }
    return null;
  },

  // Genre facts
  (data) => {
    const topGenre = data.topGenres[0];
    if (topGenre && topGenre.percentage >= 30) {
      return `${topGenre.name} made up ${topGenre.percentage}% of your anime. You know what you like!`;
    }
    return null;
  },

  (data) => {
    if (data.newGenresExplored.length >= 3) {
      return `You explored ${data.newGenresExplored.length} new genres this period. Adventurous!`;
    }
    return null;
  },

  (data) => {
    const actionGenre = data.topGenres.find(g => g.name === 'Action');
    if (actionGenre && actionGenre.count >= 10) {
      return `${actionGenre.count} action anime. You like things going boom!`;
    }
    return null;
  },

  (data) => {
    const romanceGenre = data.topGenres.find(g => g.name === 'Romance');
    if (romanceGenre && romanceGenre.count >= 5) {
      return `${romanceGenre.count} romance anime. A true romantic at heart.`;
    }
    return null;
  },

  // Completion facts
  (data) => {
    if (data.animeCompleted >= 20) {
      return `${data.animeCompleted} anime completed. Your watchlist fears you.`;
    }
    return null;
  },

  (data) => {
    if (data.animeDropped === 0 && data.animeCompleted >= 5) {
      return `Zero drops! You finish what you start. Dedication!`;
    }
    return null;
  },

  (data) => {
    if (data.animeDropped >= 5) {
      const dropRate = Math.round((data.animeDropped / (data.animeCompleted + data.animeDropped)) * 100);
      return `You dropped ${data.animeDropped} anime (${dropRate}%). Quality over quantity!`;
    }
    return null;
  },

  // Comparison facts
  (data) => {
    if (data.comparison && data.comparison.episodesDelta > 100) {
      return `You watched ${data.comparison.episodesDelta} more episodes than last period. Level up!`;
    }
    return null;
  },

  (data) => {
    if (data.comparison && data.comparison.completionDelta > 5) {
      return `${data.comparison.completionDelta} more anime completed than last period. On fire!`;
    }
    return null;
  },

  // Studio facts
  (data) => {
    if (data.topStudios.length > 0 && data.topStudios[0].count >= 5) {
      return `${data.topStudios[0].name} produced ${data.topStudios[0].count} of your watches. You're a fan!`;
    }
    return null;
  },

  (data) => {
    if (data.firstTimeStudios.length >= 3) {
      return `You discovered ${data.firstTimeStudios.length} new studios this period. Exploring the industry!`;
    }
    return null;
  },

  // Highest rated
  (data) => {
    if (data.highestRated && data.highestRated.score === 100) {
      return `You gave ${data.highestRated.anime} a perfect 10/10. A masterpiece in your eyes!`;
    }
    return null;
  },

  // Started facts
  (data) => {
    if (data.animeStarted >= 15) {
      return `You started ${data.animeStarted} new anime. Always curious for something new!`;
    }
    return null;
  },

  // Time-based fun facts for yearly
  (data) => {
    if (data.type === 'yearly' && data.hoursWatched >= 200) {
      const daysOff = Math.floor(data.hoursWatched / 8); // 8 hour work day
      return `${data.hoursWatched} hours this year - equivalent to ${daysOff} work days of pure anime!`;
    }
    return null;
  },
];

// Generate fun facts based on wrapped data
export function generateFunFacts(data: WrappedData): string[] {
  const facts: string[] = [];

  for (const generator of FUN_FACT_GENERATORS) {
    const fact = generator(data);
    if (fact) {
      facts.push(fact);
    }
  }

  // Shuffle and return top 3-5 facts
  const shuffled = facts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(5, Math.max(3, facts.length)));
}
