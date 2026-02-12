/**
 * AnimeNetRec V3 - Feedback & Interaction Loader
 *
 * Loads user feedback (likes/dislikes) and interaction data (clicks/views)
 * Compatible with V2 feedback storage format
 */

import type { UserFeedbacks, UserInteractions } from "./types";

// ============================================================================
// FEEDBACK LOADER (Compatible with V2)
// ============================================================================

/**
 * Load user feedbacks from storage
 * Compatible with V2 format: netrec:feedback:${userId}:${animeId}
 * AND new V3 unified format: shokai.feedback
 */
export async function loadUserFeedbacks(userId: string): Promise<UserFeedbacks> {
  const likes = new Set<number>();
  const dislikes = new Set<number>();

  try {
    // Access electron store
    const store = (window as any).shokai?.store;

    // First, try loading from new unified feedback storage (preferred)
    const UNIFIED_KEY = "shokai.feedback";

    // Try electron store first
    if (store) {
      try {
        const unifiedData = await store.get(UNIFIED_KEY);
        if (unifiedData && typeof unifiedData === "object") {
          for (const [mediaIdStr, entry] of Object.entries(unifiedData)) {
            const mediaId = parseInt(mediaIdStr, 10);
            if (!isNaN(mediaId) && typeof entry === "object" && entry !== null) {
              const feedback = entry as { type: string };
              if (feedback.type === "like") {
                likes.add(mediaId);
              } else if (feedback.type === "dislike") {
                dislikes.add(mediaId);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Feedback] Failed to load from unified store:", e);
      }
    }

    // Also check localStorage for unified format
    if (typeof localStorage !== "undefined") {
      try {
        const localUnified = localStorage.getItem(UNIFIED_KEY);
        if (localUnified) {
          const unifiedData = JSON.parse(localUnified);
          for (const [mediaIdStr, entry] of Object.entries(unifiedData)) {
            const mediaId = parseInt(mediaIdStr, 10);
            if (!isNaN(mediaId) && typeof entry === "object" && entry !== null) {
              const feedback = entry as { type: string };
              if (feedback.type === "like") {
                likes.add(mediaId);
              } else if (feedback.type === "dislike") {
                dislikes.add(mediaId);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Feedback] Failed to load from unified localStorage:", e);
      }
    }

    // Fallback: Try legacy V2 format for backwards compatibility
    const prefix = `netrec:feedback:${userId}:`;
    if (typeof localStorage !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const animeIdStr = key.replace(prefix, "");
          const animeId = parseInt(animeIdStr, 10);

          if (!isNaN(animeId)) {
            const data = JSON.parse(localStorage.getItem(key) || "{}");
            if (data.type === "like") {
              likes.add(animeId);
            } else if (data.type === "dislike") {
              dislikes.add(animeId);
            }
          }
        }
      }
    }

    console.log(
      `[Feedback] Loaded ${likes.size} likes and ${dislikes.size} dislikes for user ${userId}`
    );
  } catch (e) {
    console.error("[Feedback] Failed to load feedbacks:", e);
  }

  return { likes, dislikes };
}

// ============================================================================
// INTERACTION LOADER
// ============================================================================

/**
 * Load user interactions (clicks, views, impressions)
 */
export async function loadUserInteractions(
  userId: string
): Promise<UserInteractions> {
  const clicks = new Set<number>();
  const views = new Set<number>();
  const impressions = new Map<number, number>();

  try {
    const store = (window as any).shokai?.store;
    if (!store) {
      return { clicks, views, impressions };
    }

    // Load clicks
    const clicksData = await store.get(`netrec:interactions:${userId}:clicks`);
    if (clicksData && Array.isArray(clicksData)) {
      clicksData.forEach((id: number) => clicks.add(id));
    }

    // Load views
    const viewsData = await store.get(`netrec:interactions:${userId}:views`);
    if (viewsData && Array.isArray(viewsData)) {
      viewsData.forEach((id: number) => views.add(id));
    }

    // Load impressions
    const impressionsData = await store.get(
      `netrec:interactions:${userId}:impressions`
    );
    if (impressionsData && typeof impressionsData === "object") {
      for (const [id, count] of Object.entries(impressionsData)) {
        impressions.set(parseInt(id, 10), count as number);
      }
    }

    console.log(
      `[Interactions] Loaded ${clicks.size} clicks, ${views.size} views, ${impressions.size} impressions`
    );
  } catch (e) {
    console.error("[Interactions] Failed to load interactions:", e);
  }

  return { clicks, views, impressions };
}

// ============================================================================
// SAVE FUNCTIONS (for future tracking)
// ============================================================================

/**
 * Save click interaction
 */
export async function saveClick(userId: string, animeId: number): Promise<void> {
  try {
    const store = (window as any).shokai?.store;
    if (!store) return;

    const key = `netrec:interactions:${userId}:clicks`;
    const clicks = (await store.get(key)) || [];
    if (!clicks.includes(animeId)) {
      clicks.push(animeId);
      await store.set(key, clicks);
      console.log(`[Interactions] Saved click for anime ${animeId}`);
    }
  } catch (e) {
    console.error("[Interactions] Failed to save click:", e);
  }
}

/**
 * Save view interaction
 */
export async function saveView(userId: string, animeId: number): Promise<void> {
  try {
    const store = (window as any).shokai?.store;
    if (!store) return;

    const key = `netrec:interactions:${userId}:views`;
    const views = (await store.get(key)) || [];
    if (!views.includes(animeId)) {
      views.push(animeId);
      await store.set(key, views);
      console.log(`[Interactions] Saved view for anime ${animeId}`);
    }
  } catch (e) {
    console.error("[Interactions] Failed to save view:", e);
  }
}

/**
 * Increment impression count
 */
export async function saveImpression(
  userId: string,
  animeId: number
): Promise<void> {
  try {
    const store = (window as any).shokai?.store;
    if (!store) return;

    const key = `netrec:interactions:${userId}:impressions`;
    const impressions = (await store.get(key)) || {};
    impressions[animeId] = (impressions[animeId] || 0) + 1;
    await store.set(key, impressions);
  } catch (e) {
    console.error("[Interactions] Failed to save impression:", e);
  }
}

/**
 * Save skip event (NEW!)
 * Track when user scrolls past without clicking
 */
export async function saveSkip(userId: string, animeId: number): Promise<void> {
  try {
    const store = (window as any).shokai?.store;
    if (!store) return;

    const key = `netrec:interactions:${userId}:skips`;
    const skips = (await store.get(key)) || {};
    skips[animeId] = (skips[animeId] || 0) + 1;
    await store.set(key, skips);
  } catch (e) {
    console.error("[Interactions] Failed to save skip:", e);
  }
}

/**
 * Batch save impressions (NEW!)
 * More efficient for multiple impressions at once
 */
export async function batchSaveImpressions(
  userId: string,
  animeIds: number[]
): Promise<void> {
  try {
    const store = (window as any).shokai?.store;
    if (!store) return;

    const key = `netrec:interactions:${userId}:impressions`;
    const impressions = (await store.get(key)) || {};

    for (const animeId of animeIds) {
      impressions[animeId] = (impressions[animeId] || 0) + 1;
    }

    await store.set(key, impressions);
  } catch (e) {
    console.error("[Interactions] Failed to batch save impressions:", e);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get feedback summary
 */
export function getFeedbackSummary(feedbacks: UserFeedbacks): {
  total: number;
  likeRatio: number;
} {
  const total = feedbacks.likes.size + feedbacks.dislikes.size;
  const likeRatio = total > 0 ? feedbacks.likes.size / total : 0.5;

  return { total, likeRatio };
}

/**
 * Get interaction summary
 */
export function getInteractionSummary(interactions: UserInteractions): {
  totalClicks: number;
  totalViews: number;
  totalImpressions: number;
  clickToViewRatio: number;
} {
  const totalClicks = interactions.clicks.size;
  const totalViews = interactions.views.size;
  const totalImpressions = Array.from(interactions.impressions.values()).reduce(
    (sum, count) => sum + count,
    0
  );
  const clickToViewRatio =
    totalViews > 0 ? totalClicks / totalViews : 0;

  return { totalClicks, totalViews, totalImpressions, clickToViewRatio };
}
