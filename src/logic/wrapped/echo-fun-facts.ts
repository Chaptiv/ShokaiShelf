// ShokaiShelf Echo - Fun Facts Generator
// Personal, witty, and memorable insights

import type { EchoData } from './echo-types';

type FunFactGenerator = (data: EchoData) => string | null;

const FUN_FACT_GENERATORS: FunFactGenerator[] = [
  // =========================================================================
  // TIME & HOURS
  // =========================================================================
  (data) => {
    if (data.stats.hoursWatched >= 200) {
      const days = Math.floor(data.stats.hoursWatched / 24);
      return `${data.stats.hoursWatched} Stunden Anime. Das sind ${days} volle Tage - du hättest eine neue Sprache lernen können... oder eben nicht.`;
    }
    return null;
  },

  (data) => {
    if (data.stats.hoursWatched >= 100 && data.stats.hoursWatched < 200) {
      const movies = Math.floor(data.stats.hoursWatched / 2);
      return `${data.stats.hoursWatched}h Anime = ${movies} Kinofilme. Aber wer braucht schon Hollywood?`;
    }
    return null;
  },

  (data) => {
    if (data.stats.hoursWatched >= 50) {
      const workDays = Math.floor(data.stats.hoursWatched / 8);
      return `${workDays} Arbeitstage worth of Anime. Gut investierte Zeit!`;
    }
    return null;
  },

  // =========================================================================
  // EPISODES
  // =========================================================================
  (data) => {
    if (data.stats.episodesWatched >= 500) {
      return `${data.stats.episodesWatched} Episoden! Du könntest eine eigene Anime-Enzyklopädie schreiben.`;
    }
    return null;
  },

  (data) => {
    if (data.stats.episodesWatched >= 300 && data.stats.episodesWatched < 500) {
      return `${data.stats.episodesWatched} Episoden geschaut. Das entspricht 12 durchgebingeten Seasons.`;
    }
    return null;
  },

  (data) => {
    if (data.type === 'monthly' && data.stats.episodesWatched > 100) {
      const perDay = Math.round(data.stats.episodesWatched / 30);
      return `${perDay} Episoden pro Tag im Durchschnitt. Just one more episode - aber in echt.`;
    }
    return null;
  },

  // =========================================================================
  // WATCH PATTERNS
  // =========================================================================
  (data) => {
    if (data.watchPattern.nightOwlScore > 70) {
      return `${data.watchPattern.nightOwlScore}% deiner Watches nach 22 Uhr. Die Nacht gehört dir - und den Openings auf voller Lautstärke.`;
    }
    return null;
  },

  (data) => {
    if (data.watchPattern.peakHour >= 0 && data.watchPattern.peakHour <= 5) {
      return `Deine Peak-Zeit: ${data.watchPattern.peakHour}:00 Uhr. Schlaf ist was für Schwache.`;
    }
    return null;
  },

  (data) => {
    if (data.watchPattern.weekendWarrior) {
      return `Weekend Warrior! Mehr als 50% deiner Watches am Wochenende. Priorities: ✓`;
    }
    return null;
  },

  (data) => {
    if (data.watchPattern.bingeStreak >= 7) {
      return `${data.watchPattern.bingeStreak} Tage Streak! Eine ganze Woche ohne einen Tag Anime-Pause.`;
    }
    return null;
  },

  // =========================================================================
  // BINGE & COMPLETION
  // =========================================================================
  (data) => {
    if (data.longestBinge && data.longestBinge.episodes >= 24) {
      return `${data.longestBinge.episodes} Episoden ${data.longestBinge.anime} am Stück. Marathon-Modus aktiviert!`;
    }
    return null;
  },

  (data) => {
    if (data.fastestFinish && data.fastestFinish.days === 1) {
      return `${data.fastestFinish.anime} in einem Tag durchgesuchtet. Speedrun: Any% Complete.`;
    }
    return null;
  },

  (data) => {
    if (data.fastestFinish && data.fastestFinish.days <= 3 && data.fastestFinish.days > 1) {
      return `${data.fastestFinish.anime} in ${data.fastestFinish.days} Tagen fertig. Wenn es klickt, dann klickt es.`;
    }
    return null;
  },

  // =========================================================================
  // GENRES
  // =========================================================================
  (data) => {
    if (data.genres[0] && data.genres[0].percentage > 40) {
      return `${data.genres[0].percentage}% ${data.genres[0].name}. Du weißt was du willst!`;
    }
    return null;
  },

  (data) => {
    if (data.newGenres.length >= 3) {
      return `${data.newGenres.length} neue Genres entdeckt! Genre-Explorer Achievement unlocked.`;
    }
    return null;
  },

  (data) => {
    const romance = data.genres.find(g => g.name === 'Romance');
    if (romance && romance.count >= 5) {
      return `${romance.count} Romance Anime. Wann ist deine Meet-Cute Szene?`;
    }
    return null;
  },

  (data) => {
    const action = data.genres.find(g => g.name === 'Action');
    if (action && action.count >= 10) {
      return `${action.count} Action Anime. Training Arc: Complete.`;
    }
    return null;
  },

  (data) => {
    const sol = data.genres.find(g => g.name === 'Slice of Life');
    if (sol && sol.count >= 5) {
      return `${sol.count} Slice of Life Anime. Du bist offiziell geheilt.`;
    }
    return null;
  },

  // =========================================================================
  // SCORES
  // =========================================================================
  (data) => {
    if (data.scoreDistribution.perfectScores >= 3) {
      return `${data.scoreDistribution.perfectScores} perfekte 10/10 vergeben. Entweder Masterpieces oder du bist sehr großzügig.`;
    }
    return null;
  },

  (data) => {
    if (data.scoreDistribution.harshCritic) {
      return `Durchschnittsscore: ${data.scoreDistribution.average}. Du hast hohe Standards - und das ist okay.`;
    }
    return null;
  },

  (data) => {
    if (data.scoreDistribution.easilyPleased) {
      return `Durchschnittsscore: ${data.scoreDistribution.average}. Du findest in jedem Anime etwas Gutes!`;
    }
    return null;
  },

  // =========================================================================
  // STUDIOS
  // =========================================================================
  (data) => {
    if (data.topStudios[0] && data.topStudios[0].count >= 5) {
      return `${data.topStudios[0].count} Anime von ${data.topStudios[0].name}. Fan-Status bestätigt.`;
    }
    return null;
  },

  (data) => {
    if (data.newStudios.length >= 3) {
      return `${data.newStudios.length} neue Studios entdeckt. Du erweiterst deinen Horizont!`;
    }
    return null;
  },

  (data) => {
    if (data.studioLoyalty > 50) {
      return `${data.studioLoyalty}% Studio-Loyalität. Du weißt wo die Qualität liegt.`;
    }
    return null;
  },

  // =========================================================================
  // COMPLETIONS & DROPS
  // =========================================================================
  (data) => {
    if (data.stats.animeCompleted >= 20) {
      return `${data.stats.animeCompleted} Anime completed. Deine Watchlist zittert vor Angst.`;
    }
    return null;
  },

  (data) => {
    if (data.stats.animeDropped === 0 && data.stats.animeCompleted >= 5) {
      return `Zero Drops! Du finishst was du anfängst. Respekt.`;
    }
    return null;
  },

  (data) => {
    if (data.stats.animeDropped >= 5) {
      const rate = Math.round((data.stats.animeDropped / (data.stats.animeCompleted + data.stats.animeDropped)) * 100);
      return `${data.stats.animeDropped} Drops (${rate}%). Qualität über Quantität - Zeitverschwendung ist keine Option.`;
    }
    return null;
  },

  (data) => {
    if (data.stats.completionRate >= 90) {
      return `${data.stats.completionRate}% Completion Rate. Du gibst nicht auf.`;
    }
    return null;
  },

  // =========================================================================
  // COMPARISON
  // =========================================================================
  (data) => {
    if (data.comparison && data.comparison.episodesDelta > 100) {
      return `+${data.comparison.episodesDelta} Episoden mehr als letztes ${data.type === 'monthly' ? 'Monat' : 'Jahr'}. Level Up!`;
    }
    return null;
  },

  (data) => {
    if (data.comparison && data.comparison.completionDelta > 5) {
      return `${data.comparison.completionDelta} mehr Anime abgeschlossen. Du wirst besser!`;
    }
    return null;
  },

  // =========================================================================
  // HIDDEN GEMS
  // =========================================================================
  (data) => {
    if (data.hiddenGems.length >= 2) {
      return `${data.hiddenGems.length} Hidden Gems gefunden! Du findest Schätze die andere übersehen.`;
    }
    return null;
  },

  // =========================================================================
  // MILESTONES
  // =========================================================================
  (data) => {
    if (data.milestones.length > 0) {
      return `${data.milestones.length} Meilenstein(e) erreicht! Du schreibst Geschichte.`;
    }
    return null;
  },

  // =========================================================================
  // PERSONA SPECIFIC
  // =========================================================================
  (data) => {
    if (data.persona.name === 'The Night Owl') {
      return `Nachteule confirmed. Wer braucht schon Schlaf wenn es noch eine Staffel gibt?`;
    }
    return null;
  },

  (data) => {
    if (data.persona.name === 'The Binge Monster') {
      return `Binge Monster Status: Aktiv. Die Snacks sollten besser reichenhalten.`;
    }
    return null;
  },

  // =========================================================================
  // VARIETY
  // =========================================================================
  (data) => {
    if (data.genreVariety >= 8) {
      return `${data.genres.length} verschiedene Genres. Dein Geschmack ist so vielfältig wie das Medium selbst.`;
    }
    return null;
  },
];

// Generate fun facts based on Echo data
export function generateEchoFunFacts(data: EchoData): string[] {
  const facts: string[] = [];

  for (const generator of FUN_FACT_GENERATORS) {
    const fact = generator(data);
    if (fact) {
      facts.push(fact);
    }
  }

  // Shuffle and return top 4-6 facts
  const shuffled = facts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(6, Math.max(4, facts.length)));
}
