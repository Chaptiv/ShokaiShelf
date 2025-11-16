// src/logic/netrec.ts
// AnimeNetRec v3 – lokaler, graphbasierter Recommender (ohne ML/HF/Server)
// - Nodes = Medien (Kandidaten aus Trending + User-Listen + Suche)
// - Kanten = Ähnlichkeit über Tags/Genres/Studios/Format/Jahr (gewichtete, ungerichtete Edges)
// - Ranking = Personalized PageRank (+ negatives PR), BFS-Proximität, Meta (Popularity), Mood-Modulation
// - Diversität = MMR (Jaccard auf Tag+Genre)
// - Keine Fallbacks hier – wenn keine Knoten/Kanten → leere Liste (zum Debuggen gewollt)

import type { Media } from "@api/anilist";

/* ===================== Typen ===================== */

export type Mood = "auto" | "cozy" | "action" | "dark" | "romance" | "random";

export type Profile = {
  positive: Set<number>;         // Seeds mit hoher Affinität (Scores, Completed high, Current high)
  negative: Set<number>;         // Dropped/Low-Score
  scores: Map<number, number>;   // normalisierte Scores [0..100] (optional)
};

export type Context = {
  mood: Mood;
  hour: number;                       // 0..23
  sessionMins?: number;               // verfügbare Zeit (kann für Runtime-Fits genutzt werden)
  softGenreBoost: Map<string, number>;// genre/tag -> multiplier (1.0 neutral)
};

type Node = {
  id: number;
  idx: number;                        // Position im Graph-Array
  genres: string[];
  tags: string[];
  studios: string[];
  format?: string | null;
  seasonYear?: number | null;
  popularity?: number | null;
};

type Edge = { to: number; w: number }; // adjacency list

export type Graph = {
  nodes: Node[];
  adj: Edge[][];
  byId: Map<number, number>;
  popMin: number;
  popMax: number;
  scope: "dashboard" | "search";
  builtAt: number;
};

/* ===================== Utils ===================== */

const norm = (s?: string) => (s || "").trim().toLowerCase();

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a); let inter = 0;
  for (const t of b) if (A.has(t)) inter++;
  const uni = a.length + b.length - inter;
  return inter / Math.max(1, uni);
}

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

/* ===================== Profil aus Listen bauen ===================== */

type AniListCollection = { lists: { name: string; entries: any[] }[] };

export function buildProfile(collection: AniListCollection): Profile {
  const positive = new Set<number>();
  const negative = new Set<number>();
  const scores = new Map<number, number>();

  const lists = collection?.lists || [];
  for (const L of lists) {
    for (const e of L.entries || []) {
      const id: number | undefined = e?.media?.id ?? e?.mediaId ?? e?.id;
      if (!id) continue;

      const rawScore = typeof e?.score === "number" ? e.score : 0;
      // grob auf 0..100 mappen
      const sc = rawScore > 10 ? rawScore : rawScore * 10;
      if (sc > 0) scores.set(id, clamp(sc, 0, 100));

      const status = String(e?.status || "").toUpperCase();
      const prog = e?.progress ?? 0;
      const eps = e?.media?.episodes ?? 0;

      // Positive Seeds
      if (sc >= 80 || (status === "COMPLETED" && sc >= 70) || (status === "CURRENT" && sc >= 75)) {
        positive.add(id);
      }
      // Negative Seeds
      if (status === "DROPPED" || sc <= 40) {
        negative.add(id);
      }
      // Completed ohne Score aber voll gesehen → leicht positiv
      if (!scores.has(id) && status === "COMPLETED" && eps > 0 && prog >= eps) {
        positive.add(id);
      }
    }
  }
  return { positive, negative, scores };
}

/* ===================== Kontext ableiten ===================== */

export function inferContext(now: Date, mood: Mood): Context {
  const hour = now.getHours();
  const softGenreBoost = new Map<string, number>();
  const m = mood === "auto" ? autoMood(hour) : mood;

  if (m === "cozy") {
    ["slice of life", "iyashikei", "comedy", "school", "music"].forEach(g => softGenreBoost.set(g, 1.2));
  } else if (m === "action") {
    ["action", "shounen", "adventure", "super power", "military"].forEach(g => softGenreBoost.set(g, 1.2));
  } else if (m === "dark") {
    ["psychological", "thriller", "mystery", "horror"].forEach(g => softGenreBoost.set(g, 1.2));
  } else if (m === "romance") {
    ["romance", "drama", "josei", "shoujo"].forEach(g => softGenreBoost.set(g, 1.2));
  }
  return { mood: m, hour, sessionMins: undefined, softGenreBoost };
}

function autoMood(hour: number): Mood {
  if (hour >= 23 || hour < 6) return "cozy";
  if (hour >= 6 && hour < 10) return "action";
  if (hour >= 18 && hour < 23) return "dark";
  return "auto"; // neutral
}

/* ===================== Graph-Aufbau ===================== */

type BuildOptions = {
  scope: "dashboard" | "search";
  jaccardGate?: number;        // Kante nur wenn Jaccard >= Gate (Tags+Genres)
  maxNeighborsPerTag?: number; // Hub-Kappung pro sehr häufigem Tag
  yearBonus?: number;          // +Bonus wenn SeasonYear nahe
};

export function buildGraph(candidates: Media[], opts?: BuildOptions): Graph {
  const scope = opts?.scope ?? "dashboard";
  const J_GATE = opts?.jaccardGate ?? 0.3;
  const MAX_PER_TAG = opts?.maxNeighborsPerTag ?? 120;
  const YEAR_BONUS = opts?.yearBonus ?? 0.12;

  // Nodes
  const nodes: Node[] = [];
  const byId = new Map<number, number>();
  let popMin = Number.POSITIVE_INFINITY;
  let popMax = 0;

  for (const m of candidates) {
    if (!m?.id) continue;
    const idx = nodes.length;
    const genres = (m.genres || []).map(norm);
    const tags = (m.tags || []).map(t => norm(t?.name)).filter(Boolean);
    const studios = (m.studios?.nodes || []).map(s => norm(s?.name)).filter(Boolean);
    const format = m.format || null;
    const seasonYear = m.seasonYear || null;
    const popularity = typeof m.popularity === "number" ? m.popularity : null;
    if (popularity != null) { popMin = Math.min(popMin, popularity); popMax = Math.max(popMax, popularity); }

    nodes.push({ id: m.id, idx, genres, tags, studios, format, seasonYear, popularity });
    byId.set(m.id, idx);
  }
  if (!nodes.length) return { nodes: [], adj: [], byId, popMin: 0, popMax: 1, scope, builtAt: Date.now() };

  // Inverted Indices
  const invTag = new Map<string, number[]>();
  const invGenre = new Map<string, number[]>();
  const invStudio = new Map<string, number[]>();
  const invFormat = new Map<string, number[]>();

  nodes.forEach((n) => {
    n.tags.forEach(t => push(invTag, t, n.idx));
    n.genres.forEach(g => push(invGenre, g, n.idx));
    n.studios.forEach(s => push(invStudio, s, n.idx));
    if (n.format) push(invFormat, norm(n.format), n.idx);
  });

  // df/IDF
  const N = nodes.length;
  const idf = new Map<string, number>();
  for (const [t, arr] of invTag) idf.set("tag:" + t, Math.log((N + 1) / (arr.length + 1)));
  for (const [g, arr] of invGenre) idf.set("genre:" + g, Math.log((N + 1) / (arr.length + 1)));
  for (const [s, arr] of invStudio) idf.set("studio:" + s, Math.log((N + 1) / (arr.length + 1)));
  for (const [f, arr] of invFormat) idf.set("format:" + f, Math.log((N + 1) / (arr.length + 1)));

  // Adjacency bauen
  const adj: Edge[][] = Array.from({ length: N }, () => []);
  const seenPair = new Set<string>();

  for (const u of nodes) {
    const pool = new Set<number>();
    for (const t of u.tags) {
      const lst = invTag.get(t);
      if (lst) lst.slice(0, MAX_PER_TAG).forEach(i => { if (i !== u.idx) pool.add(i); });
    }
    for (const g of u.genres) {
      const lst = invGenre.get(g);
      if (lst) lst.forEach(i => { if (i !== u.idx) pool.add(i); });
    }
    for (const s of u.studios) {
      const lst = invStudio.get(s);
      if (lst) lst.forEach(i => { if (i !== u.idx) pool.add(i); });
    }
    if (u.format) {
      const lst = invFormat.get(norm(u.format));
      if (lst) lst.forEach(i => { if (i !== u.idx) pool.add(i); });
    }

    for (const vIdx of pool) {
      if (vIdx === u.idx) continue;
      const v = nodes[vIdx];
      const key = u.idx < v.idx ? `${u.idx}:${v.idx}` : `${v.idx}:${u.idx}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);

      // Gate via Jaccard (nur Tag+Genre)
      const j = jaccard(uniq([...u.tags, ...u.genres]), uniq([...v.tags, ...v.genres]));
      if (j < J_GATE) continue;

      // Gewicht über gewichtete Überschneidung + Year/Format Boni
      let w = 0;

      const sharedTags = intersect(u.tags, v.tags);
      for (const t of sharedTags) {
        const wTag = 1.0 * (idf.get("tag:" + t) ?? 1);
        w += wTag;
      }

      const sharedGenres = intersect(u.genres, v.genres);
      for (const g of sharedGenres) {
        const wGenre = 0.6 * (idf.get("genre:" + g) ?? 1);
        w += wGenre;
      }

      const sharedStudios = intersect(u.studios, v.studios);
      for (const s of sharedStudios) {
        const wStudio = 0.4 * (idf.get("studio:" + s) ?? 1);
        w += wStudio;
      }

      if (u.format && v.format && norm(u.format) === norm(v.format)) {
        w += 0.15 * (idf.get("format:" + norm(u.format)) ?? 1);
      }

      if (u.seasonYear && v.seasonYear && Math.abs(u.seasonYear - v.seasonYear) <= 1) {
        w += YEAR_BONUS;
      }

      if (w <= 0) continue;

      // ungerichtete Edge
      adj[u.idx].push({ to: v.idx, w });
      adj[v.idx].push({ to: u.idx, w });
    }
  }

  return {
    nodes,
    adj,
    byId,
    popMin: Number.isFinite(popMin) ? popMin : 0,
    popMax: popMax || 1,
    scope,
    builtAt: Date.now(),
  };

  function push(map: Map<string, number[]>, key: string, v: number) {
    const k = norm(key);
    const arr = map.get(k);
    if (arr) arr.push(v); else map.set(k, [v]);
  }
  function intersect(a: string[], b: string[]): string[] {
    if (!a.length || !b.length) return [];
    const A = new Set(a); const out: string[] = [];
    for (const t of b) if (A.has(t)) out.push(t);
    return out;
  }
}

/* ===================== Ranking ===================== */

type RankOptions = {
  k?: number;
  lambdaMMR?: number;     // 0..1
  popularityCap?: number; // cap für Meta-Boost
  seenPenalty?: number;   // Strafe, wenn bereits in Seeds
  excludeIds?: Set<number>;
  sessionMins?: number;
};

export function rankNetRec(
  graph: Graph,
  profile: Profile,
  ctx: Context,
  opts?: RankOptions,
  catalog?: Map<number, Media>
): Media[] {
  const K = opts?.k ?? 20;
  const lambda = clamp(opts?.lambdaMMR ?? 0.7, 0, 1);
  const seenPenalty = clamp(opts?.seenPenalty ?? 0.1, 0, 0.9);
  const exclude = opts?.excludeIds || new Set<number>();

  // Personalized PageRank (positiv & negativ)
  const prPos = personalizedPageRank(graph, profile.positive, 0.85, 24);
  const prNeg = profile.negative.size ? personalizedPageRank(graph, profile.negative, 0.85, 20) : new Float32Array(graph.nodes.length);

  // BFS-Proximität (bis Tiefe 3)
  const bfs = bfsProximity(graph, profile.positive, 3);

  // Meta/Popularity + Mood
  const meta = new Float32Array(graph.nodes.length);
  const mood = new Float32Array(graph.nodes.length);

  const popMin = graph.popMin, popMax = graph.popMax || 1;
  const cap = opts?.popularityCap ?? 250_000;

  for (const n of graph.nodes) {
    const i = n.idx;

    // Popularity-Deckel → mapped 0..1
    const p = clamp((Math.min(cap, n.popularity ?? 0) - popMin) / Math.max(1, (Math.min(cap, popMax) - popMin)), 0, 1);
    const popBoost = sigmoid((p - 0.5) * 4); // glatte S-Kurve
    meta[i] = popBoost;

    // Mood-Boost (weiche Multiplikatoren über Genres/Tags)
    let mb = 1.0;
    for (const g of n.genres) {
      const mul = ctx.softGenreBoost.get(g);
      if (mul) mb *= mul;
    }
    for (const t of n.tags) {
      const mul = ctx.softGenreBoost.get(t);
      if (mul) mb *= mul;
    }
    mood[i] = mb; // ~1.0 neutral, >1.0 bevorzugt
  }

  // Gesamtscore
  const S = new Float32Array(graph.nodes.length);
  const alpha = 0.55, beta = 0.25, gamma = 0.20, delta = 0.15, kappa = 0.10;

  for (let i = 0; i < graph.nodes.length; i++) {
    let s = 0;
    s += alpha * prPos[i];
    s -= beta * prNeg[i];
    s += gamma * bfs[i];
    s += delta * meta[i];
    s *= kappa * mood[i] + (1 - kappa);

    // leichte Strafe für Seeds (damit Neues nachrückt)
    if (profile.positive.has(graph.nodes[i].id)) s *= (1 - seenPenalty);
    S[i] = s;
  }

  // Kandidatenliste (ohne excludeIds)
  const candidates = graph.nodes
    .filter(n => !exclude.has(n.id))
    .map(n => ({ id: n.id, idx: n.idx, score: S[n.idx] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(K * 4, 60)); // Preselect für MMR

  // Diversifizierung via MMR
  const picked: { id: number; idx: number; score: number }[] = [];
  while (picked.length < K && candidates.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      // Ähnlichkeit zu bereits gewählten über Jaccard(Tag+Genre)
      const sim = picked.length ? Math.max(...picked.map(p => simNode(graph, p.idx, c.idx))) : 0;
      const mmr = lambda * c.score - (1 - lambda) * sim;
      if (mmr > bestVal) { bestVal = mmr; bestIdx = i; }
    }
    picked.push(candidates.splice(bestIdx, 1)[0]);
  }

  // Media-Objekte liefern (aus "catalog" Map; wenn nicht vorhanden → nichts)
  const out: Media[] = picked
    .map(p => catalog?.get(p.id))
    .filter((m): m is Media => !!m);

  return out;
}

/* ========= Helpers: PPR, BFS, Ähnlichkeit ========= */

function personalizedPageRank(graph: Graph, seeds: Set<number>, damping = 0.85, iters = 24): Float32Array {
  const N = graph.nodes.length;
  const v = new Float32Array(N);
  if (N === 0) return v;

  // Teleport-Vektor (uniform auf Seeds, sonst uniform)
  const seedIdx: number[] = [];
  for (const id of seeds) {
    const i = graph.byId.get(id);
    if (i != null) seedIdx.push(i);
  }
  const tele = new Float32Array(N);
  if (seedIdx.length) {
    const w = 1 / seedIdx.length;
    for (const i of seedIdx) tele[i] = w;
  } else {
    const w = 1 / N;
    for (let i = 0; i < N; i++) tele[i] = w;
  }

  // Startvektor
  for (let i = 0; i < N; i++) v[i] = tele[i];

  // vorab: normalisierte Übergänge
  const P: { to: number; p: number }[][] = graph.adj.map((row) => {
    const sum = row.reduce((acc, e) => acc + e.w, 0) || 1;
    return row.map(e => ({ to: e.to, p: e.w / sum }));
  });

  const tmp = new Float32Array(N);
  for (let it = 0; it < iters; it++) {
    tmp.fill(0);
    for (let i = 0; i < N; i++) {
      const row = P[i];
      const val = v[i];
      for (const e of row) tmp[e.to] += damping * val * e.p;
    }
    // Teleport
    for (let i = 0; i < N; i++) tmp[i] += (1 - damping) * tele[i];
    v.set(tmp);
  }
  // Normierung
  const sum = v.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < N; i++) v[i] /= sum;

  return v;
}

function bfsProximity(graph: Graph, seeds: Set<number>, maxDepth = 3): Float32Array {
  const N = graph.nodes.length;
  const out = new Float32Array(N);
  if (!seeds.size || N === 0) return out;

  const seedIdx: number[] = [];
  for (const id of seeds) {
    const i = graph.byId.get(id);
    if (i != null) seedIdx.push(i);
  }
  const INF = 1e9;
  const dist = new Int32Array(N).fill(INF);
  const q: number[] = [];

  for (const s of seedIdx) { dist[s] = 0; q.push(s); }

  let qh = 0;
  while (qh < q.length) {
    const u = q[qh++];
    const d = dist[u] + 1;
    if (d > maxDepth) continue;
    for (const e of graph.adj[u]) {
      if (dist[e.to] > d) {
        dist[e.to] = d;
        q.push(e.to);
      }
    }
  }

  // Proximität: 1, 0.6, 0.35, 0.2 für Tiefe 0..3
  for (let i = 0; i < N; i++) {
    const d = dist[i];
    if (d === 0) out[i] = 1;
    else if (d === 1) out[i] = 0.6;
    else if (d === 2) out[i] = 0.35;
    else if (d === 3) out[i] = 0.2;
    else out[i] = 0;
  }
  return out;
}

function simNode(g: Graph, i: number, j: number): number {
  const a = g.nodes[i], b = g.nodes[j];
  const setA = uniq([...a.tags, ...a.genres]);
  const setB = uniq([...b.tags, ...b.genres]);
  return jaccard(setA, setB);
}

/* ===================== High-Level Helpers ===================== */

type RankOpts = Partial<RankOptions>;

export function recommendForDashboard(
  candidates: Media[],
  profile: Profile,
  ctx: Context,
  opts?: RankOpts
): Media[] {
  const graph = buildGraph(candidates, { scope: "dashboard", jaccardGate: 0.3, maxNeighborsPerTag: 120 });
  const exclude = new Set<number>();
  // Dashboard: Completed/Current rausnehmen
  for (const m of candidates) {
    const st = m.mediaListEntry?.status?.toUpperCase();
    if (st === "COMPLETED" || st === "CURRENT") exclude.add(m.id);
  }
  const catalog = new Map<number, Media>(candidates.map(m => [m.id, m]));
  return rankNetRec(graph, profile, ctx, {
    k: 12,
    lambdaMMR: 0.7,
    popularityCap: 250_000,
    seenPenalty: 0.12,
    excludeIds: exclude,
    sessionMins: opts?.sessionMins
  }, catalog);
}

export function recommendForSearch(
  candidates: Media[],
  profile: Profile,
  ctx: Context,
  opts?: RankOpts
): Media[] {
  const graph = buildGraph(candidates, { scope: "search", jaccardGate: 0.28, maxNeighborsPerTag: 160 });
  const catalog = new Map<number, Media>(candidates.map(m => [m.id, m]));
  return rankNetRec(graph, profile, ctx, {
    k: opts?.k ?? 18,
    lambdaMMR: 0.6,
    popularityCap: 180_000,
    seenPenalty: 0.08,
    excludeIds: opts?.excludeIds
  }, catalog);
}

/* ===================== (Optional) Persistenz für Debug/UI ===================== */
// Falls dein Dashboard vorher saveLastRecommendedIds genutzt hat:
export async function saveLastRecommendedIds(scope: "dashboard" | "search", ids: number[]) {
  try { await (window as any)?.shokai?.store?.set?.(`rec.${scope}.last`, ids); } catch {}
  try { localStorage.setItem(`rec.${scope}.last`, JSON.stringify(ids)); } catch {}
}
export async function loadLastRecommendedIds(scope: "dashboard" | "search"): Promise<number[]> {
  try {
    const v = await (window as any)?.shokai?.store?.get?.(`rec.${scope}.last`);
    if (Array.isArray(v)) return v as number[];
  } catch {}
  try {
    const raw = localStorage.getItem(`rec.${scope}.last`);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
  } catch {}
  return [];
}
