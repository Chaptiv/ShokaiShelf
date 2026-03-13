// src/api/anilist.ts
// Stable AniList-API-Layer for Renderer (Browser-Context)
// - 30 min Token-RAM-Cache
// - Reads token from anilist.access_token OR from anilist{access_token,...} (Compatible)
// - Auto-Refresh shortly before expiration via window.shokai.auth.refresh()
// - Public queries allowed without token; user-bound endpoints only with token
// - subscribeAuth triggers local cache invalidation

import { devLog, devWarn, logError } from "@utils/logger";
import { rateLimiter } from "../logic/netrecV3/cache";

/* ───────────────── Types ───────────────── */

export type Media = {
  id: number;
  title?: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string; medium?: string };
  bannerImage?: string | null;
  description?: string | null;
  episodes?: number | null;
  genres?: string[] | null;
  tags?: { name: string }[] | null;
  nextAiringEpisode?: { airingAt: number; episode: number } | null;
  popularity?: number | null;
  averageScore?: number | null;
  meanScore?: number | null;
  format?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: { year?: number; month?: number; day?: number } | null;
  studios?: { nodes: { name: string }[] } | null;
  mediaListEntry?: { id?: number; status?: string; progress?: number; score?: number } | null;
};

type ScoreFormat =
  | "POINT_100"
  | "POINT_10"
  | "POINT_10_DECIMAL"
  | "POINT_5"
  | "POINT_3"
  | string;

export type ActivityEntry = {
  id: number;
  type: string;
  status?: string | null;
  progress?: number | string | null;
  createdAt: number;
  replyCount?: number | null;
  user?: {
    id: number;
    name: string;
    avatar?: { large?: string | null } | null;
  } | null;
  media?: Media | null;
};

declare global {
  interface ShokaiAPI {
    store?: {
      get: (k: string) => Promise<any>;
      set: (k: string, v: any) => Promise<void>;
      delete?: (k: string) => Promise<void>;
    };
    auth?: {
      login?: () => Promise<void>;
      loginBeta?: () => Promise<void>;
      logout?: () => Promise<void>;
      refresh?: () => Promise<string>;
      onUpdated?: (fn: () => void) => () => void;
    };
    notifications?: {
      getConfig: () => Promise<any>;
      updateConfig: (config: any) => Promise<any>;
      checkNow: () => Promise<any>;
      getHistory: () => Promise<any>;
      test: () => Promise<any>;
    };
    status?: () => Promise<any>;
    discord?: {
      getStatus: () => Promise<any>;
      setEnabled: (enabled: boolean) => Promise<any>;
      setActivity: (activity: any) => Promise<any>;
      clearActivity: () => Promise<any>;
    };
    scrobbler?: {
      getStatus: () => Promise<any>;
      updateConfig: (config: any) => Promise<any>;
      debugMatch: () => Promise<any>;
      removeAlias: (alias: string) => Promise<any>;
    };
    app?: {
      notify: (options: { title: string; body: string }) => void;
      needsSetup?: () => Promise<boolean>;
    };
    setup?: {
      save: (cfg: any) => Promise<any>;
    };
    achievements?: {
      notify: (achievement: any) => Promise<any>;
    };
  }

  interface Window {
    shokai?: ShokaiAPI;
  }
}

/* ───────────────── Rate Limiter ───────────────── */
// We now use the centralized rateLimiter from cache.ts to prevent duplicate queue conflicts

/* ───────────────── User Notification ───────────────── */

let lastNotificationTime = 0;
const NOTIFICATION_THROTTLE = 10_000; // Max 1 Notification every 10 seconds

// This is still useful as a global hook to warn the user visually
export function notifyRateLimit(waitMs: number): void {
  const now = Date.now();

  // Throttle Notifications (don't spam)
  if (now - lastNotificationTime < NOTIFICATION_THROTTLE) {
    return;
  }

  lastNotificationTime = now;

  const waitSec = Math.ceil(waitMs / 1000);
  const message = waitSec > 60
    ? `AniList Rate Limit reached. Waiting ${Math.ceil(waitSec / 60)} minute(s)...`
    : `AniList Rate Limit reached. Waiting ${waitSec} seconds...`;

  // Browser notification (if available)
  if (typeof window !== 'undefined' && (window as any).shokai?.app?.notify) {
    (window as any).shokai.app.notify({
      title: 'Rate Limit',
      body: message,
    });
  }

  // Dispatch custom event for UI Toast
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shokai:rate-limit', {
      detail: { waitMs, message }
    }));
  }
}

/* ───────────────── Caches ───────────────── */

const USERLIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let userListCache: { userId: number; data: any; at: number } | null = null;

/* ───────────────── Token-Handling ───────────────── */

const TOKEN_RAM_TTL = 30 * 60 * 1000; // 30 minutes
let tokenCache: { token: string | null; at: number } = { token: null, at: 0 };
let cachedViewer: any | null = null;

// reads both anilist.access_token and anilist{access_token,...}
export async function getAccessToken(): Promise<string | null> {
  const now = Date.now();

  // RAM-Cache
  if (tokenCache.token && now - tokenCache.at < TOKEN_RAM_TTL) {
    return tokenCache.token;
  }

  // 1) Dot-Path
  let access = (await window.shokai?.store?.get("anilist.access_token")) || "";

  // Object-Fallback
  if (!access) {
    const obj = (await window.shokai?.store?.get("anilist")) || {};
    access = obj?.access_token || "";
  }

  // Read expiration time (both paths)
  let exp = (await window.shokai?.store?.get("anilist.expires_at")) || 0;
  if (!exp) {
    const obj = (await window.shokai?.store?.get("anilist")) || {};
    exp = obj?.expires_at || 0;
  }

  // Read refresh token (both paths)
  let refresh = (await window.shokai?.store?.get("anilist.refresh_token")) || "";
  if (!refresh) {
    const obj = (await window.shokai?.store?.get("anilist")) || {};
    refresh = obj?.refresh_token || "";
  }

  // Shortly before expiration -> refresh
  if (access && exp && now > exp - 30_000 && refresh && window.shokai?.auth?.refresh) {
    try {
      const newToken = await window.shokai.auth.refresh();
      tokenCache = { token: newToken, at: Date.now() };
      return newToken;
    } catch {
      // Fallback: use old token if endpoints still accept it
    }
  }

  tokenCache = { token: access || null, at: now };
  return tokenCache.token;
}

export async function isAuthenticated(): Promise<boolean> {
  const t = await getAccessToken();
  return !!t;
}

export function subscribeAuth(cb: () => void) {
  const off = window.shokai?.auth?.onUpdated?.(() => {
    // Invalidate local caches
    tokenCache = { token: null, at: 0 };
    cachedViewer = null;
    userListCache = null;
    // empty potentially other memory caches
    trendingCache = { at: 0, data: [] };
    searchCache.clear();

    try { cb(); } catch { }
  });
  return () => { try { off && off(); } catch { } };
}

/* ───────────────── GQL-Helper ───────────────── */

async function gql<T = any>(query: string, variables?: Record<string, any>, requireAuth = false): Promise<T> {
  // Rate limiter: wait before request is sent (using unified rateLimiter from cache.ts)
  await rateLimiter.checkLimit();

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (requireAuth) {
    // Hard safeguard for user-bound endpoints
    throw new Error("Not authenticated");
  }

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    // 429 -> Rate Limit! Backoff + Retry
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const retrySec = retryAfter ? parseInt(retryAfter) : undefined;
      rateLimiter.handle429(retrySec);

      // Also notify the user visually using the old hook
      if (retrySec) notifyRateLimit(retrySec * 1000);
      else notifyRateLimit(60000);

      // Retry once after backoff
      await rateLimiter.checkLimit();
      return gql<T>(query, variables, requireAuth);
    }
    // 401/403 -> invalidate local token cache so UI reacts correctly
    if (res.status === 401 || res.status === 403) {
      tokenCache = { token: null, at: 0 };
      const authError = new Error(`Authentication failed (${res.status})`);
      (authError as any).code = 'AUTH_FAILED';
      (authError as any).status = res.status;
      throw authError;
    }
    // Other HTTP errors
    const httpError = new Error(`AniList API Error (HTTP ${res.status})`);
    (httpError as any).code = 'HTTP_ERROR';
    (httpError as any).status = res.status;
    throw httpError;
  }

  const json = await res.json();
  if (json.errors) {
    const msg = json.errors[0]?.message || "AniList error";
    // Also invalidate cache for auth-related errors
    if (/auth|token|unauthorized/i.test(msg)) {
      tokenCache = { token: null, at: 0 };
    }
    throw new Error(msg);
  }
  return json.data as T;
}

/* ───────────────── Public Data ───────────────── */

let trendingCache: { at: number; data: Media[] } = { at: 0, data: [] };
const TRENDING_TTL = 5 * 60 * 1000; // 5 minutes

export async function trendingAnimeCached(): Promise<Media[]> {
  const now = Date.now();
  if (now - trendingCache.at < TRENDING_TTL && trendingCache.data.length) {
    return trendingCache.data;
  }

  const data = await gql<{ Page: { media: Media[] } }>(
    `query ($page:Int=1,$perPage:Int=30){
      Page(page:$page, perPage:$perPage){
        media(type:ANIME, sort:TRENDING_DESC){
          id
          title{ romaji english native }
          coverImage{ large extraLarge }
          bannerImage
          episodes
          nextAiringEpisode{ airingAt episode }
          popularity
          averageScore
          meanScore
          format
          season
          seasonYear
          studios{ nodes{ name } }
          mediaListEntry{ id status progress score }
        }
      }
    }`
  );

  trendingCache = { at: now, data: data.Page.media ?? [] };
  return trendingCache.data;
}

export async function mediaDetails(id: number): Promise<Media> {
  const data = await gql<{ Media: Media }>(
    `query($id:Int!){
      Media(id:$id, type:ANIME){
        id
        title{ romaji english native }
        coverImage{ large extraLarge }
        bannerImage
        description(asHtml:true)
        episodes
        genres
        tags{ name }
        popularity
        averageScore
        meanScore
        format
        season
        seasonYear
        studios{ nodes{ name } }
        nextAiringEpisode{ airingAt episode }
        mediaListEntry{ id status progress score }
      }
    }`,
    { id }
  );
  return data.Media;
}

/* ───────────────── User-dependent Endpoints ───────────────── */

export async function userLists(userId: number) {
  if (!userId) return { lists: [] };

  // Check cache (5 minutes TTL)
  const now = Date.now();
  if (userListCache && userListCache.userId === userId && (now - userListCache.at) < USERLIST_CACHE_TTL) {
    devLog('[AniList] userLists cache HIT');
    return userListCache.data;
  }

  devLog('[AniList] userLists cache MISS, fetching...');
  const data = await gql<{ MediaListCollection: any }>(
    `query($userId:Int!){
      MediaListCollection(userId:$userId, type:ANIME){
        lists{
          name
          isCustomList
          entries{
            id
            progress
            score
            status
            updatedAt
            startedAt {
              year
              month
              day
            }
            completedAt {
              year
              month
              day
            }
            media{
              id
              title{ romaji english native }
              coverImage{ large extraLarge }
              episodes
              nextAiringEpisode{ airingAt episode }
              mediaListEntry{ id status progress score }
            }
          }
        }
      }
    }`,
    { userId },
    /* requireAuth */ true
  );
  const result = data.MediaListCollection || { lists: [] };

  // Save cache
  userListCache = { userId, data: result, at: now };
  return result;
}

/** Invalidate userLists cache (e.g. after Save/Delete) */
export function invalidateUserListCache(): void {
  userListCache = null;
}

export async function viewer() {
  const t = await getAccessToken();
  if (!t) return null;
  if (cachedViewer) return cachedViewer;

  const data = await gql<{ Viewer: any }>(
    `query{
      Viewer {
        id
        name
        avatar{ large }
        mediaListOptions{ scoreFormat }
      }
    }`,
    undefined,
    /* requireAuth */ true
  );

  cachedViewer = data.Viewer;
  return cachedViewer;
}

export async function viewerCached() {
  return await viewer();
}

export async function saveEntry(
  mediaId: number,
  status?: string,
  progress?: number,
  score?: number
) {
  // Must be logged in
  await assertAuthenticated();

  const data = await gql<{ SaveMediaListEntry: { id: number } }>(
    `mutation($mediaId:Int!,$status:MediaListStatus,$progress:Int,$score:Float){
      SaveMediaListEntry(
        mediaId:$mediaId,
        status:$status,
        progress:$progress,
        score:$score
      ){
        id
      }
    }`,
    { mediaId, status, progress, score },
    /* requireAuth */ true
  );
  // Invalidate cache since list has changed
  userListCache = null;
  return data.SaveMediaListEntry?.id;
}

export async function deleteEntry(entryId: number) {
  // Remove entry, only allowed when logged in
  await assertAuthenticated();

  const data = await gql<{ DeleteMediaListEntry: { deleted?: boolean } | null }>(
    `mutation($id:Int!){
      DeleteMediaListEntry(id:$id){
        deleted
      }
    }`,
    { id: entryId },
    /* requireAuth */ true
  );

  // Invalidate cache since list has changed
  userListCache = null;
  return !!data.DeleteMediaListEntry?.deleted;
}

export async function fetchActivityFeed({
  userId,
  following = false,
  perPage = 25,
}: {
  userId?: number;
  following?: boolean;
  perPage?: number;
}): Promise<ActivityEntry[]> {
  // Feed ist nur f�r eingeloggte Nutzer sinnvoll
  await assertAuthenticated();

  const vars: Record<string, any> = { perPage };
  if (following) {
    vars.isFollowing = true;
  } else if (typeof userId === "number") {
    vars.userId = userId;
  }

  const data = await gql<{
    Page: { activities?: ActivityEntry[] | null } | null;
  }>(
    `query($userId:Int,$isFollowing:Boolean,$perPage:Int){
      Page(page:1, perPage:$perPage){
        activities(
          userId:$userId,
          isFollowing:$isFollowing,
          type:MEDIA_LIST,
          sort:ID_DESC
        ){
          ... on ListActivity{
            id
            type:__typename
            status
            progress
            createdAt
            replyCount
            user{
              id
              name
              avatar{ large }
            }
            media{
              id
              title{ romaji english native }
              coverImage{ large extraLarge }
              episodes
              format
            }
          }
        }
      }
    }`,
    vars,
    /* requireAuth */ true
  );

  const list = data.Page?.activities ?? [];
  return list.filter((a): a is ActivityEntry => Boolean(a));
}

/* ───────────────── Search (public) ───────────────── */

const searchCache = new Map<string, { at: number; items: Media[] }>();
const SEARCH_TTL = 3 * 60 * 1000; // 3 minutes

export async function searchAnime(query: string, perPage = 20): Promise<Media[]> {
  const q = (query || "").trim();
  if (!q) return [];

  const hit = searchCache.get(q);
  const now = Date.now();
  if (hit && now - hit.at < SEARCH_TTL) return hit.items;

  const data = await gql<{ Page: { media: Media[] } }>(
    `query($q:String,$perPage:Int){
      Page(page:1, perPage:$perPage){
        media(type:ANIME, search:$q, sort:SEARCH_MATCH){
          id
          title{ romaji english native }
          coverImage{ large extraLarge }
          episodes
          averageScore
          popularity
          mediaListEntry{ id status progress score }
        }
      }
    }`,
    { q, perPage }
  );

  const items = data.Page.media ?? [];
  searchCache.set(q, { at: now, items });
  return items;
}

/* ───────────────── Utilities ───────────────── */

export function displayTitle(m: Media, lang: "en" | "ja" | "romaji" | "de" = "en"): string {
  if (!m?.title) return String(m?.id ?? "");
  if (lang === "ja") return m.title.native || m.title.romaji || m.title.english || String(m.id);
  if (lang === "romaji") return m.title.romaji || m.title.english || m.title.native || String(m.id);
  if (lang === "de") return m.title.english || m.title.romaji || m.title.native || String(m.id);
  return m.title.english || m.title.romaji || m.title.native || String(m.id);
}

export function scoreBounds(fmt?: ScoreFormat): { min: number; max: number; step: number } {
  switch (fmt) {
    case "POINT_100": return { min: 0, max: 100, step: 1 };
    case "POINT_10_DECIMAL": return { min: 0, max: 10, step: 0.1 };
    case "POINT_10": return { min: 0, max: 10, step: 1 };
    case "POINT_5": return { min: 0, max: 5, step: 0.5 };
    case "POINT_3": return { min: 0, max: 3, step: 1 };
    default: return { min: 0, max: 10, step: 1 };
  }
}

export function airingInText(m: Media) {
  const ts = m.nextAiringEpisode?.airingAt;
  if (!ts) return "—";
  const diff = Math.max(0, ts * 1000 - Date.now());
  const min = Math.floor(diff / 60000);
  if (min < 60) return `in ${min}m`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  if (h < 24) return rm ? `in ${h}h ${rm}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `in ${d}d ${rh}h`;
}

/* ───────────────── Internals ───────────────── */

async function assertAuthenticated() {
  const ok = await isAuthenticated();
  if (!ok) throw new Error("Not authenticated");
}


// ── Compatibility shims for older callers (e.g. Sidebar) ─────────────────
export async function loginAniList(): Promise<void> {
  await window.shokai?.auth?.login?.();
}

export async function loginAniListBeta(): Promise<void> {
  await window.shokai?.auth?.loginBeta?.();
}

export async function logoutAniList(): Promise<void> {
  try {
    await window.shokai?.auth?.logout?.();
  } finally {
    // Invalidate local caches
    tokenCache = { token: null, at: 0 };
    cachedViewer = null;
    userListCache = null;
  }
}

export async function refreshAniList(): Promise<string | null> {
  try {
    const tok = await window.shokai?.auth?.refresh?.();
    if (tok) tokenCache = { token: tok, at: Date.now() };
    return tok ?? null;
  } catch {
    return null;
  }
}

// ── Social API Stubs (for ActivityCard) ─────────────────
export async function toggleLike(activityId: number): Promise<any> {
  const query = `
    mutation ($activityId: Int) {
      ToggleLikeV2(id: $activityId, type: ACTIVITY) {
        ... on ListActivity {
          id
          isLiked
          likeCount
        }
        ... on TextActivity {
          id
          isLiked
          likeCount
        }
        ... on MessageActivity {
          id
          isLiked
          likeCount
        }
      }
    }
  `;
  return await gql(query, { activityId });
}

export async function fetchActivityReplies(activityId: number): Promise<any> {
  const query = `
    query ($activityId: Int!, $page: Int) {
      Page(page: $page, perPage: 25) {
        activityReplies(activityId: $activityId) {
          id
          text
          likeCount
          isLiked
          createdAt
          user {
            id
            name
            avatar {
              large
            }
          }
        }
      }
    }
  `;
  const result = await gql(query, { activityId, page: 1 });
  return result?.Page?.activityReplies ?? [];
}

export async function saveActivityReply(activityId: number, text: string): Promise<any> {
  const query = `
    mutation ($activityId: Int, $text: String) {
      SaveActivityReply(activityId: $activityId, text: $text) {
        id
        text
        likeCount
        isLiked
        createdAt
        user {
          id
          name
          avatar {
            large
          }
        }
      }
    }
  `;
  return await gql(query, { activityId, text });
}

export async function saveTextActivity(text: string): Promise<any> {
  const query = `
    mutation ($text: String) {
      SaveTextActivity(text: $text) {
        id
        text
        createdAt
        user {
          id
          name
          avatar {
            large
          }
        }
      }
    }
  `;
  return await gql(query, { text });
}

export async function fetchGlobalActivities(page: number = 1): Promise<any[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        activities(sort: ID_DESC, type: TEXT) {
          ... on TextActivity {
            id
            type:__typename
            text
            createdAt
            isLiked
            likeCount
            replyCount
            user {
              id
              name
              avatar {
                large
              }
            }
          }
        }
      }
    }
  `;
  const result = await gql(query, { page, perPage: 25 });
  return result?.Page?.activities ?? [];
}
