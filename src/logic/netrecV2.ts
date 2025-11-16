// src/logic/netrecV2.ts

// sehr nah an der Swift-Struktur, aber für Renderer/Electron gebaut

export type RecEventType =
  | "impression"
  | "click"
  | "play_start"
  | "add_to_ptw"
  | "hide";

export interface RecEvent {
  ts: number;
  userId: string;
  itemId: number;
  type: RecEventType;
  context?: any;
}

export interface RecCatalogNode {
  id: number;
  title: string;
  episodes?: number;
  year?: number;
  season?: string;
  baselineScore?: number;
  tags?: string[];
  studios?: string[];
  relations?: { type: string; toId: number }[];
  popularity?: number;
}

export interface RecContext {
  catalog: Record<number, RecCatalogNode>;
  now?: number;
}

export interface Profile {
  userId: string;
  watched: number[];
  ptw: number[];
  scores: Record<number, number>;
  hidden: number[];
}

export interface RecResultItem {
  id: number;
  score: number;
  why?: string[];
}

export interface RecConfig {
  longRunnerPenalty: number;
  ptwBoost: number;
  sequelPenalty: number;
  prequelBoost: number;
  mmrLambda: number;
  negativeLabelThrottle: number;
  timeDecayDaysBoost: number;
}

const DEFAULT_CONFIG: RecConfig = {
  longRunnerPenalty: 0.85,
  ptwBoost: 1.25,
  sequelPenalty: 0.75,
  prequelBoost: 1.2,
  mmrLambda: 0.35,
  negativeLabelThrottle: 4,
  timeDecayDaysBoost: 1.05,
};

// kleines lineares Modell – wie Swift PersonalModel
class PersonalModel {
  w: number[];

  constructor(w?: number[]) {
    this.w = w ? [...w] : Array(10).fill(0);
  }

  ensure(n: number) {
    if (this.w.length < n) {
      this.w.push(...Array(n - this.w.length).fill(0));
    }
  }

  predict(x: number[]) {
    let z = 0;
    for (let i = 0; i < x.length; i++) z += this.w[i] * x[i];
    return 1 / (1 + Math.exp(-z));
  }

  update(x: number[], label: number, lr = 0.05) {
    const p = this.predict(x);
    const g = label - p;
    for (let i = 0; i < x.length; i++) {
      this.w[i] += lr * g * x[i];
    }
  }
}

// features wie in Swift: bias, baseline, isPTW, isLong, isSequelMiss, scoreGiven, recency
function makeFeatureVec(
  item: RecCatalogNode,
  profile: Profile,
  ctx: RecContext,
  signals?: { timeBoost?: number }
): number[] {
  const baseline = item.baselineScore ?? (item.popularity ?? 0) / 1000;
  const isPTW = profile.ptw.includes(item.id) ? 1 : 0;
  const isLong = (item.episodes ?? 0) > 52 ? 1 : 0;

  // hat es eine Sequel-Relation, deren Prequel nicht geschaut wurde?
  let sequelMiss = 0;
  if (item.relations && item.relations.length) {
    const hasSequel = item.relations.some((r) => r.type?.toLowerCase() === "sequel");
    if (hasSequel) {
      const needs = item.relations
        .filter((r) => r.type?.toLowerCase() === "prequel")
        .map((r) => r.toId);
      if (needs.length && !needs.every((id) => profile.watched.includes(id)))
        sequelMiss = 1;
    }
  }

  const userScore = profile.scores[item.id] ?? 0;
  const timeBoost = signals?.timeBoost ?? 1;

  return [
    1, // bias
    baseline,
    isPTW,
    isLong,
    sequelMiss,
    userScore / 100,
    timeBoost,
    (item.tags?.length ?? 0) / 10,
    (item.studios?.length ?? 0) / 5,
    (item.year ?? 2000) / 2050,
  ];
}

export function makeProfile(input: {
  userId: string;
  watched?: number[];
  ptw?: number[];
  scores?: Record<number, number>;
  hidden?: number[];
}): Profile {
  return {
    userId: input.userId,
    watched: input.watched ?? [],
    ptw: input.ptw ?? [],
    scores: input.scores ?? {},
    hidden: input.hidden ?? [],
  };
}

export function createAnimeNetRecV2(
  cfg: Partial<RecConfig> = {}
): AnimeNetRecV2 {
  return new AnimeNetRecV2({ ...DEFAULT_CONFIG, ...cfg });
}

export class AnimeNetRecV2 {
  private cfg: RecConfig;

  constructor(cfg: RecConfig) {
    this.cfg = cfg;
  }

  /**
   * Haupt-Methode: versucht wie Swift:
   * - Kandidaten scoren
   * - Events laden
   * - Modell updaten
   * - Impressionen loggen
   */
  async recommend(
    profile: Profile,
    ctx: RecContext,
    k = 12
  ): Promise<RecResultItem[]> {
    const bridge: any = (window as any).shokai || {};
    const now = Date.now();

    // 1) Kandidaten
    const items = Object.values(ctx.catalog);
    if (!items.length) return [];

    // 2) Events laden (kann leer sein)
    let events: RecEvent[] = [];
    try {
      if (bridge.rec?.loadEvents) {
        events = await bridge.rec.loadEvents(profile.userId, 400);
      }
    } catch {
      events = [];
    }

    // 3) bestehendes Modell laden
    let model = new PersonalModel();
    try {
      if (bridge.rec?.getModel) {
        const raw = await bridge.rec.getModel(profile.userId);
        if (raw && Array.isArray(raw.w)) {
          model = new PersonalModel(raw.w);
        }
      }
    } catch {
      // ignore
    }

    // 4) Events → Modell updaten (click, add_to_ptw, play_start, hide)
    for (const ev of events) {
      const node = ctx.catalog[ev.itemId];
      if (!node) continue;
      const fv = makeFeatureVec(node, profile, ctx);
      model.ensure(fv.length);

      switch (ev.type) {
        case "click":
        case "add_to_ptw":
        case "play_start":
          model.update(fv, 1.0, 0.05);
          break;
        case "hide":
          model.update(fv, 0.0, 0.05);
          break;
        default:
          break;
      }
    }

    // 5) Scores berechnen (Baseline * Personalisierung)
    const itemScores: RecResultItem[] = [];

    // Impression-Statistik: wie oft ohne Klick?
    const clickSet = new Set(
      events.filter((e) => e.type !== "impression").map((e) => e.itemId)
    );
    const impCount: Record<number, number> = {};
    for (const ev of events) {
      if (ev.type === "impression") {
        impCount[ev.itemId] = (impCount[ev.itemId] ?? 0) + 1;
      }
    }

    for (const node of items) {
      if (profile.hidden.includes(node.id)) continue;

      const fv = makeFeatureVec(node, profile, ctx, {
        timeBoost: this.cfg.timeDecayDaysBoost,
      });
      model.ensure(fv.length);
      const p = model.predict(fv); // 0..1

      let s = (node.baselineScore ?? (node.popularity ?? 0) / 1000) * (1 + p);

      // PTW-Boost wie Swift
      if (profile.ptw.includes(node.id)) s *= this.cfg.ptwBoost;

      // Long-Runner-Penalty
      if ((node.episodes ?? 0) > 52 && !profile.ptw.includes(node.id)) {
        s *= this.cfg.longRunnerPenalty;
      }

      // Sequel ohne Prequel → penalty
      if (
        node.relations?.some((r) => r.type?.toLowerCase() === "sequel") &&
        node.relations
          ?.filter((r) => r.type?.toLowerCase() === "prequel")
          .some((r) => !profile.watched.includes(r.toId))
      ) {
        s *= this.cfg.sequelPenalty;
      }

      // viele Impressions, kein Klick → runter
      const imps = impCount[node.id] ?? 0;
      if (imps >= this.cfg.negativeLabelThrottle && !clickSet.has(node.id)) {
        s *= 0.5;
      }

      itemScores.push({
        id: node.id,
        score: s,
        why: [],
      });
    }

    // 6) sortieren + Top k
    itemScores.sort((a, b) => b.score - a.score);
    const top = itemScores.slice(0, k);

    // 7) Impressionen zurückschreiben – wie Swift
    try {
      if (bridge.rec?.insertEvent) {
        for (const it of top) {
          await bridge.rec.insertEvent({
            ts: now,
            userId: profile.userId,
            itemId: it.id,
            type: "impression",
            context: "netrecV2:auto",
          } as RecEvent);
        }
      }
    } catch {
      // ignore
    }

    // 8) aktualisiertes Modell speichern
    try {
      if (bridge.rec?.setModel) {
        await bridge.rec.setModel(profile.userId, { w: model.w });
      }
    } catch {
      // ignore
    }

    return top;
  }
}
