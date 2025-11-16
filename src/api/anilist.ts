// src/api/anilist.ts
// Stabiles AniList-API-Layer für Renderer (Browser-Context)
// - 30 Min Token-RAM-Cache
// - Liest Token aus anilist.access_token ODER aus anilist{access_token,...} (Kompatibel)
// - Auto-Refresh kurz vor Ablauf via window.shokai.auth.refresh()
// - Öffentliche Queries ohne Token erlaubt; usergebundene Endpunkte nur mit Token
// - subscribeAuth löst lokale Cache-Invalidierung aus

/* ───────────────── Types ───────────────── */

export type Media = {
  id: number;
  title?: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string };
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

declare global {
  interface Window {
    shokai?: {
      store: {
        get: (k: string) => Promise<any>;
        set: (k: string, v: any) => Promise<void>;
        delete?: (k: string) => Promise<void>;
      };
      auth?: {
        login?: () => Promise<void>;
        logout?: () => Promise<void>;
        refresh?: () => Promise<string>;
        onUpdated?: (fn: () => void) => () => void;
      };
    };
  }
}

/* ───────────────── Token-Handling ───────────────── */

const TOKEN_RAM_TTL = 30 * 60 * 1000; // 30 Minuten
let tokenCache: { token: string | null; at: number } = { token: null, at: 0 };
let cachedViewer: any | null = null;

// liest sowohl anilist.access_token als auch anilist{access_token,...}
export async function getAccessToken(): Promise<string | null> {
  const now = Date.now();

  // RAM-Cache
  if (tokenCache.token && now - tokenCache.at < TOKEN_RAM_TTL) {
    return tokenCache.token;
  }

  // 1) Dot-Path
  let access = (await window.shokai?.store?.get("anilist.access_token")) || "";

  // 2) Objekt-Fallback
  if (!access) {
    const obj = (await window.shokai?.store?.get("anilist")) || {};
    access = obj?.access_token || "";
  }

  // Ablaufzeit lesen (beide Pfade)
  let exp = (await window.shokai?.store?.get("anilist.expires_at")) || 0;
  if (!exp) {
    const obj = (await window.shokai?.store?.get("anilist")) || {};
    exp = obj?.expires_at || 0;
  }

  // Refresh-Token lesen (beide Pfade)
  let refresh = (await window.shokai?.store?.get("anilist.refresh_token")) || "";
  if (!refresh) {
    const obj = (await window.shokai?.store?.get("anilist")) || {};
    refresh = obj?.refresh_token || "";
  }

  // Kurz vor Ablauf -> refresh
  if (access && exp && now > exp - 30_000 && refresh && window.shokai?.auth?.refresh) {
    try {
      const newToken = await window.shokai.auth.refresh();
      tokenCache = { token: newToken, at: Date.now() };
      return newToken;
    } catch {
      // Fallback: nutze alten Token, falls Endpunkte noch akzeptieren
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
    // lokale Caches invalidieren
    tokenCache = { token: null, at: 0 };
    cachedViewer = null;
    // evtl. weitere Memory-Caches leeren
    trendingCache = { at: 0, data: [] };
    searchCache.clear();

    try { cb(); } catch {}
  });
  return () => { try { off && off(); } catch {} };
}

/* ───────────────── GQL-Helper ───────────────── */

async function gql<T = any>(query: string, variables?: Record<string, any>, requireAuth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (requireAuth) {
    // Harte Absicherung für usergebundene Endpunkte
    throw new Error("Not authenticated");
  }

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    // 401/403 -> lokalen Token-Cache invalidieren, damit UI korrekt reagiert
    if (res.status === 401 || res.status === 403) {
      tokenCache = { token: null, at: 0 };
    }
    throw new Error(`AniList HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    const msg = json.errors[0]?.message || "AniList error";
    // Bei auth-bezogenen Fehlern ebenfalls Cache invalidieren
    if (/auth|token|unauthorized/i.test(msg)) {
      tokenCache = { token: null, at: 0 };
    }
    throw new Error(msg);
  }
  return json.data as T;
}

/* ───────────────── Öffentliche Daten ───────────────── */

let trendingCache: { at: number; data: Media[] } = { at: 0, data: [] };
const TRENDING_TTL = 5 * 60 * 1000; // 5 Minuten

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

/* ───────────────── User-abhängige Endpunkte ───────────────── */

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

export async function userLists(userId: number) {
  if (!userId) return { lists: [] };
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
  return data.MediaListCollection || { lists: [] };
}

export async function saveEntry(
  mediaId: number,
  status?: string,
  progress?: number,
  score?: number
) {
  // Muss eingeloggt sein
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
  return data.SaveMediaListEntry?.id;
}

/* ───────────────── Suche (öffentlich) ───────────────── */

const searchCache = new Map<string, { at: number; items: Media[] }>();
const SEARCH_TTL = 3 * 60 * 1000; // 3 Minuten

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


// ── Kompatibilitäts-Shims für ältere Aufrufer (z. B. Sidebar) ─────────────────
export async function loginAniList(): Promise<void> {
  await window.shokai?.auth?.login?.();
}

export async function logoutAniList(): Promise<void> {
  try {
    await window.shokai?.auth?.logout?.();
  } finally {
    // Lokale Caches invalidieren
    tokenCache = { token: null, at: 0 };
    cachedViewer = null;
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
