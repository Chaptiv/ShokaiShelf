/**
 * useSnooze Hook
 *
 * Manages snoozed anime IDs with localStorage persistence
 * Optimized to avoid repeated localStorage reads
 */

import { useState, useEffect, useCallback } from "react";

const SNOOZE_STORAGE_KEY = "snoozed_anime";
const SNOOZE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Load snoozed IDs from localStorage (only active ones)
function loadSnoozedIds(): Set<number> {
  try {
    const snoozeData = JSON.parse(localStorage.getItem(SNOOZE_STORAGE_KEY) || "{}");
    const now = Date.now();
    const active = new Set<number>();

    // Filter expired snoozes
    for (const [id, expiry] of Object.entries(snoozeData)) {
      if ((expiry as number) > now) {
        active.add(Number(id));
      }
    }

    return active;
  } catch (error) {
    console.error("[useSnooze] Failed to load snoozed IDs:", error);
    return new Set();
  }
}

// Save snooze to localStorage asynchronously (non-blocking)
function saveSnoozedId(mediaId: number) {
  // Use setTimeout to make it async and non-blocking
  setTimeout(() => {
    try {
      const snoozeData = JSON.parse(localStorage.getItem(SNOOZE_STORAGE_KEY) || "{}");
      snoozeData[mediaId] = Date.now() + SNOOZE_DURATION;
      localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(snoozeData));
    } catch (error) {
      console.error("[useSnooze] Failed to save snooze:", error);
    }
  }, 0);
}

export function useSnooze() {
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(new Set());

  // Load snoozed IDs only once on mount
  useEffect(() => {
    const ids = loadSnoozedIds();
    setSnoozedIds(ids);
  }, []);

  // Snooze an anime (optimistic update + async save)
  const snooze = useCallback((mediaId: number) => {
    // Optimistic update - instant UI feedback
    setSnoozedIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(mediaId);
      return newSet;
    });

    // Async save to localStorage (non-blocking)
    saveSnoozedId(mediaId);
  }, []);

  // Check if an anime is snoozed
  const isSnoozed = useCallback(
    (mediaId: number) => {
      return snoozedIds.has(mediaId);
    },
    [snoozedIds]
  );

  return { snoozedIds, snooze, isSnoozed };
}
