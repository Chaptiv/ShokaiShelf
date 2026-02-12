/**
 * Scrobble matcher tests
 * Tests the title-matching and similarity scoring logic.
 */
import { describe, it, expect } from "vitest";
import { findBestMatch } from "@logic/scrobble-matcher";

describe("scrobble-matcher", () => {
    // Helper: fake library shape from AniList
    const makeLib = (entries: { status: string; title: string }[]) => [
        {
            entries: entries.map((e) => ({
                status: e.status,
                media: {
                    id: Math.random(),
                    title: { romaji: e.title, english: e.title, native: null },
                },
            })),
        },
    ];

    it("matches an exact title from the library", () => {
        const lib = makeLib([{ status: "CURRENT", title: "Frieren" }]);
        const res = findBestMatch("Frieren", lib);
        expect(res.media).not.toBeNull();
        expect(res.confidence).toBeGreaterThan(0.9);
        expect(res.source).toBe("library");
    });

    it("matches a close title variant", () => {
        const lib = makeLib([{ status: "CURRENT", title: "Sousou no Frieren" }]);
        const res = findBestMatch("Frieren Beyond Journey's End", lib, [
            { id: 1, title: { romaji: "Sousou no Frieren", english: "Frieren", native: null } },
        ]);
        expect(res.media).not.toBeNull();
        // Should match via search or library with reasonable confidence
        expect(res.confidence).toBeGreaterThan(0.3);
    });

    it("returns null with 0 confidence when nothing matches", () => {
        const lib = makeLib([]);
        const res = findBestMatch("Non-Existent-Anime-XYZ", lib);
        expect(res.media).toBeNull();
        expect(res.confidence).toBe(0);
    });

    it("boosts CURRENT entries in the library", () => {
        const lib = makeLib([
            { status: "COMPLETED", title: "Naruto" },
            { status: "CURRENT", title: "Naruto" },
        ]);
        const res = findBestMatch("Naruto", lib);
        expect(res.source).toBe("library");
        expect(res.confidence).toBeGreaterThan(0.95);
    });

    it("prefers library over search results", () => {
        const lib = makeLib([{ status: "PLANNING", title: "Bleach" }]);
        const search = [
            { id: 99, title: { romaji: "Bleach", english: "Bleach", native: null } },
        ];
        const res = findBestMatch("Bleach", lib, search);
        // Library-first strategy: exact match in library => source library
        expect(res.source).toBe("library");
    });
});
