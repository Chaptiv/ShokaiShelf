/**
 * Feedback store tests
 * Tests the user feedback (like/dislike) persistence layer.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
    getAllFeedback,
    saveFeedback,
    getFeedback,
    getFeedbackStats,
    getLikedMediaIds,
    getDislikedMediaIds,
    clearAllFeedback,
    exportFeedbackForEngine,
} from "@logic/feedback-store";

describe("feedback-store", () => {
    beforeEach(async () => {
        // Clear state before each test
        localStorage.clear();
        await clearAllFeedback();
    });

    it("starts with empty feedback", async () => {
        const all = await getAllFeedback();
        expect(Object.keys(all)).toHaveLength(0);
    });

    it("saves and retrieves a like", async () => {
        await saveFeedback(123, "like", { title: "Test Anime" });
        const fb = await getFeedback(123);
        expect(fb).toBe("like");
    });

    it("saves and retrieves a dislike", async () => {
        await saveFeedback(456, "dislike", { title: "Bad Anime" });
        const fb = await getFeedback(456);
        expect(fb).toBe("dislike");
    });

    it("returns null for unknown media", async () => {
        const fb = await getFeedback(999);
        expect(fb).toBeNull();
    });

    it("removes feedback when type is null", async () => {
        await saveFeedback(100, "like");
        await saveFeedback(100, null);
        const fb = await getFeedback(100);
        expect(fb).toBeNull();
    });

    it("calculates correct stats", async () => {
        await saveFeedback(1, "like");
        await saveFeedback(2, "like");
        await saveFeedback(3, "dislike");

        const stats = await getFeedbackStats();
        expect(stats.totalLikes).toBe(2);
        expect(stats.totalDislikes).toBe(1);
        expect(stats.recentFeedback).toHaveLength(3);
    });

    it("returns correct liked/disliked IDs", async () => {
        await saveFeedback(10, "like");
        await saveFeedback(20, "dislike");
        await saveFeedback(30, "like");

        const liked = await getLikedMediaIds();
        const disliked = await getDislikedMediaIds();

        expect(liked).toContain(10);
        expect(liked).toContain(30);
        expect(liked).not.toContain(20);
        expect(disliked).toContain(20);
        expect(disliked).not.toContain(10);
    });

    it("clears all feedback", async () => {
        await saveFeedback(1, "like");
        await saveFeedback(2, "dislike");
        await clearAllFeedback();
        const all = await getAllFeedback();
        expect(Object.keys(all)).toHaveLength(0);
    });

    it("exports data for engine training", async () => {
        await saveFeedback(10, "like", { title: "Good" });
        await saveFeedback(20, "dislike", { title: "Bad" });

        const exp = await exportFeedbackForEngine();
        expect(exp.likes).toContain(10);
        expect(exp.dislikes).toContain(20);
        expect(exp.metadata[10].title).toBe("Good");
    });
});
