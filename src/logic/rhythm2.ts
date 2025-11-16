// src/logic/rhythm2.ts
// Shokai-Rhythm v2 (leichtgewichtig, 100% lokal)
// - TF-IDF-Ähnlichkeit (Titel + Synonyme + Genres + Tags + Studios)
// - Positiv-/Negativ-Centroid aus deinem Verlauf (inkl. Scores)
// - Relevanz-Score (sim+/- + Meta-Features) + MMR-Re-Ranking (Diversität)
// - Unterschiedliche Profile für Dashboard vs. Suche
// - Sharing: Speichert die letzten Dashboard-Empfehlungen, damit Suche „anders“ ist

import type { Media } from "@api/anilist";

export type Mood = "auto" | "cozy" | "energetic" | "dark" | "bright";
export type RhythmContext = {
  mood: Mood;
  dayPart: "morning" | "day" | "evening" | "late";
  weekend: boolean;
};
export type Session = { minutes?: number };

export function inferContext(now = new Date(), mood?: Mood): RhythmContext {
  const h = now.getHours();
  const dayPart = h < 6 ? "late" : h < 12 ? "morning" : h < 18 ? "day" : "evening";
  const weekend = [0, 6].includes(now.getDay());
  return { mood: mood || "auto", dayPart, weekend };
}

// ---------- Profil aus Listen ----------

type Entry = { status?: string; progress?: number; score?: number; media?: Media | null };
type AniListCollection = { lists?: { name?: string; entries?: Entry[] }[] };

export type Profile = {
  // Gewichte je Genre (aus Completed/Current/Planning) und Anti-Gewichte aus Dropped
  likedGenres: Record<string, number>;
  dislikedGenres: Record<string, number>;
  // Stichworte für Positiv-/Negativ-Centroid (IDs mit Score-Gewichten)
  likeIds: { id: number; w: number }[];
  dislikeIds: { id: number; w: number }[];
  // Sets für schnelle Penalties
  seenIds: Set<number>;
  completedIds: Set<number>;
  droppedIds: Set<number>;
};

export function buildProfileV2(col?: AniListCollection | null): Profile {
  const liked: Record<string, number> = {};
  const disliked: Record<string, number> = {};
  const likeIds: { id: number; w: number }[] = [];
  const dislikeIds: { id: number; w: number }[] = [];
  const seen = new Set<number>();
  const completed = new Set<number>();
  const dropped = new Set<number>();

  for (const lst of col?.lists || []) {
    for (const e of lst?.entries || []) {
      const m = e.media || undefined;
      if (!m?.id) continue;
      const id = m.id;
      seen.add(id);

      const status = String(e.status || "").toUpperCase();
      const score = typeof e.score === "number" ? e.score : undefined;
      const gnames: string[] = (m as any).genres || [];

      if (status === "COMPLETED") completed.add(id);
      if (status === "DROPPED") dropped.add(id);

      // Genre-Gewichte
      if (status === "DROPPED") {
        for (const g of gnames) disliked[g] = (disliked[g] || 0) + 2;
      } else if (status === "COMPLETED" || status === "CURRENT" || status === "PLANNING" || status === "PAUSED") {
        for (const g of gnames) liked[g] = (liked[g] || 0) + (status === "COMPLETED" ? 2 : 0.5);
      }

      // Score-basierte Anker (Like-/Dislike-Centroid)
      if (typeof score === "number" && !Number.isNaN(score)) {
        const norm = (score - 5) / 5; // -1..+1
        if (norm > 0.2) likeIds.push({ id, w: norm });          // z. B. 7-10
        else if (norm < -0.2) dislikeIds.push({ id, w: -norm }); // z. B. 1-3
      } else {
        // Ohne Score: Completed = leichter Like, Dropped = leichter Dislike
        if (status === "COMPLETED") likeIds.push({ id, w: 0.6 });
        if (status === "DROPPED") dislikeIds.push({ id, w: 0.6 });
      }
    }
  }

  return { likedGenres: liked, dislikedGenres: disliked, likeIds, dislikeIds, seenIds: seen, completedIds: completed, droppedIds: dropped };
}

// ---------- Feature-Index (TF-IDF) ----------

type Doc = { id: number; vec: Map<number, number> }; // sparse TF-IDF
type Index = {
  vocab: Map<string, number>;
  idf: Float32Array;   // idf[termId]
  docs: Map<number, Doc>; // mediaId -> doc
  N: number;           // Dokumentenzahl
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function textFor(m: Media): string {
  const t = [
    m.title?.english, m.title?.romaji, m.title?.native,
    ...(((m as any).synonyms as string[]) || []),
    ...(((m as any).genres as string[]) || []),
  ]
    .filter(Boolean)
    .join(" ");

  const tags = (((m as any).tags as { name: string }[]) || []).map(x => x.name).join(" ");
  const studios = ((((m as any).studios || {}).nodes || []) as { name: string }[]).map(x => x.name).join(" ");

  return [t, tags, studios].filter(Boolean).join(" ");
}

function buildIndex(items: Media[]): Index {
  const vocab = new Map<string, number>();
  const df = new Map<number, number>();
  const docs = new Map<number, Doc>();

  // 1) Vokabular + TF sammeln
  for (const m of items) {
    if (!m?.id) continue;
    const tokens = tokenize(textFor(m));
    if (tokens.length === 0) continue;
    const tf = new Map<number, number>();
    const seenTerms = new Set<number>();

    for (const tok of tokens) {
      let tid = vocab.get(tok);
      if (tid == null) { tid = vocab.size; vocab.set(tok, tid); }
      tf.set(tid, (tf.get(tid) || 0) + 1);
      if (!seenTerms.has(tid)) { df.set(tid, (df.get(tid) || 0) + 1); seenTerms.add(tid); }
    }
    docs.set(m.id, { id: m.id, vec: tf }); // temporär TF – wird gleich zu TF-IDF
  }

  const N = Math.max(1, docs.size);
  // 2) IDF berechnen
  const idf = new Float32Array(vocab.size);
  for (const [tok, tid] of vocab) {
    const dfi = df.get(tid) || 1;
    idf[tid] = Math.log((N + 1) / (dfi + 1)) + 1; // smoothing
  }

  // 3) TF→TF-IDF + Normierung
  for (const doc of docs.values()) {
    let norm = 0;
    for (const [tid, tf] of doc.vec) {
      const w = (1 + Math.log(tf)) * idf[tid]; // log-TF
      doc.vec.set(tid, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [tid, w] of doc.vec) doc.vec.set(tid, w / norm);
  }

  return { vocab, idf, docs, N };
}

function cosSim(a: Map<number, number>, b: Map<number, number>): number {
  // beide sind bereits L2-normalisiert
  let sum = 0;
  if (a.size < b.size) {
    for (const [k, va] of a) { const vb = b.get(k); if (vb) sum += va * vb; }
  } else {
    for (const [k, vb] of b) { const va = a.get(k); if (va) sum += va * vb; }
  }
  return sum; // -1..+1, bei TF-IDF >= 0
}

function centroid(index: Index, ids: { id: number; w: number }[]): Map<number, number> | null {
  if (!ids.length) return null;
  const acc = new Map<number, number>();
  let wsum = 0;
  for (const { id, w } of ids) {
    const d = index.docs.get(id);
    if (!d) continue;
    wsum += w;
    for (const [k, v] of d.vec) acc.set(k, (acc.get(k) || 0) + w * v);
  }
  if (wsum <= 0) return null;
  // Normierung
  let norm = 0;
  for (const [, v] of acc) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of acc) acc.set(k, v / norm);
  return acc;
}

// ---------- Ranking + MMR ----------

type RankBaseOpts = {
  limit?: number;
  session?: Session;
  ctx?: RhythmContext;
  excludeIds?: Set<number>;
  // Tuning:
  lambdaMMR?: number;        // 0..1 (Relevanz vs. Diversität)
  popularityCap?: number;    // deckelt Popularitätseinfluss (Suche -> niedriger)
  seenPenalty?: number;      // Abwertung für „bereits in Liste“
};

function normalize(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, (n - lo) / Math.max(1e-9, hi - lo)));
}

function contextBoost(genres: string[], ctx: RhythmContext): number {
  const cozySet = new Set(["slice of life", "romance", "comedy", "iyashikei"]);
  const energeticSet = new Set(["action", "adventure", "sci-fi", "sports", "mecha"]);
  const darkSet = new Set(["thriller", "horror", "psychological", "drama", "mystery"]);
  const gs = genres.map(g => g.toLowerCase());
  const has = (set: Set<string>) => gs.some(g => set.has(g));

  const mood = ctx.mood !== "auto"
    ? ctx.mood
    : (ctx.dayPart === "evening" || ctx.dayPart === "late") ? "cozy" : "energetic";

  if (mood === "cozy" && has(cozySet)) return 0.15;
  if (mood === "energetic" && has(energeticSet)) return 0.15;
  if (mood === "dark" && has(darkSet)) return 0.15;
  if (mood === "bright" && (has(cozySet) || gs.includes("fantasy"))) return 0.1;
  return 0;
}

function relevanceScore(
  m: Media,
  dvec: Map<number, number>,
  simPos: number,
  simNeg: number,
  prof: Profile,
  ctx: RhythmContext,
  popularityCap: number,
  session?: Session
): number {
  const avgScore = ((m as any).averageScore as number | undefined) || 0;        // 0..100
  const popularity = ((m as any).popularity as number | undefined) || 0;        // 0..large
  const seasonYear = ((m as any).seasonYear as number | undefined) || 0;        // e.g. 2023
  const duration = ((m as any).duration as number | undefined) || 0;            // minutes
  const eps = (m.episodes || 0);

  const genres: string[] = ((m as any).genres || []) as string[];

  // Popularität logarithmisch, gedeckelt
  const popN = Math.min(Math.log10(Math.max(1, popularity)) / 5, Math.log10(Math.max(10, popularityCap)) / 5);
  const scoreN = avgScore / 100;
  const recentN = seasonYear ? normalize(seasonYear, 2010, new Date().getFullYear()) : 0;

  // Session-Fit: kurze Serien/Episoden bei knapper Zeit
  let sessionBoost = 0;
  const sessionMins = session?.minutes ?? 0;
  if (sessionMins > 0) {
    const epLen = duration || 24;
    const est = Math.min(eps || 12, Math.ceil(sessionMins / epLen));
    if (est >= 1 && est <= 3) sessionBoost = 0.08;
  } else {
    if (eps > 0 && eps <= 13) sessionBoost = 0.05;
  }

  const genreTaste =
    genres.reduce((acc, g) => acc + (prof.likedGenres[g] || 0) - (prof.dislikedGenres[g] || 0), 0);
  const genreN = Math.max(-2, Math.min(2, genreTaste)) / 10; // -0.2..+0.2

  const ctxB = contextBoost(genres, ctx);

  // Endgültige Mischung (gewichtete Summe)
  // simPos/Neg: 0..1, popN/scoreN/recentN: 0..1, boosts ~0.0x
  const rel =
      0.45 * simPos
    - 0.25 * simNeg
    + 0.15 * scoreN
    + 0.12 * popN
    + 0.12 * recentN
    + ctxB
    + sessionBoost
    + genreN;

  return rel;
}

function mmrSelect(
  cand: { m: Media; rel: number; vec: Map<number, number> }[],
  k: number,
  lambda: number
): Media[] {
  const selected: { m: Media; rel: number; vec: Map<number, number> }[] = [];
  const remaining = cand.slice();

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      let maxSimToSel = 0;
      for (const s of selected) {
        const sim = cosSim(c.vec, s.vec);
        if (sim > maxSimToSel) maxSimToSel = sim;
      }
      const mmr = lambda * c.rel - (1 - lambda) * maxSimToSel;
      if (mmr > bestScore) { bestScore = mmr; bestIdx = i; }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected.map(x => x.m);
}

// ---------- Öffentliche API ----------

export type RecommendOpts = RankBaseOpts & { key?: "dashboard" | "search" };

export async function recommendForDashboard(
  candidates: Media[],
  profile: Profile,
  ctx: RhythmContext,
  opts: RecommendOpts = {}
): Promise<Media[]> {
  const index = buildIndex(candidates);
  const pos = centroid(index, profile.likeIds);
  const neg = centroid(index, profile.dislikeIds);

  const exclude = new Set<number>(opts.excludeIds || []);
  // Leichte Abwertung statt harter Ausschluss für „gesehen“ auf dem Dashboard
  const seenPenalty = opts.seenPenalty ?? 0.1;
  const lambda = opts.lambdaMMR ?? 0.7; // mehr Relevanz, weniger Serendipity
  const popCap = opts.popularityCap ?? 200000; // Dashboard darf populärer sein
  const limit = Math.max(1, opts.limit ?? 12);

  const scored: { m: Media; rel: number; vec: Map<number, number> }[] = [];
  for (const m of candidates) {
    if (!m?.id) continue;
    if (exclude.has(m.id)) continue;

    const d = index.docs.get(m.id); if (!d) continue;
    const simPos = pos ? cosSim(d.vec, pos) : 0;
    const simNeg = neg ? cosSim(d.vec, neg) : 0;

    let rel = relevanceScore(m, d.vec, simPos, simNeg, profile, ctx, popCap, opts.session);

    if (profile.seenIds.has(m.id)) rel -= seenPenalty;
    if (profile.droppedIds.has(m.id)) rel -= 0.25;

    scored.push({ m, rel, vec: d.vec });
  }
  scored.sort((a, b) => b.rel - a.rel);

  const picked = mmrSelect(scored, limit, lambda);

  // Teilen wir für die Suche – damit die Suche „anders“ ist
  await saveLastRecommendedIds("dashboard", picked.map(x => x.id));
  return picked;
}

export async function recommendForSearch(
  candidates: Media[],
  profile: Profile,
  ctx: RhythmContext,
  opts: RecommendOpts = {}
): Promise<Media[]> {
  const index = buildIndex(candidates);
  const pos = centroid(index, profile.likeIds);
  const neg = centroid(index, profile.dislikeIds);

  // Suche: bewusst andere Gewichtung -> mehr Discovery
  const lambda = opts.lambdaMMR ?? 0.5;    // stärkerer Diversitätsanteil
  const popCap = opts.popularityCap ?? 80000; // deckelt Popularität stärker
  const limit = Math.max(1, opts.limit ?? 12);

  // Exkludiere, was das Dashboard zuletzt empfohlen hat
  const dashIds = await getLastRecommendedIds("dashboard");
  const exclude = new Set<number>(opts.excludeIds || []);
  for (const id of dashIds) exclude.add(id);

  // Ebenso: Exkludiere Continue-Watching (wenn Caller das übergibt)
  const scored: { m: Media; rel: number; vec: Map<number, number> }[] = [];
  for (const m of candidates) {
    if (!m?.id) continue;
    if (exclude.has(m.id)) continue;

    const d = index.docs.get(m.id); if (!d) continue;
    const simPos = pos ? cosSim(d.vec, pos) : 0;
    const simNeg = neg ? cosSim(d.vec, neg) : 0;

    let rel = relevanceScore(m, d.vec, simPos, simNeg, profile, ctx, popCap, opts.session);

    // Suche: Seen stärker abwerten → Discovery
    if (profile.seenIds.has(m.id)) rel -= opts.seenPenalty ?? 0.2;
    if (profile.droppedIds.has(m.id)) rel -= 0.35;

    // Kleiner Serendipity-Bonus für „nicht so populär“
    const popularity = ((m as any).popularity as number | undefined) || 0;
    if (popularity < 30000) rel += 0.06;

    scored.push({ m, rel, vec: d.vec });
  }
  scored.sort((a, b) => b.rel - a.rel);

  const picked = mmrSelect(scored, limit, lambda);
  await saveLastRecommendedIds("search", picked.map(x => x.id));
  return picked;
}

// ---------- Sharing: letzte Empfehlungen merken ----------

async function storeGet(key: string): Promise<any> {
  try { const v = await (window as any)?.shokai?.store?.get?.(key); if (v !== undefined) return v; } catch {}
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch {}
  return null;
}
async function storeSet(key: string, val: any): Promise<void> {
  try { await (window as any)?.shokai?.store?.set?.(key, val); } catch {}
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export async function saveLastRecommendedIds(scope: "dashboard" | "search", ids: number[]) {
  await storeSet(`recs.${scope}.latest`, ids.slice(0, 50));
}
export async function getLastRecommendedIds(scope: "dashboard" | "search"): Promise<number[]> {
  const v = await storeGet(`recs.${scope}.latest`);
  return Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : [];
}
