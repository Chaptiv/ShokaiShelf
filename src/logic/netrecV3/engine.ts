/**
 * AnimeNetRec V3 - Core Engine
 * 
 * The ultimate anime recommendation engine
 * Combines CF, Content-Based, Temporal, Relations, and MMR
 */

import type {
  UserProfile,
  Candidate,
  ScoredCandidate,
  RecommendationResult,
  EngineConfig,
  Media,
  MediaListEntry,
} from "./types";

// DEFAULT_CONFIG ist ein Value, kein Type!
import { DEFAULT_CONFIG } from "./types";

import {
  fetchUserLibrary,
  fetchUserStats,
  fetchRecommendations,
  fetchTrending,
} from "./queries";

import {
  buildFeatures,
  extractUserPreferences,
  buildTFIDFVector,
  cosineSimilarity,
  timeDecay,
  daysSinceRelease,
} from "./features";

import {
  applyFilters,
  validateCandidates,
} from "./filters";

import {
  mmrReRank,
  getLambdaForMode,
  adaptiveLambda,
  calculateDiversityScore,
} from "./mmr";

import {
  generateReasons,
  calculateConfidence,
  exportExplanation,
} from "./explain";

import {
  loadUserFeedbacks,
  loadUserInteractions,
} from "./feedback";

// ============================================================================
// ANIME NET REC V3
// ============================================================================

export class AnimeNetRecV3 {
  private config: EngineConfig;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main recommendation method
   */
  async recommend(
    userName: string,
    topK: number = 12
  ): Promise<RecommendationResult[]> {
    console.log(`[NetRecV3] Starting recommendation for ${userName}`);

    // 1. Load user profile
    const profile = await this.loadUserProfile(userName);
    console.log(`[NetRecV3] Loaded ${profile.entries.length} entries`);

    // 2. Generate candidates
    const candidates = await this.generateCandidates(profile);
    console.log(`[NetRecV3] Generated ${candidates.length} candidates`);

    // 3. Filter candidates
    const filtered = applyFilters(
      candidates,
      profile.entries,
      profile.preferences
    );
    console.log(`[NetRecV3] After filtering: ${filtered.length}`);

    // 4. Score candidates
    const scored = this.scoreCandidates(filtered, profile);
    console.log(`[NetRecV3] Scored ${scored.length} candidates`);

    // 5. Sort by meta score
    scored.sort((a, b) => b.scores.meta - a.scores.meta);

    // 6. MMR Re-ranking
    const mode = profile.preferences?.mode || "balanced";
    const lambda = adaptiveLambda(
      extractUserPreferences(profile.entries).genres,
      mode
    );
    const reranked = mmrReRank(scored, lambda, topK);
    console.log(`[NetRecV3] Re-ranked to ${reranked.length} results`);

    // 7. Generate explanations
    const results = this.createResults(reranked, profile);

    // 8. Log diversity
    const diversityScore = calculateDiversityScore(reranked);
    console.log(`[NetRecV3] Diversity score: ${diversityScore.toFixed(3)}`);

    return results;
  }

  /**
   * Load user profile
   */
  protected async loadUserProfile(userName: string): Promise<UserProfile> {
    const entries = await fetchUserLibrary(userName);
    const stats = await fetchUserStats(userName).catch(() => undefined);

    // Phase 2: Load feedback and interactions
    const feedbacks = await loadUserFeedbacks(userName);
    const interactions = await loadUserInteractions(userName);

    console.log(
      `[NetRecV3] Loaded ${feedbacks.likes.size} likes, ${feedbacks.dislikes.size} dislikes`
    );
    console.log(
      `[NetRecV3] Loaded ${interactions.clicks.size} clicks, ${interactions.views.size} views`
    );

    // Load user preferences
    let userPrefs: any = null;
    try {
      const { getPreferences } = await import("../preferences-store");
      userPrefs = await getPreferences();
      console.log(
        `[NetRecV3] Loaded user preferences: ${userPrefs.favoriteGenres.length} favorites, ${userPrefs.dislikedGenres.length} dislikes`
      );
    } catch (error) {
      console.warn("[NetRecV3] Failed to load user preferences:", error);
    }

    return {
      userId: userName,
      entries,
      stats,
      feedbacks,
      interactions,
      preferences: {
        mode: "balanced",
        excludeGenres: userPrefs?.dislikedGenres || [],
        excludeTags: [],
        excludeStudios: [], // NEW!
        neverShow: [], // NEW!
        showAdult: false,
        favoriteGenres: userPrefs?.favoriteGenres || [], // NEW: For boosting
        selectedAnimeIds: userPrefs?.selectedAnimeIds || [], // NEW: For cold start
      },
    };
  }

  /**
   * Generate candidates from multiple sources
   */
  protected async generateCandidates(
    profile: UserProfile
  ): Promise<Candidate[]> {
    const candidates: Candidate[] = [];

    // 1. Similar to Currently Watching (NEW!)
    const currentCandidates = await this.generateCurrentSimilarCandidates(profile);
    candidates.push(...currentCandidates);
    console.log(`[Candidates] Current-Similar: ${currentCandidates.length}`);

    // 2. CF Candidates
    const cfCandidates = await this.generateCFCandidates(profile);
    candidates.push(...cfCandidates);
    console.log(`[Candidates] CF: ${cfCandidates.length}`);

    // 3. Content Candidates
    const contentCandidates = await this.generateContentCandidates(profile);
    candidates.push(...contentCandidates);
    console.log(`[Candidates] Content: ${contentCandidates.length}`);

    // 4. Relations Candidates (NEW!)
    const relationsCandidates = await this.generateRelationsCandidates(profile);
    candidates.push(...relationsCandidates);
    console.log(`[Candidates] Relations: ${relationsCandidates.length}`);

    // 5. Trending Fallback
    const trendingCandidates = await this.generateTrendingCandidates(profile);
    candidates.push(...trendingCandidates);
    console.log(`[Candidates] Trending: ${trendingCandidates.length}`);

    return candidates;
  }

  /**
   * Generate candidates similar to currently watching anime
   */
  private async generateCurrentSimilarCandidates(
    profile: UserProfile
  ): Promise<Candidate[]> {
    // Get currently watching anime
    const currentAnime = profile.entries
      .filter((e) => e.status === "CURRENT")
      .slice(0, 5) // Max 5 seeds
      .map((e) => e.media);

    if (currentAnime.length === 0) return [];

    console.log(`[Current-Similar] Using ${currentAnime.length} currently watching anime as seeds`);

    // Build TF-IDF vectors for seeds
    const seedVectors = currentAnime.map((media) => buildTFIDFVector(media));

    // Fetch trending as candidate pool
    const pool = await fetchTrending(100);

    // Calculate cosine similarity
    const scored: Array<{ media: Media; score: number; seedId: number }> = [];
    for (const candidate of pool) {
      const candidateVec = buildTFIDFVector(candidate);
      let maxSimilarity = 0;
      let bestSeedIdx = 0;

      for (let i = 0; i < seedVectors.length; i++) {
        const sim = cosineSimilarity(candidateVec, seedVectors[i]);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          bestSeedIdx = i;
        }
      }

      // Higher threshold for current-similar (0.4 instead of 0.3)
      if (maxSimilarity > 0.4) {
        scored.push({
          media: candidate,
          score: maxSimilarity,
          seedId: currentAnime[bestSeedIdx].id,
        });
      }
    }

    // Sort and take top 30
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 30);

    return top.map((item) => ({
      media: item.media,
      sources: ["current-similar"],
      seedIds: [item.seedId],
    }));
  }

  /**
   * Generate relation candidates (sequels, prequels, etc.)
   */
  private async generateRelationsCandidates(
    profile: UserProfile
  ): Promise<Candidate[]> {
    const candidates: Candidate[] = [];

    // Get high-scored completed anime (potential for sequels)
    const seeds = profile.entries
      .filter((e) => e.status === "COMPLETED" && (e.score || 0) >= 8)
      .slice(0, 15); // Check top 15

    for (const entry of seeds) {
      const media = entry.media;
      if (!media.relations?.edges) continue;

      for (const edge of media.relations.edges) {
        if (!edge.node || !edge.relationType) continue;

        // Only recommend sequels, prequels, side stories
        if (
          edge.relationType === "SEQUEL" ||
          edge.relationType === "PREQUEL" ||
          edge.relationType === "SIDE_STORY"
        ) {
          candidates.push({
            media: edge.node,
            sources: ["relations"],
            seedIds: [media.id],
          });
        }
      }
    }

    console.log(`[Relations] Found ${candidates.length} relation candidates`);
    return candidates;
  }

  /**
   * Generate CF candidates via recommendations API
   */
  private async generateCFCandidates(
    profile: UserProfile
  ): Promise<Candidate[]> {
    // Select seeds: high-scored completed anime
    const seeds = profile.entries
      .filter((e) => e.status === "COMPLETED" && (e.score || 0) >= 8)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, this.config.maxSeedsPerBatch)
      .map((e) => e.media.id);

    if (seeds.length === 0) {
      // Fallback: use any completed
      const fallbackSeeds = profile.entries
        .filter((e) => e.status === "COMPLETED")
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, this.config.maxSeedsPerBatch)
        .map((e) => e.media.id);
      seeds.push(...fallbackSeeds);
    }

    if (seeds.length === 0) return [];

    console.log(`[CF] Using ${seeds.length} seeds`);

    // Fetch recommendations
    const recsMap = await fetchRecommendations(seeds);

    // Aggregate with log-dampening
    const aggregated = new Map<
      number,
      { media: Media; rating: number; count: number; seedIds: number[] }
    >();

    for (const [seedId, recs] of recsMap) {
      for (const rec of recs) {
        const id = rec.media.id;
        const existing = aggregated.get(id);

        if (existing) {
          // Log-dampening: log(1 + rating)
          existing.rating += Math.log1p(rec.rating);
          existing.count += 1;
          existing.seedIds.push(seedId);
        } else {
          aggregated.set(id, {
            media: rec.media,
            rating: Math.log1p(rec.rating),
            count: 1,
            seedIds: [seedId],
          });
        }
      }
    }

    // Convert to candidates
    const candidates: Candidate[] = [];
    for (const [id, data] of aggregated) {
      // Popularity dampening
      const popularity = data.media.popularity || 1;
      const dampened = data.rating / Math.log1p(popularity);

      candidates.push({
        media: data.media,
        sources: ["cf"],
        seedIds: data.seedIds,
      });
    }

    return candidates;
  }

  /**
   * Generate content-based candidates
   */
  private async generateContentCandidates(
    profile: UserProfile
  ): Promise<Candidate[]> {
    // Use completed high-scored anime as seeds
    const seeds = profile.entries
      .filter((e) => e.status === "COMPLETED" && (e.score || 0) >= 7)
      .slice(0, 10)
      .map((e) => e.media);

    if (seeds.length === 0) return [];

    // Build TF-IDF vectors for seeds
    const seedVectors = seeds.map((media) => buildTFIDFVector(media));

    // Fetch trending as candidate pool
    const pool = await fetchTrending(this.config.contentKNN);

    // Calculate cosine similarity
    const scored: Array<{ media: Media; score: number }> = [];
    for (const candidate of pool) {
      const candidateVec = buildTFIDFVector(candidate);
      let maxSimilarity = 0;

      for (const seedVec of seedVectors) {
        const sim = cosineSimilarity(candidateVec, seedVec);
        maxSimilarity = Math.max(maxSimilarity, sim);
      }

      if (maxSimilarity > 0.3) {
        scored.push({ media: candidate, score: maxSimilarity });
      }
    }

    // Sort and take top K
    scored.sort((a, b) => b.score - a.score);
    const topK = scored.slice(0, this.config.contentKNN);

    return topK.map((item) => ({
      media: item.media,
      sources: ["content"],
    }));
  }

  /**
   * Generate trending fallback candidates
   */
  private async generateTrendingCandidates(
    profile: UserProfile
  ): Promise<Candidate[]> {
    const trending = await fetchTrending(this.config.trendingFallback);

    return trending.map((media) => ({
      media,
      sources: ["trending"],
    }));
  }

  /**
   * Score all candidates
   */
  protected scoreCandidates(
    candidates: Candidate[],
    profile: UserProfile
  ): ScoredCandidate[] {
    return candidates.map((candidate) =>
      this.scoreCandidate(candidate, profile)
    );
  }

  /**
   * Score single candidate
   */
  private scoreCandidate(
    candidate: Candidate,
    profile: UserProfile
  ): ScoredCandidate {
    const features = buildFeatures(candidate.media, profile);

    // CF Score (if from CF source)
    const cfScore = candidate.sources.includes("cf") ? 1.0 : 0;

    // Content Score (boosted by UserStats!)
    let contentScore =
      features.genreOverlap * 0.5 +
      features.tagOverlap * 0.3 +
      (features.studioMatch ? 0.1 : 0) +
      (features.formatMatch ? 0.05 : 0) +
      (features.sourceMatch ? 0.05 : 0);

    // NEW: UserStats boost (if user has high mean score for genres/tags/studios)
    if (profile.stats) {
      // Genre boost
      const genreBoost = this.calculateUserStatsBoost(
        candidate.media.genres || [],
        profile.stats.genres || [],
        (item) => item
      );
      contentScore += genreBoost * 0.15;

      // Studio boost
      const studioBoost = this.calculateUserStatsBoost(
        (candidate.media.studios?.nodes || []).map((s) => s.name),
        profile.stats.studios || [],
        (item) => item.name
      );
      contentScore += studioBoost * 0.1;
    }

    // NEW: Favorite Genre Boost (from user preferences)
    if (profile.preferences?.favoriteGenres && profile.preferences.favoriteGenres.length > 0) {
      const mediaGenres = candidate.media.genres || [];
      const favoriteGenreMatches = mediaGenres.filter((genre) =>
        profile.preferences.favoriteGenres?.includes(genre)
      ).length;
      if (favoriteGenreMatches > 0) {
        const favoriteBoost = (favoriteGenreMatches / mediaGenres.length) * 0.2;
        contentScore += favoriteBoost;
      }
    }

    // Freshness Score
    const freshnessScore = features.isFresh ? 1.0 : 0;

    // Relation Boost (now from source!)
    let relationBoost = features.relationType ? 0.4 : 0;
    if (candidate.sources.includes("relations")) {
      relationBoost = 1.0; // Strong boost for direct relations
    }

    // Current-Similar Boost
    const currentSimilarBoost = candidate.sources.includes("current-similar") ? 0.5 : 0;

    // Status Multiplier
    const statusMult = features.isDropped ? 0.5 : features.isPaused ? 1.2 : 1.0;

    // Time Decay
    const decay = timeDecay(
      features.daysSinceRelease,
      this.config.timeDecayLambda
    );

    // Binge Score
    const bingeScore = features.bingeScore;

    // Phase 2: Feedback Score
    const feedbackScore = features.positiveSimilarity * this.config.feedbackBoost;

    // Phase 2: Negative Signal (penalty)
    const negativeSignal = features.negativeSimilarity * this.config.negativePenalty;

    // Phase 2: Interaction Score
    let interactionScore = 0;
    if (features.wasClicked) interactionScore += this.config.clickBoost;
    if (features.wasViewed) interactionScore += this.config.viewBoost;

    // Meta Score (Phase 2: Updated with feedback + NEW sources)
    let metaScore =
      this.config.weights.cf * cfScore +
      this.config.weights.content * contentScore +
      this.config.weights.freshness * freshnessScore +
      this.config.weights.relations * relationBoost +
      this.config.weights.feedback * feedbackScore +
      this.config.weights.interaction * interactionScore +
      0.15 * currentSimilarBoost; // NEW: Current-similar boost

    // Apply negative signal (penalty)
    metaScore -= this.config.weights.negativeSignal * negativeSignal;

    // Apply multipliers
    metaScore *= statusMult;
    metaScore *= decay;
    metaScore *= 0.9 + 0.2 * bingeScore;

    // Hard block for disliked anime
    if (features.isDisliked) {
      metaScore *= 0.1; // Heavy penalty
    }

    // Clamp
    metaScore = Math.max(0, Math.min(1, metaScore));

    // Generate reasons
    const scoredCandidate: ScoredCandidate = {
      ...candidate,
      scores: {
        cf: cfScore,
        content: contentScore,
        freshness: freshnessScore,
        relationBoost,
        statusMult,
        timeDecay: decay,
        binge: bingeScore,
        meta: metaScore,
        mmr: 0, // Set by MMR
        final: metaScore, // Updated by MMR
      },
      features,
      reasons: [],
    };

    scoredCandidate.reasons = generateReasons(scoredCandidate, profile.entries);

    return scoredCandidate;
  }

  /**
   * Create final results
   */
  private createResults(
    scored: ScoredCandidate[],
    profile: UserProfile
  ): RecommendationResult[] {
    return scored.map((candidate) => {
      const explanation = exportExplanation(candidate, profile.entries);

      return {
        media: candidate.media,
        score: candidate.scores.final,
        reasons: explanation.reasons,
        confidence: calculateConfidence(candidate),
        sources: candidate.sources,
      };
    });
  }

  /**
   * Calculate UserStats boost
   * Returns 0-1 based on user's mean score for matching items
   */
  private calculateUserStatsBoost<T, U>(
    candidateItems: T[],
    userStats: U[],
    getName: (item: U) => string
  ): number {
    if (candidateItems.length === 0 || userStats.length === 0) return 0;

    let totalBoost = 0;
    let matchCount = 0;

    for (const candidateItem of candidateItems) {
      const itemStr = String(candidateItem);
      const stat = userStats.find((s) => getName(s) === itemStr);

      if (stat && "meanScore" in stat) {
        const meanScore = (stat as any).meanScore;
        // Normalize mean score (0-10 scale → 0-1)
        if (typeof meanScore === "number" && meanScore > 0) {
          // High mean score = boost, low = penalty
          // 8+ → positive, 6- → negative
          const normalized = (meanScore - 6) / 4; // Range: -1.5 to 1.0
          totalBoost += Math.max(-0.5, Math.min(1, normalized));
          matchCount++;
        }
      }
    }

    return matchCount > 0 ? totalBoost / matchCount : 0;
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): EngineConfig {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createEngine(config?: Partial<EngineConfig>): AnimeNetRecV3 {
  return new AnimeNetRecV3(config);
}