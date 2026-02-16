/**
 * AnimeNetRec V3 - GraphQL Queries
 * 
 * AniList API queries with batching and optimization
 */

import type { Media, MediaListEntry, UserStats } from "./types";
import { cachedFetch, batchFetch, rateLimiter } from "./cache";
import { devLog, devWarn, logError } from "@utils/logger";


const ANILIST_API = "https://graphql.anilist.co";

// ============================================================================
// QUERY HELPERS
// ============================================================================

async function query<T>(gql: string, variables: any = {}): Promise<T> {
  // CRITICAL: Apply rate limiting BEFORE fetch
  await rateLimiter.checkLimit();

  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: gql, variables }),
  });

  if (!response.ok) {
    const error: any = new Error(`GraphQL Error: ${response.status}`);
    error.status = response.status;
    error.headers = response.headers;

    // Handle 429 Rate Limit
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      rateLimiter.handle429(retryAfter ? parseInt(retryAfter) : undefined);
      logError("[Query] 429 Rate Limit Hit - backing off");

      // Retry after backoff
      await rateLimiter.checkLimit();
      return query<T>(gql, variables);
    }

    throw error;
  }

  const json = await response.json();

  if (json.errors) {
    logError("[GraphQL] Errors:", json.errors);
    throw new Error(json.errors[0]?.message || "GraphQL Error");
  }

  return json.data;
}

// ============================================================================
// USER LIBRARY
// ============================================================================

const USER_LIBRARY_QUERY = `
query ($userName: String!) {
  MediaListCollection(userName: $userName, type: ANIME) {
    lists {
      name
      status
      entries {
        media {
          id
          title {
            english
            romaji
            native
          }
          coverImage {
            large
            extraLarge
          }
          bannerImage
          genres
          tags {
            id
            name
            rank
            isMediaSpoiler
            isGeneralSpoiler
            isAdult
          }
          studios(isMain: true) {
            nodes {
              id
              name
              isAnimationStudio
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                }
                type
              }
            }
          }
          episodes
          duration
          averageScore
          popularity
          startDate {
            year
            month
            day
          }
          format
          source
          isAdult
        }
        status
        score
        progress
        updatedAt
      }
    }
  }
}
`;

export async function fetchUserLibrary(userName: string): Promise<MediaListEntry[]> {
  return cachedFetch<MediaListEntry[]>(
    "user-library",
    userName,
    async () => {
      const data = await query<{
        MediaListCollection: { lists: Array<{ entries: MediaListEntry[] }> };
      }>(USER_LIBRARY_QUERY, { userName });

      const entries: MediaListEntry[] = [];
      for (const list of data.MediaListCollection.lists) {
        entries.push(...list.entries);
      }

      devLog(`[Query] Fetched ${entries.length} entries for ${userName}`);
      return entries;
    }
  );
}

// ============================================================================
// USER STATS
// ============================================================================

const USER_STATS_QUERY = `
query ($userName: String!) {
  User(name: $userName) {
    statistics {
      anime {
        genres {
          genre
          count
          meanScore
        }
        tags {
          tag {
            id
            name
          }
          count
          meanScore
        }
        studios {
          studio {
            id
            name
          }
          count
          meanScore
        }
      }
    }
  }
}
`;

export async function fetchUserStats(userName: string): Promise<UserStats> {
  return cachedFetch<UserStats>(
    "user-stats",
    userName,
    async () => {
      const data = await query<{
        User: { statistics: { anime: UserStats } };
      }>(USER_STATS_QUERY, { userName });

      devLog(`[Query] Fetched stats for ${userName}`);
      return data.User.statistics.anime;
    }
  );
}

// ============================================================================
// RECOMMENDATIONS (BATCH)
// ============================================================================

const RECOMMENDATIONS_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      recommendations(sort: RATING_DESC, perPage: 20) {
        nodes {
          rating
          mediaRecommendation {
            id
            title {
              english
              romaji
              native
            }
            coverImage {
              large
              extraLarge
            }
            bannerImage
            genres
            tags {
              id
              name
              rank
              isMediaSpoiler
              isGeneralSpoiler
              isAdult
            }
            studios(isMain: true) {
              nodes {
                id
                name
                isAnimationStudio
              }
            }
            episodes
            duration
            averageScore
            popularity
            startDate {
              year
              month
              day
            }
            format
            source
            isAdult
          }
        }
      }
    }
  }
}
`;

export async function fetchRecommendations(
  seedIds: number[]
): Promise<Map<number, Array<{ rating: number; media: Media }>>> {
  // Limit to 10 seeds per batch (as per spec)
  const limitedSeeds = seedIds.slice(0, 10);

  const results = await batchFetch<{
    id: number;
    recs: Array<{ rating: number; media: Media }>;
  }>(
    "recommendations",
    limitedSeeds,
    async (batchIds) => {
      const data = await query<{
        Page: {
          media: Array<{
            id: number;
            recommendations: {
              nodes: Array<{
                rating: number;
                mediaRecommendation: Media;
              }>;
            };
          }>;
        };
      }>(RECOMMENDATIONS_QUERY, { ids: batchIds });

      return data.Page.media.map((m) => ({
        id: m.id,
        recs: m.recommendations.nodes
          .filter((n) => n.mediaRecommendation)
          .map((n) => ({
            rating: n.rating || 0,
            media: n.mediaRecommendation,
          })),
      }));
    },
    { batchSize: 10 }
  );

  // Convert to Map
  const map = new Map<number, Array<{ rating: number; media: Media }>>();
  for (const result of results) {
    map.set(result.id, result.recs);
  }

  devLog(`[Query] Fetched recommendations for ${limitedSeeds.length} seeds`);
  return map;
}

// ============================================================================
// TRENDING
// ============================================================================

const TRENDING_QUERY = `
query ($perPage: Int) {
  Page(perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title {
        english
        romaji
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      genres
      tags {
        id
        name
        rank
        isMediaSpoiler
        isGeneralSpoiler
        isAdult
      }
      studios(isMain: true) {
        nodes {
          id
          name
          isAnimationStudio
        }
      }
      episodes
      duration
      averageScore
      popularity
      startDate {
        year
        month
        day
      }
      format
      source
      isAdult
    }
  }
}
`;

export async function fetchTrending(perPage: number = 50): Promise<Media[]> {
  return cachedFetch<Media[]>(
    "trending",
    perPage,
    async () => {
      const data = await query<{
        Page: { media: Media[] };
      }>(TRENDING_QUERY, { perPage });

      devLog(`[Query] Fetched ${data.Page.media.length} trending anime`);
      return data.Page.media;
    }
  );
}

// ============================================================================
// MEDIA DETAILS (Single)
// ============================================================================

const MEDIA_DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title {
      english
      romaji
      native
    }
    coverImage {
      large
      extraLarge
    }
    bannerImage
    genres
    tags {
      id
      name
      rank
      isMediaSpoiler
      isGeneralSpoiler
      isAdult
    }
    studios(isMain: true) {
      nodes {
        id
        name
        isAnimationStudio
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          title {
            romaji
          }
          type
        }
      }
    }
    episodes
    duration
    averageScore
    popularity
    startDate {
      year
      month
      day
    }
    format
    source
    isAdult
  }
}
`;

export async function fetchMediaDetails(id: number): Promise<Media> {
  return cachedFetch<Media>(
    "media-details",
    id,
    async () => {
      const data = await query<{ Media: Media }>(MEDIA_DETAILS_QUERY, { id });
      devLog(`[Query] Fetched details for media ${id}`);
      return data.Media;
    }
  );
}

// ============================================================================
// SEARCH (For Onboarding)
// ============================================================================

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        english
        romaji
        native
      }
      coverImage {
        large
      }
      averageScore
      popularity
      format
    }
  }
}
`;

export async function searchAnime(searchTerm: string): Promise<Media[]> {
  const data = await query<{
    Page: { media: Media[] };
  }>(SEARCH_QUERY, { search: searchTerm });

  devLog(`[Query] Search "${searchTerm}" returned ${data.Page.media.length} results`);
  return data.Page.media;
}