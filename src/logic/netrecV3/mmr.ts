/**
 * AnimeNetRec V3 - MMR Re-Ranking
 * 
 * Maximal Marginal Relevance algorithm for diversity
 * Balances relevance with diversity to prevent filter bubble
 */

import type { ScoredCandidate } from "./types";
import { buildTFIDFVector, cosineSimilarity } from "./features";
import { devLog, devWarn, logError } from "@utils/logger";


// ============================================================================
// MMR ALGORITHM
// ============================================================================

/**
 * MMR Re-Ranking
 * 
 * @param candidates - Scored candidates (must be sorted by meta score desc)
 * @param lambda - Diversity parameter (0 = max diversity, 1 = max relevance)
 * @param topK - Number of results to return
 * @returns Re-ranked candidates
 */
export function mmrReRank(
  candidates: ScoredCandidate[],
  lambda: number = 0.5,
  topK: number = 12
): ScoredCandidate[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= topK) {
    // Not enough candidates, just return all
    return candidates.map((c, i) => ({
      ...c,
      scores: {
        ...c.scores,
        mmr: c.scores.meta * lambda,
        final: c.scores.meta * lambda,
      },
    }));
  }

  // Pre-compute TF-IDF vectors for all candidates
  const vectors = new Map<number, Map<string, number>>();
  for (const candidate of candidates) {
    vectors.set(candidate.media.id, buildTFIDFVector(candidate.media));
  }

  // Selected set (results)
  const selected: ScoredCandidate[] = [];
  const selectedIds = new Set<number>();

  // Remaining candidates
  let remaining = [...candidates];

  // MMR iteration
  while (selected.length < topK && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIdx = -1;
    let bestMMR = 0;

    // For each remaining candidate
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const candidateVec = vectors.get(candidate.media.id);

      if (!candidateVec) continue;

      // Relevance (normalized meta score)
      const relevance = candidate.scores.meta;

      // Diversity (max similarity to selected)
      let maxSimilarity = 0;
      if (selected.length > 0) {
        for (const selectedCandidate of selected) {
          const selectedVec = vectors.get(selectedCandidate.media.id);
          if (!selectedVec) continue;

          const similarity = cosineSimilarity(candidateVec, selectedVec);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      // MMR score
      const mmr = lambda * relevance - (1 - lambda) * maxSimilarity;

      // Track best
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
        bestMMR = mmr;
      }
    }

    // Add best candidate
    if (bestIdx >= 0) {
      const best = remaining[bestIdx];
      selected.push({
        ...best,
        scores: {
          ...best.scores,
          mmr: bestMMR,
          final: bestMMR,
        },
      });
      selectedIds.add(best.media.id);
      remaining.splice(bestIdx, 1);
    } else {
      // Shouldn't happen, but safety break
      break;
    }
  }

  devLog(`[MMR] Re-ranked ${selected.length} candidates (λ=${lambda})`);

  return selected;
}

// ============================================================================
// LAMBDA MODES
// ============================================================================

/**
 * Get lambda value for mode
 */
export function getLambdaForMode(
  mode: "safe" | "balanced" | "adventurous"
): number {
  switch (mode) {
    case "safe":
      return 0.7; // High relevance, low diversity
    case "balanced":
      return 0.5; // Equal balance
    case "adventurous":
      return 0.3; // High diversity, lower relevance
    default:
      return 0.5;
  }
}

// ============================================================================
// DIVERSITY METRICS
// ============================================================================

/**
 * Calculate diversity score for a set of recommendations
 */
export function calculateDiversityScore(
  recommendations: ScoredCandidate[]
): number {
  if (recommendations.length <= 1) return 0;

  // Compute pairwise cosine distances
  const vectors = recommendations.map((r) => buildTFIDFVector(r.media));
  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const similarity = cosineSimilarity(vectors[i], vectors[j]);
      const distance = 1 - similarity; // Distance = 1 - similarity
      totalDistance += distance;
      pairCount++;
    }
  }

  return pairCount > 0 ? totalDistance / pairCount : 0;
}

/**
 * Calculate genre diversity
 */
export function calculateGenreDiversity(
  recommendations: ScoredCandidate[]
): number {
  const genres = new Set<string>();
  let totalGenres = 0;

  for (const rec of recommendations) {
    if (rec.media.genres) {
      for (const genre of rec.media.genres) {
        genres.add(genre);
        totalGenres++;
      }
    }
  }

  // Unique genres / total genres
  return totalGenres > 0 ? genres.size / totalGenres : 0;
}

/**
 * Calculate studio diversity
 */
export function calculateStudioDiversity(
  recommendations: ScoredCandidate[]
): number {
  const studios = new Set<string>();
  let totalStudios = 0;

  for (const rec of recommendations) {
    if (rec.media.studios?.nodes) {
      for (const studio of rec.media.studios.nodes) {
        studios.add(studio.name);
        totalStudios++;
      }
    }
  }

  return totalStudios > 0 ? studios.size / totalStudios : 0;
}

/**
 * Complete diversity report
 */
export function diversityReport(
  recommendations: ScoredCandidate[]
): {
  overallScore: number;
  genreDiversity: number;
  studioDiversity: number;
  genreBreakdown: Record<string, number>;
} {
  const overallScore = calculateDiversityScore(recommendations);
  const genreDiversity = calculateGenreDiversity(recommendations);
  const studioDiversity = calculateStudioDiversity(recommendations);

  // Genre breakdown
  const genreCount: Record<string, number> = {};
  for (const rec of recommendations) {
    if (rec.media.genres) {
      for (const genre of rec.media.genres) {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      }
    }
  }

  return {
    overallScore,
    genreDiversity,
    studioDiversity,
    genreBreakdown: genreCount,
  };
}

// ============================================================================
// ADAPTIVE LAMBDA
// ============================================================================

/**
 * Adaptive lambda based on user history
 * Users with diverse history get higher diversity
 */
export function adaptiveLambda(
  userGenres: string[],
  mode: "safe" | "balanced" | "adventurous"
): number {
  const baseLambda = getLambdaForMode(mode);

  // If user has diverse genre history (>7 genres), increase diversity slightly
  if (userGenres.length > 7) {
    return Math.max(0.3, baseLambda - 0.1);
  }

  // If user has narrow history (<4 genres), increase relevance slightly
  if (userGenres.length < 4) {
    return Math.min(0.8, baseLambda + 0.1);
  }

  return baseLambda;
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log MMR statistics
 */
export function logMMRStats(
  before: ScoredCandidate[],
  after: ScoredCandidate[],
  lambda: number
): void {
  const beforeDiversity = calculateDiversityScore(before.slice(0, 12));
  const afterDiversity = calculateDiversityScore(after);

  devLog(`[MMR] Statistics:
    Lambda: ${lambda}
    Before diversity: ${beforeDiversity.toFixed(3)}
    After diversity: ${afterDiversity.toFixed(3)}
    Improvement: ${((afterDiversity - beforeDiversity) * 100).toFixed(1)}%
  `);
}

// ============================================================================
// QUALITY CHECKS
// ============================================================================

/**
 * Validate MMR output
 */
export function validateMMROutput(
  input: ScoredCandidate[],
  output: ScoredCandidate[],
  topK: number
): boolean {
  // Check length
  if (output.length > topK) {
    logError(`[MMR] Output length ${output.length} exceeds topK ${topK}`);
    return false;
  }

  // Check no duplicates
  const ids = new Set(output.map((r) => r.media.id));
  if (ids.size !== output.length) {
    logError("[MMR] Duplicate IDs in output");
    return false;
  }

  // Check all came from input
  const inputIds = new Set(input.map((r) => r.media.id));
  for (const rec of output) {
    if (!inputIds.has(rec.media.id)) {
      logError(`[MMR] Output contains ID ${rec.media.id} not in input`);
      return false;
    }
  }

  return true;
}