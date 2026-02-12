/**
 * AnimeNetRec V3 - Filtering
 * 
 * Filter candidates based on user preferences and safety
 */

import type { Media, Candidate, MediaListEntry, UserPreferences } from "./types";

// ============================================================================
// CORE FILTERS
// ============================================================================

/**
 * Filter completed anime
 */
export function filterCompleted(
  candidates: Candidate[],
  entries: MediaListEntry[]
): Candidate[] {
  const completedIds = new Set(
    entries
      .filter((e) => e.status === "COMPLETED" || e.status === "CURRENT")
      .map((e) => e.media.id)
  );

  return candidates.filter((c) => !completedIds.has(c.media.id));
}

/**
 * Filter adult content
 */
export function filterAdult(
  candidates: Candidate[],
  showAdult: boolean = false
): Candidate[] {
  if (showAdult) return candidates;
  return candidates.filter((c) => !c.media.isAdult);
}

/**
 * Filter music videos
 */
export function filterMusic(
  candidates: Candidate[]
): Candidate[] {
  return candidates.filter((c) => c.media.format !== "MUSIC");
}

/**
 * Filter spoiler tags
 */
export function filterSpoilerTags(
  candidates: Candidate[],
  filterSpoilers: boolean = true
): Candidate[] {
  if (!filterSpoilers) return candidates;

  // Don't remove candidates, just clean their tags for display
  return candidates.map((c) => ({
    ...c,
    media: {
      ...c.media,
      tags: c.media.tags?.filter(
        (t) => !t.isMediaSpoiler && !t.isGeneralSpoiler
      ),
    },
  }));
}

/**
 * Filter by genre exclusions
 */
export function filterGenres(
  candidates: Candidate[],
  excludeGenres: string[] = []
): Candidate[] {
  if (excludeGenres.length === 0) return candidates;

  const excludeSet = new Set(excludeGenres.map((g) => g.toLowerCase()));

  return candidates.filter((c) => {
    if (!c.media.genres) return true;
    
    for (const genre of c.media.genres) {
      if (excludeSet.has(genre.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Filter by tag exclusions
 */
export function filterTags(
  candidates: Candidate[],
  excludeTags: string[] = []
): Candidate[] {
  if (excludeTags.length === 0) return candidates;

  const excludeSet = new Set(excludeTags.map((t) => t.toLowerCase()));

  return candidates.filter((c) => {
    if (!c.media.tags) return true;

    for (const tag of c.media.tags) {
      if (excludeSet.has(tag.name.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter by studio exclusions (NEW!)
 */
export function filterStudios(
  candidates: Candidate[],
  excludeStudios: string[] = []
): Candidate[] {
  if (excludeStudios.length === 0) return candidates;

  const excludeSet = new Set(excludeStudios.map((s) => s.toLowerCase()));

  return candidates.filter((c) => {
    if (!c.media.studios?.nodes) return true;

    for (const studio of c.media.studios.nodes) {
      if (excludeSet.has(studio.name.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter "Never Show" list (NEW!)
 */
export function filterNeverShow(
  candidates: Candidate[],
  neverShow: number[] = []
): Candidate[] {
  if (neverShow.length === 0) return candidates;

  const neverShowSet = new Set(neverShow);

  return candidates.filter((c) => !neverShowSet.has(c.media.id));
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Hard dedupe by media ID
 */
export function deduplicate(candidates: Candidate[]): Candidate[] {
  const seen = new Set<number>();
  const unique: Candidate[] = [];

  for (const candidate of candidates) {
    if (!seen.has(candidate.media.id)) {
      seen.add(candidate.media.id);
      unique.push(candidate);
    } else {
      // Merge sources if duplicate
      const existing = unique.find((c) => c.media.id === candidate.media.id);
      if (existing) {
        existing.sources = Array.from(
          new Set([...existing.sources, ...candidate.sources])
        );
        // Merge seed IDs
        if (candidate.seedIds) {
          existing.seedIds = Array.from(
            new Set([...(existing.seedIds || []), ...candidate.seedIds])
          );
        }
      }
    }
  }

  return unique;
}

// ============================================================================
// MASTER FILTER
// ============================================================================

/**
 * Apply all filters in sequence
 */
export function applyFilters(
  candidates: Candidate[],
  entries: MediaListEntry[],
  preferences?: UserPreferences
): Candidate[] {
  let filtered = candidates;

  // 1. Deduplicate first
  filtered = deduplicate(filtered);
  console.log(`[Filter] After dedupe: ${filtered.length}`);

  // 2. Remove completed/current
  filtered = filterCompleted(filtered, entries);
  console.log(`[Filter] After completed: ${filtered.length}`);

  // 3. Filter adult content
  const showAdult = preferences?.showAdult ?? false;
  filtered = filterAdult(filtered, showAdult);
  console.log(`[Filter] After adult: ${filtered.length}`);

  // 4. Filter music videos
  filtered = filterMusic(filtered);
  console.log(`[Filter] After music: ${filtered.length}`);

  // 5. Filter spoiler tags (cleaning only)
  filtered = filterSpoilerTags(filtered, true);

  // 6. Filter excluded genres
  if (preferences?.excludeGenres) {
    filtered = filterGenres(filtered, preferences.excludeGenres);
    console.log(`[Filter] After genre exclusions: ${filtered.length}`);
  }

  // 7. Filter excluded tags
  if (preferences?.excludeTags) {
    filtered = filterTags(filtered, preferences.excludeTags);
    console.log(`[Filter] After tag exclusions: ${filtered.length}`);
  }

  // 8. Filter excluded studios (NEW!)
  if (preferences?.excludeStudios) {
    filtered = filterStudios(filtered, preferences.excludeStudios);
    console.log(`[Filter] After studio exclusions: ${filtered.length}`);
  }

  // 9. Filter "Never Show" list (NEW!)
  if (preferences?.neverShow) {
    filtered = filterNeverShow(filtered, preferences.neverShow);
    console.log(`[Filter] After never-show list: ${filtered.length}`);
  }

  return filtered;
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate media has minimum data
 */
export function validateMedia(media: Media): boolean {
  // Must have ID
  if (!media.id) return false;

  // Must have title
  if (!media.title?.romaji && !media.title?.english && !media.title?.native) {
    return false;
  }

  // Must have some content features
  const hasGenres = media.genres && media.genres.length > 0;
  const hasTags = media.tags && media.tags.length > 0;
  const hasStudios = media.studios?.nodes && media.studios.nodes.length > 0;

  if (!hasGenres && !hasTags && !hasStudios) {
    return false;
  }

  return true;
}

/**
 * Validate and clean candidates
 */
export function validateCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => validateMedia(c.media));
}

// ============================================================================
// SAFETY CHECKS
// ============================================================================

/**
 * Check if media is safe for recommendation
 */
export function isSafeToRecommend(
  media: Media,
  preferences?: UserPreferences
): { safe: boolean; reason?: string } {
  // Check adult content
  if (media.isAdult && !preferences?.showAdult) {
    return { safe: false, reason: "Adult content" };
  }

  // Check if has critical spoiler tags only
  if (media.tags) {
    const criticalSpoilers = media.tags.filter(
      (t) => t.isMediaSpoiler && (t.rank || 0) >= 80
    );
    if (criticalSpoilers.length > 0) {
      return { safe: false, reason: "Critical spoilers" };
    }
  }

  // Check validation
  if (!validateMedia(media)) {
    return { safe: false, reason: "Insufficient data" };
  }

  return { safe: true };
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log filter statistics
 */
export function logFilterStats(
  original: number,
  afterFilters: number,
  filters: string[]
): void {
  const removed = original - afterFilters;
  const removedPercent = ((removed / original) * 100).toFixed(1);

  console.log(`[Filter] Stats:
    Original: ${original}
    After filters: ${afterFilters}
    Removed: ${removed} (${removedPercent}%)
    Filters applied: ${filters.join(", ")}
  `);
}