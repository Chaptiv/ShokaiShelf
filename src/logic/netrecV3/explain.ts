/**
 * AnimeNetRec V3 - Explanation System
 * 
 * Generate human-readable explanations for why anime was recommended
 * Always spoiler-free!
 * 
 * Uses i18n for all user-facing strings.
 */

import type { ScoredCandidate, Media, Features, MediaListEntry } from "./types";
import i18n from "i18next";
import { devLog, devWarn, logError } from "@utils/logger";


// Shorthand
const t = (key: string, opts?: Record<string, any>) => i18n.t(key, opts);

// ============================================================================
// REASON GENERATOR
// ============================================================================

/**
 * Generate top 3 reasons for recommendation (Dynamic & Personalized)
 */
export function generateReasons(
  candidate: ScoredCandidate,
  userEntries: MediaListEntry[]
): string[] {
  const reasons: Array<{ text: string; score: number }> = [];
  const features = candidate.features;
  const media = candidate.media;
  const episodes = media.episodes || 0;
  const year = media.startDate?.year || 0;
  const avgScore = media.averageScore || 0;

  // --- 1. Currently watching similar (highest priority) ---
  if (candidate.sources.includes("current-similar") && candidate.seedIds && candidate.seedIds.length > 0) {
    const seed = userEntries.find((e) => e.media.id === candidate.seedIds![0]);
    if (seed) {
      const seedTitle = getTitle(seed.media);
      const sharedGenres = findSharedGenres(media, seed.media);
      reasons.push({
        text: sharedGenres.length > 0
          ? t("explain.currentSimilarGenre", { title: seedTitle, genre: sharedGenres[0] })
          : t("explain.currentSimilar", { title: seedTitle }),
        score: 3.0,
      });
    }
  }

  // --- 2. Collaborative filtering (users with similar taste) ---
  if (candidate.sources.includes("cf") && candidate.seedIds && candidate.seedIds.length > 0) {
    const seeds = candidate.seedIds
      .slice(0, 3)
      .map((id) => userEntries.find((e) => e.media.id === id))
      .filter(Boolean) as MediaListEntry[];

    if (seeds.length >= 2) {
      const titles = seeds.map((s) => getTitle(s.media));
      const avgSeedScore = Math.round(seeds.reduce((sum, s) => sum + (s.score || 0), 0) / seeds.length);
      reasons.push({
        text: avgSeedScore >= 8
          ? t("explain.cfMultiLoved", { title1: titles[0], title2: titles[1] })
          : t("explain.cfMulti", { title1: titles[0], title2: titles[1] }),
        score: features.cfScore * 2.5,
      });
    } else if (seeds.length === 1) {
      const seedTitle = getTitle(seeds[0].media);
      const seedScore = seeds[0].score || 0;
      const sharedGenres = findSharedGenres(media, seeds[0].media);
      reasons.push({
        text: seedScore >= 8
          ? t("explain.cfSingleLoved", { title: seedTitle, genre: sharedGenres[0] || '' })
          : t("explain.cfSingle", { title: seedTitle }),
        score: features.cfScore * 2,
      });
    }
  }

  // --- 3. Feedback - similar to liked anime ---
  if (features.positiveSimilarity > 0.5) {
    const topGenre = media.genres?.[0];
    reasons.push({
      text: topGenre
        ? t("explain.likedSimilarGenre", { genre: topGenre })
        : t("explain.likedSimilar"),
      score: features.positiveSimilarity * 2.2,
    });
  }

  // --- 4. Feedback - avoids disliked patterns ---
  if (features.negativeSimilarity < 0.3 && features.isDisliked === false && features.positiveSimilarity > 0.3) {
    reasons.push({
      text: t("explain.feedbackAligned"),
      score: 1.8,
    });
  }

  // --- 5. Direct relation to watched anime ---
  if (features.relationType) {
    const relatedEntry = findRelated(media, userEntries);
    if (relatedEntry) {
      const relatedTitle = getTitle(relatedEntry.media);
      const relatedScore = relatedEntry.score || 0;
      reasons.push({
        text: relatedScore >= 8
          ? t("explain.relationLoved", { relation: t(`explain.relations.${features.relationType}`), title: relatedTitle })
          : t("explain.relation", { relation: t(`explain.relations.${features.relationType}`), title: relatedTitle }),
        score: 2.0,
      });
    }
  }

  // --- 6. Genre overlap with user statistics ---
  if (features.genreOverlap > 0.3 && media.genres && media.genres.length > 0) {
    const primaryGenre = media.genres[0];
    const genreStats = calculateGenreStats(primaryGenre, userEntries);

    if (genreStats.count >= 5) {
      const percentage = Math.round((genreStats.highScored / genreStats.count) * 100);
      reasons.push({
        text: t("explain.genreTrackRecord", { genre: primaryGenre, count: genreStats.count, percentage }),
        score: features.genreOverlap * 1.8,
      });
    } else if (genreStats.count >= 2) {
      reasons.push({
        text: t("explain.genreEnjoy", { genre: primaryGenre, count: genreStats.count }),
        score: features.genreOverlap * 1.5,
      });
    } else if (media.genres.length >= 2) {
      reasons.push({
        text: t("explain.genreCombo", { genre1: media.genres[0], genre2: media.genres[1] }),
        score: features.genreOverlap * 1.3,
      });
    }
  }

  // --- 7. Studio match with track record ---
  if (features.studioMatch && media.studios?.nodes) {
    const studio = media.studios.nodes[0]?.name;
    if (studio) {
      const studioEntries = userEntries.filter(
        (e) => e.media.studios?.nodes?.some((s) => s.name === studio) && e.status === "COMPLETED" && e.score
      );
      const studioAvg = studioEntries.length > 0
        ? studioEntries.reduce((sum, e) => sum + (e.score || 0), 0) / studioEntries.length
        : 0;

      if (studioEntries.length >= 3 && studioAvg >= 7) {
        reasons.push({
          text: t("explain.studioTrackRecord", { studio, count: studioEntries.length, avg: studioAvg.toFixed(1) }),
          score: 1.6,
        });
      } else if (studioAvg > 0) {
        reasons.push({
          text: t("explain.studioFamiliar", { studio, avg: studioAvg.toFixed(1) }),
          score: 1.3,
        });
      } else {
        reasons.push({
          text: t("explain.studioKnown", { studio }),
          score: 1.0,
        });
      }
    }
  }

  // --- 8. Tag/theme overlap with concrete examples ---
  if (features.tagOverlap > 0.4 && media.tags) {
    const topTags = media.tags
      .filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler && (t.rank || 0) >= 60)
      .slice(0, 3);

    if (topTags.length > 0) {
      const tagName = topTags[0].name;
      const exampleAnime = findAnimeWithTag(tagName, userEntries);

      if (exampleAnime) {
        const exampleScore = exampleAnime.score || 0;
        reasons.push({
          text: exampleScore >= 8
            ? t("explain.themeLovedExample", { theme: tagName, title: getTitle(exampleAnime.media) })
            : t("explain.themeExample", { theme: tagName, title: getTitle(exampleAnime.media) }),
          score: features.tagOverlap * 1.6,
        });
      } else if (topTags.length >= 2) {
        reasons.push({
          text: t("explain.themesMix", { theme1: topTags[0].name, theme2: topTags[1].name }),
          score: features.tagOverlap * 1.3,
        });
      } else {
        reasons.push({
          text: t("explain.themeStrong", { theme: tagName }),
          score: features.tagOverlap * 1.1,
        });
      }
    }
  }

  // --- 9. Fresh/seasonal with appeal ---
  if (features.isFresh) {
    const season = getCurrentSeason();
    const isCurrentSeason = (media as any).season && (media as any).seasonYear === new Date().getFullYear();

    if (isCurrentSeason && avgScore >= 80) {
      reasons.push({
        text: t("explain.seasonalHit", { season, score: avgScore }),
        score: 1.5,
      });
    } else if (isCurrentSeason) {
      reasons.push({
        text: t("explain.seasonalNew", { season }),
        score: 1.3,
      });
    } else if (year) {
      reasons.push({
        text: t("explain.recentRelease", { year }),
        score: 1.0,
      });
    }
  }

  // --- 10. Community rating with context ---
  if (avgScore >= 80) {
    const percentile = calculatePercentile(avgScore);
    if (avgScore >= 85) {
      reasons.push({
        text: t("explain.communityElite", { score: avgScore, percentile }),
        score: 1.2,
      });
    } else {
      reasons.push({
        text: t("explain.communityWellLoved", { score: avgScore }),
        score: 1.0,
      });
    }
  }

  // --- 11. Episode count / watchability ---
  if (features.bingeScore >= 0.8 && episodes > 0) {
    const avgUserEpisodes = calculateAverageCompleted(userEntries);

    if (episodes <= 13 && avgUserEpisodes <= 16) {
      reasons.push({
        text: t("explain.quickWatch", { episodes }),
        score: 0.9,
      });
    } else if (episodes >= 24 && avgUserEpisodes >= 20) {
      reasons.push({
        text: t("explain.longInvest", { episodes }),
        score: 0.8,
      });
    } else {
      reasons.push({
        text: t("explain.fitsLength", { episodes }),
        score: 0.7,
      });
    }
  }

  // --- 12. Format match ---
  if (features.formatMatch && media.format) {
    const completionRate = calculateFormatCompletionRate(media.format, userEntries);
    if (completionRate > 0.7) {
      const percentage = Math.round(completionRate * 100);
      reasons.push({
        text: t("explain.formatSuccess", { format: t(`explain.formats.${media.format}`), percentage }),
        score: 0.9,
      });
    }
  }

  // --- 13. Previously shown interest ---
  if (features.wasViewed) {
    reasons.push({
      text: t("explain.caughtEyeBefore"),
      score: 1.4,
    });
  }

  // Sort by score and take top 3
  reasons.sort((a, b) => b.score - a.score);
  return reasons.slice(0, 3).map((r) => r.text);
}

// ============================================================================
// DETAILED EXPLANATION
// ============================================================================

/**
 * Generate detailed explanation (for modal/hover)
 */
export function generateDetailedExplanation(
  candidate: ScoredCandidate,
  userEntries: MediaListEntry[]
): {
  primary: string;
  secondary: string[];
  confidence: number;
  sources: string[];
} {
  const reasons = generateReasons(candidate, userEntries);
  const primary = reasons[0] || t("explain.recommendedForYou");
  const secondary = reasons.slice(1);

  // Confidence based on score
  const confidence = Math.min(100, Math.round(candidate.scores.final * 100));

  // Sources
  const sources = candidate.sources.map((s) => formatSource(s));

  return {
    primary,
    secondary,
    confidence,
    sources,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTitle(media: Media): string {
  return media.title?.english || media.title?.romaji || media.title?.native || "Unknown";
}

/**
 * Find shared genres between two media
 */
function findSharedGenres(a: Media, b: Media): string[] {
  if (!a.genres || !b.genres) return [];
  return a.genres.filter((g) => b.genres!.includes(g));
}

/**
 * Calculate genre statistics for user
 */
function calculateGenreStats(
  genre: string,
  entries: MediaListEntry[]
): { count: number; highScored: number } {
  const genreEntries = entries.filter(
    (e) => e.media.genres?.includes(genre) && e.status === "COMPLETED"
  );

  const highScored = genreEntries.filter((e) => (e.score || 0) >= 8).length;

  return {
    count: genreEntries.length,
    highScored,
  };
}

/**
 * Calculate average score for studio
 */
function calculateStudioAverage(studio: string, entries: MediaListEntry[]): number {
  const studioEntries = entries.filter(
    (e) =>
      e.media.studios?.nodes?.some((s) => s.name === studio) &&
      e.status === "COMPLETED" &&
      e.score
  );

  if (studioEntries.length === 0) return 0;

  const total = studioEntries.reduce((sum, e) => sum + (e.score || 0), 0);
  return total / studioEntries.length;
}

/**
 * Find anime with specific tag
 */
function findAnimeWithTag(tag: string, entries: MediaListEntry[]): MediaListEntry | null {
  const withTag = entries.find(
    (e) =>
      e.media.tags?.some((t) => t.name === tag) &&
      e.status === "COMPLETED" &&
      (e.score || 0) >= 7
  );

  return withTag || null;
}

/**
 * Get current season
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 1 && month <= 3) return t("explain.seasons.winter");
  if (month >= 4 && month <= 6) return t("explain.seasons.spring");
  if (month >= 7 && month <= 9) return t("explain.seasons.summer");
  return t("explain.seasons.fall");
}

/**
 * Calculate percentile for score
 */
function calculatePercentile(score: number): number {
  // Rough approximation based on AniList distribution
  if (score >= 85) return 95;
  if (score >= 80) return 85;
  if (score >= 75) return 70;
  if (score >= 70) return 50;
  if (score >= 65) return 30;
  return 20;
}

/**
 * Estimate popularity rank
 */
function estimatePopularityRank(popularity: number): number {
  // Rough approximation
  if (popularity >= 500000) return 10;
  if (popularity >= 300000) return 25;
  if (popularity >= 200000) return 50;
  if (popularity >= 100000) return 100;
  if (popularity >= 50000) return 200;
  return 500;
}

/**
 * Calculate average episodes completed
 */
function calculateAverageCompleted(entries: MediaListEntry[]): number {
  const completed = entries.filter(
    (e) => e.status === "COMPLETED" && e.media.episodes
  );

  if (completed.length === 0) return 12; // Default

  const total = completed.reduce((sum, e) => sum + (e.media.episodes || 0), 0);
  return total / completed.length;
}

/**
 * Calculate format completion rate
 */
function calculateFormatCompletionRate(format: string, entries: MediaListEntry[]): number {
  const withFormat = entries.filter((e) => e.media.format === format);
  if (withFormat.length === 0) return 0;

  const completed = withFormat.filter((e) => e.status === "COMPLETED");
  return completed.length / withFormat.length;
}

function formatPopularity(pop: number): string {
  if (pop >= 1000000) return t("explain.popMillions", { count: (pop / 1000000).toFixed(1) });
  if (pop >= 1000) return t("explain.popThousands", { count: (pop / 1000).toFixed(0) });
  return t("explain.popUsers", { count: pop });
}

function formatRelation(relation: string): string {
  return t(`explain.relations.${relation}`, { defaultValue: relation });
}

function formatFormat(format: string): string {
  return t(`explain.formats.${format}`, { defaultValue: format });
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    cf: "Collaborative Filtering",
    content: "Content-Based",
    trending: "Trending",
    relations: t("explain.sourceRelations"),
  };
  return map[source] || source;
}

function findRelated(media: Media, userEntries: MediaListEntry[]): MediaListEntry | null {
  if (!media.relations?.edges) return null;

  for (const edge of media.relations.edges) {
    if (!edge.node) continue;
    const entry = userEntries.find((e) => e.media.id === edge.node?.id);
    if (entry) return entry;
  }

  return null;
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate confidence score (0-100)
 * IMPROVED: More generous scoring to reach 60-80% range
 */
export function calculateConfidence(candidate: ScoredCandidate): number {
  const scores = candidate.scores;

  // Base confidence from meta score (0-70 points, was 0-50)
  let confidence = scores.meta * 70;

  // Multiple sources bonus (more significant)
  confidence += candidate.sources.length * 8;

  // CF bonus (strong signal)
  if (scores.cf >= 0.9) confidence += 15;
  else if (scores.cf >= 0.7) confidence += 12;
  else if (scores.cf >= 0.5) confidence += 8;

  // Content bonus (strong signal)
  if (scores.content >= 0.7) confidence += 12;
  else if (scores.content >= 0.5) confidence += 8;
  else if (scores.content >= 0.3) confidence += 5;

  // Fresh anime bonus
  if (scores.freshness > 0.8) confidence += 8;
  else if (scores.freshness > 0.5) confidence += 5;

  // Relations bonus (very safe bet)
  if (scores.relationBoost > 0.3) confidence += 15;
  else if (scores.relationBoost > 0.2) confidence += 10;

  // Reasons count bonus (more reasons = more confident)
  if (candidate.reasons && candidate.reasons.length >= 3) confidence += 5;

  return Math.min(100, Math.round(confidence));
}

// ============================================================================
// EXPLANATION TEMPLATES
// ============================================================================

/**
 * Get explanation template based on sources
 */
export function getExplanationTemplate(sources: string[]): string {
  if (sources.includes("cf") && sources.includes("content")) {
    return t("explain.templateCfContent");
  }
  if (sources.includes("cf")) {
    return t("explain.templateCf");
  }
  if (sources.includes("content")) {
    return t("explain.templateContent");
  }
  if (sources.includes("trending")) {
    return t("explain.templateTrending");
  }
  if (sources.includes("relations")) {
    return t("explain.templateRelations");
  }
  return t("explain.recommendedForYou");
}

// ============================================================================
// EXPORT EXPLANATION
// ============================================================================

/**
 * Export complete explanation for UI
 */
export function exportExplanation(
  candidate: ScoredCandidate,
  userEntries: MediaListEntry[]
): {
  title: string;
  reasons: string[];
  detailed: {
    primary: string;
    secondary: string[];
    confidence: number;
    sources: string[];
  };
  template: string;
  scores: {
    cf: number;
    content: number;
    meta: number;
    final: number;
  };
} {
  const reasons = generateReasons(candidate, userEntries);
  const detailed = generateDetailedExplanation(candidate, userEntries);
  const template = getExplanationTemplate(candidate.sources);
  const title = getTitle(candidate.media);

  return {
    title,
    reasons,
    detailed,
    template,
    scores: {
      cf: Math.round(candidate.scores.cf * 100) / 100,
      content: Math.round(candidate.scores.content * 100) / 100,
      meta: Math.round(candidate.scores.meta * 100) / 100,
      final: Math.round(candidate.scores.final * 100) / 100,
    },
  };
}

// ============================================================================
// SPOILER-FREE GUARANTEE
// ============================================================================

/**
 * Validate explanation is spoiler-free
 */
export function isSpoilerFree(explanation: string, media: Media): boolean {
  if (!media.tags) return true;

  // Check for spoiler tag names in explanation
  const spoilerTags = media.tags.filter(
    (t) => t.isMediaSpoiler || t.isGeneralSpoiler
  );

  for (const tag of spoilerTags) {
    if (explanation.toLowerCase().includes(tag.name.toLowerCase())) {
      devWarn(`[Explain] Spoiler detected: ${tag.name}`);
      return false;
    }
  }

  return true;
}

/**
 * Sanitize explanation (remove potential spoilers)
 */
export function sanitizeExplanation(explanation: string, media: Media): string {
  if (!media.tags) return explanation;

  let sanitized = explanation;
  const spoilerTags = media.tags.filter(
    (t) => t.isMediaSpoiler || t.isGeneralSpoiler
  );

  for (const tag of spoilerTags) {
    const regex = new RegExp(tag.name, "gi");
    sanitized = sanitized.replace(regex, "[Spoiler]");
  }

  return sanitized;
}