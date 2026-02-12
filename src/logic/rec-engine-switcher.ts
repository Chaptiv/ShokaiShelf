/**
 * Recommendation Engine — NetRec V3
 */

import type { Media } from "@api/anilist";
import type { CandidateSource } from "@logic/netrecV3/types";
import { createEngine, type RecommendationResult } from "@logic/netrecV3";

// ============================================================================
// TYPES
// ============================================================================

export interface RecEngineResult {
  media: Media;
  score: number;
  reasons: string[];
  confidence?: number;
  sources?: CandidateSource[];
  source: "v3";
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

/**
 * Get recommendations using NetRec V3 engine
 */
export async function getRecommendations(
  userName: string,
  topK: number = 12
): Promise<RecEngineResult[]> {
  console.log("[RecEngine] 🚀 getRecommendations called");

  const engine = createEngine();
  const results = await engine.recommend(userName, topK);
  console.log(`[RecEngine] ✅ V3 returned ${results.length} results`);

  return results.map((r) => ({
    media: r.media,
    score: r.score,
    reasons: r.reasons,
    confidence: r.confidence,
    sources: r.sources ?? [],
    source: "v3" as const,
  }));
}

// ============================================================================
// HELPERS
// ============================================================================

export async function getEngineVersion(): Promise<string> {
  return "NetRecV3";
}

export async function getEngineStatus(): Promise<{
  version: string;
  enabled: boolean;
  features: string[];
}> {
  return {
    version: "NetRecV3",
    enabled: true,
    features: [
      "Collaborative Filtering (Item-Item)",
      "Content-Based (TF-IDF)",
      "Current-Similar Recommendations",
      "Relations & Sequels",
      "MMR Diversity Re-Ranking",
      "Smart Explanations",
      "UserStats Integration",
      "Advanced Filtering",
    ],
  };
}

