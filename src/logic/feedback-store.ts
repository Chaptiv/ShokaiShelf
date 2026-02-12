/**
 * User Feedback Storage System
 *
 * Stores and retrieves user feedback (like/dislike) for anime recommendations
 * This data is used by the recommendation engine for personalization
 */

export type FeedbackType = "like" | "dislike" | null;

// Import GranularReason type from Dream V4
import type { GranularReason, UserContext } from "./netrecDream/dream-types";

export interface FeedbackEntry {
  mediaId: number;
  type: FeedbackType;
  timestamp: number;
  mediaTitle?: string;
  confidence?: number;
  // Dream V4 additions
  reasons?: GranularReason[];
  context?: UserContext;
}

export interface FeedbackStats {
  totalLikes: number;
  totalDislikes: number;
  recentFeedback: FeedbackEntry[];
}

const STORAGE_KEY = "shokai.feedback";

/**
 * Get all feedback data
 */
export async function getAllFeedback(): Promise<Record<number, FeedbackEntry>> {
  try {
    // Try window.shokai.store first (Electron persistent storage)
    if (window.shokai?.store?.get) {
      const data = await window.shokai.store.get(STORAGE_KEY);
      if (data) return data;
    }

    // Fallback to localStorage
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      return JSON.parse(localData);
    }

    return {};
  } catch (error) {
    console.error("[FeedbackStore] Failed to load feedback:", error);
    return {};
  }
}

/**
 * Get feedback for a specific media
 */
export async function getFeedback(mediaId: number): Promise<FeedbackType> {
  const allFeedback = await getAllFeedback();
  return allFeedback[mediaId]?.type ?? null;
}

/**
 * Save feedback for a media
 */
export async function saveFeedback(
  mediaId: number,
  type: FeedbackType,
  metadata?: {
    title?: string;
    confidence?: number;
    // Dream V4 additions
    reasons?: GranularReason[];
    context?: UserContext;
  }
): Promise<void> {
  try {
    const allFeedback = await getAllFeedback();

    if (type === null) {
      // Remove feedback
      delete allFeedback[mediaId];
    } else {
      // Add/update feedback
      allFeedback[mediaId] = {
        mediaId,
        type,
        timestamp: Date.now(),
        mediaTitle: metadata?.title,
        confidence: metadata?.confidence,
        reasons: metadata?.reasons,
        context: metadata?.context,
      };
    }

    // Save to both stores
    if (window.shokai?.store?.set) {
      await window.shokai.store.set(STORAGE_KEY, allFeedback);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allFeedback));

    console.log(`[FeedbackStore] Saved ${type} for media ${mediaId}`);
  } catch (error) {
    console.error("[FeedbackStore] Failed to save feedback:", error);
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(): Promise<FeedbackStats> {
  const allFeedback = await getAllFeedback();
  const entries = Object.values(allFeedback);

  const totalLikes = entries.filter((e) => e.type === "like").length;
  const totalDislikes = entries.filter((e) => e.type === "dislike").length;
  const recentFeedback = entries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  return {
    totalLikes,
    totalDislikes,
    recentFeedback,
  };
}

/**
 * Get all liked media IDs
 */
export async function getLikedMediaIds(): Promise<number[]> {
  const allFeedback = await getAllFeedback();
  return Object.values(allFeedback)
    .filter((e) => e.type === "like")
    .map((e) => e.mediaId);
}

/**
 * Get all disliked media IDs
 */
export async function getDislikedMediaIds(): Promise<number[]> {
  const allFeedback = await getAllFeedback();
  return Object.values(allFeedback)
    .filter((e) => e.type === "dislike")
    .map((e) => e.mediaId);
}

/**
 * Clear all feedback (for testing or reset)
 */
export async function clearAllFeedback(): Promise<void> {
  try {
    if (window.shokai?.store?.set) {
      await window.shokai.store.set(STORAGE_KEY, {});
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    console.log("[FeedbackStore] Cleared all feedback");
  } catch (error) {
    console.error("[FeedbackStore] Failed to clear feedback:", error);
  }
}

/**
 * Export feedback data for engine training
 */
export async function exportFeedbackForEngine(): Promise<{
  likes: number[];
  dislikes: number[];
  metadata: Record<number, { title?: string; confidence?: number; timestamp: number }>;
}> {
  const allFeedback = await getAllFeedback();
  const likes: number[] = [];
  const dislikes: number[] = [];
  const metadata: Record<number, any> = {};

  for (const entry of Object.values(allFeedback)) {
    if (entry.type === "like") {
      likes.push(entry.mediaId);
    } else if (entry.type === "dislike") {
      dislikes.push(entry.mediaId);
    }

    metadata[entry.mediaId] = {
      title: entry.mediaTitle,
      confidence: entry.confidence,
      timestamp: entry.timestamp,
    };
  }

  return { likes, dislikes, metadata };
}
