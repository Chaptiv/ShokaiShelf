// src/logic/rhythm.ts
// Shokai-Rhythm v1 – komplett lokal, regelbasiert, erklärbar.

import type { Media } from "@api/anilist";

export type Mood = "auto" | "cozy" | "energetic" | "dark" | "bright";
export type Session = { minutes?: number }; // verfügbare Zeit (optional)

export type RhythmContext = {
  mood: Mood;
  dayPart: "morning" | "day" | "evening" | "late";
  weekend: boolean;
  weather?: "sunny" | "cloudy" | "rainy" | "cold" | "hot"; // optional, wenn du später mal nachrüstest
};

export type UserProfile = {
  likedGenres: Record<string, number>;   // Genre → Score
  dislikedGenres: Record<string, number>;
  seenIds: Set<number>;                  // alles, was schon in einer Liste ist
  completedIds: Set<number>;
  droppedIds: Set<number>;
};

// ——— Kontext ableiten (ohne Netz) ———
export function inferContext(now = new Date(), mood?: Mood): RhythmContext {
  const h = now.getHours();
  const dayPart = h < 6 ? "late" : h < 12 ? "morning" : h < 18 ? "day" : "evening";
  const weekend = [0, 6].includes(now.getDay());
  return { mood: mood || "auto", dayPart, weekend };
}

// ——— Profil aus Listen bauen ———
type Entry = { status?: string; progress?: number; media?: Media | null };
type AniListCollection = { lists?: { name?: string; entries?: Entry[] }[] };

export function buildProfile(col?: AniListCollection | null): UserProfile {
  const liked: Record<string, number> = {};
  const disliked: Record<string, number> = {};
  const seenIds = new Set<number>();
  const completedIds = new Set<number>();
  const droppedIds = new Set<number>();

  for (const lst of col?.lists || []) {
    for (const e of lst?.entries || []) {
      const m = e.media || undefined;
      if (!m?.id) continue;
      seenIds.add(m.id);

      const gs = (m as any).genres as string[] | undefined;
      const status = String(e.status || "").toUpperCase();

      if (status === "COMPLETED") {
        completedIds.add(m.id);
        for (const g of gs || []) liked[g] = (liked[g] || 0) + 2;
      } else if (status === "DROPPED") {
        droppedIds.add(m.id);
        for (const g of gs || []) disliked[g] = (disliked[g] || 0) + 2;
      } else if (status === "CURRENT" || status === "PAUSED" || status === "PLANNING") {
        for (const g of gs || []) liked[g] = (liked[g] || 0) + 0.5;
      }
    }
  }

  return { likedGenres: liked, dislikedGenres: disliked, seenIds, completedIds, droppedIds };
}

// ——— Scoring-Regeln v1 ———
type RankOptions = {
  limit?: number;
  session?: Session;
};

export type Scored<T> = T & { __score: number; __why: string[] };

export function rank(
  candidates: Media[],
  profile: UserProfile,
  ctx: RhythmContext,
  opts: RankOptions = {}
): Scored<Media>[] {
  const limit = Math.max(1, opts.limit ?? 12);
  const out: Scored<Media>[] = [];

  for (const m of candidates) {
    if (!m?.id) continue;

    const why: string[] = [];
    let score = 0;

    // 1) Bereits gesehen? Leicht abwerten (wir empfehlen primär Neues)
    if (profile.seenIds.has(m.id)) {
      score -= 2;
      why.push("bereits in deiner Liste");
    }

    const genres: string[] = (m as any).genres || [];
    const eps = (m.episodes ?? 0) || 0;
    const avgScore = ((m as any).averageScore as number | undefined) ?? 0;
    const popularity = ((m as any).popularity as number | undefined) ?? 0;
    const seasonYear = ((m as any).seasonYear as number | undefined) ?? 0;
    const duration = ((m as any).duration as number | undefined) ?? 0;

    // 2) Genre-Persönlichkeit
    let gScore = 0;
    for (const g of genres) {
      gScore += (profile.likedGenres[g] || 0) - (profile.dislikedGenres[g] || 0);
    }
    if (gScore) {
      score += clamp(gScore, -5, 6);
      if (gScore > 0) why.push("passt zu deinen Genres");
      else why.push("Genres eher unpassend");
    }

    // 3) Stimmung/Context (ohne Wetter: Zeit & Mood)
    const cozySet = new Set(["Slice of Life", "Romance", "Comedy", "Iyashikei"]);
    const energeticSet = new Set(["Action", "Adventure", "Sci-Fi", "Sports", "Mecha"]);
    const darkSet = new Set(["Thriller", "Horror", "Psychological", "Drama", "Mystery"]);

    const has = (set: Set<string>) => genres.some(g => set.has(g));

    // automatische Ableitung bei mood=auto
    const effectiveMood =
      ctx.mood !== "auto" ? ctx.mood :
      ctx.dayPart === "late" || ctx.dayPart === "evening" ? "cozy" :
      "energetic";

    if (effectiveMood === "cozy" && has(cozySet)) { score += 2; why.push("cozy-Mood"); }
    if (effectiveMood === "energetic" && has(energeticSet)) { score += 2; why.push("energetisch"); }
    if (effectiveMood === "dark" && has(darkSet)) { score += 2; why.push("düster"); }
    if (effectiveMood === "bright" && (has(cozySet) || genres.includes("Fantasy"))) { score += 1.5; why.push("hell/leicht"); }

    // 4) „Zeitbudget“ – kurze Staffeln/kurze Episoden bevorzugen bei kurzer Session
    const sessionMins = opts.session?.minutes ?? 0;
    if (sessionMins > 0) {
      const epLen = duration || 24;
      const estSession = Math.min(eps || 12, Math.ceil(sessionMins / epLen));
      // Bevorzugt Serien, bei denen 1–3 Episoden in die Session passen
      const sweet = estSession >= 1 && estSession <= 3;
      if (sweet) { score += 1.2; why.push("passt in dein Zeitfenster"); }
    } else {
      // Keine Angabe → kurze Staffeln leicht bevorzugen
      if (eps > 0 && eps <= 13) { score += 0.7; why.push("kurze Staffel"); }
    }

    // 5) Frische/Recency
    if (seasonYear) {
      const rec = Math.max(0, Math.min(1, (seasonYear - 2015) / 10));
      score += rec * 1.2;
      if (rec > 0.8) why.push("neu/frisch");
    }

    // 6) Qualität/Beliebtheit (sanft)
    if (avgScore) score += (avgScore / 100) * 1.5;
    if (popularity) score += Math.min(1.5, Math.log10(Math.max(1, popularity)) / 3);

    // 7) Abwerten, wenn gedroppt
    if (profile.droppedIds.has(m.id)) { score -= 3; why.push("zuvor gedroppt"); }

    out.push(Object.assign({}, m, { __score: score, __why: why }));
  }

  // Re-Ranking: Diversität (Genre-Dedupe light)
  out.sort((a, b) => b.__score - a.__score);
  const takenGenres = new Set<string>();
  const diversified: Scored<Media>[] = [];
  for (const item of out) {
    const g = ((item as any).genres || [])[0]; // Hauptgenre
    let bonus = 0;
    if (g && !takenGenres.has(g)) bonus = 0.5;
    diversified.push({ ...item, __score: item.__score + bonus });
    if (g) takenGenres.add(g);
    if (diversified.length >= limit) break;
  }

  return diversified;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
