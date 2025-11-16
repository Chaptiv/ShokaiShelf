import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import tokens from "@shingen/tokens";
import {
  viewerCached,
  trendingAnimeCached,
  userLists,
  mediaDetails,
  saveEntry,
  subscribeAuth,
  type Media,
} from "@api/anilist";
import {
  Mood,
  buildProfile,
  inferContext,
  recommendForDashboard,
  saveLastRecommendedIds,
} from "@logic/netrec";

type Lang = "en" | "ja" | "romaji" | "de";
type ScoreFormat =
  | "POINT_100"
  | "POINT_10"
  | "POINT_10_DECIMAL"
  | "POINT_5"
  | "POINT_3"
  | string;

declare global {
  interface Window {
    shokai?: any;
  }
}

export default function Dashboard() {
  const [me, setMe] = useState<{
    id: number;
    name: string;
    avatar?: { large?: string };
    mediaListOptions?: { scoreFormat?: ScoreFormat };
  } | null>(null);
  const [lang, setLang] = useState<Lang>("en");

  const [carousel, setCarousel] = useState<Media[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
  const [recommend, setRecommend] = useState<Media[]>([]);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);
  const [stats, setStats] = useState<{ watching: number; completed: number; planning: number }>({
    watching: 0,
    completed: 0,
    planning: 0,
  });
  const [nextAiring, setNextAiring] = useState<Media[]>([]);
  const [open, setOpen] = useState<Media | null>(null);
  const [recents, setRecents] = useState<{ id: number; title: string; cover?: string; at: number }[]>([]);

  const [mood, setMood] = useState<Mood>("auto");
  const [sessionMins, setSessionMins] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const v =
          (await window.shokai?.store?.get("ui.lang")) ??
          localStorage.getItem("ui.lang") ??
          "en";
        setLang(normalizeLang(String(v)));
        try {
          await window.shokai?.store?.set("ui.lang", v);
        } catch {}
        try {
          localStorage.setItem("ui.lang", String(v));
        } catch {}
      } catch {
        setLang("en");
      }

      try {
        const m = await window.shokai?.store?.get("ui.mood");
        if (m) setMood(String(m) as Mood);
        const sm = await window.shokai?.store?.get("ui.sessionMins");
        if (typeof sm === "number" && sm > 0) setSessionMins(sm);
      } catch {}
    })();

    const un1 = window.shokai?.auth?.onUpdated?.(() => {
      void reloadAll();
    });
    const un2 = subscribeAuth(() => {
      void reloadAll();
    });
    return () => {
      un1 && un1();
      un2 && un2();
    };
  }, []);

  useEffect(() => {
    void reloadAll();
  }, [mood, sessionMins]);

  function normalizeLang(v: string): Lang {
    if (v === "ja") return "ja";
    if (v === "romaji") return "romaji";
    if (v === "de") return "de";
    return "en";
  }

  function titleOf(m: Media): string {
    if (!m?.title) return String(m?.id ?? "");
    if (lang === "ja") return m.title.native || m.title.romaji || m.title.english || String(m.id);
    if (lang === "romaji") return m.title.romaji || m.title.english || m.title.native || String(m.id);
    if (lang === "de") return m.title.english || m.title.romaji || m.title.native || String(m.id);
    return m.title.english || m.title.romaji || m.title.native || String(m.id);
  }

  async function loadRecents() {
    try {
      let r: any = await window.shokai?.store?.get("ui.recents");
      if (!Array.isArray(r)) {
        const raw = localStorage.getItem("ui.recents");
        r = raw ? JSON.parse(raw) : [];
        try {
          await window.shokai?.store?.set("ui.recents", r);
        } catch {}
      } else {
        try {
          localStorage.setItem("ui.recents", JSON.stringify(r));
        } catch {}
      }
      setRecents(Array.isArray(r) ? r : []);
    } catch {
      setRecents([]);
    }
  }

  function pushRecent(m: Media) {
    const item = {
      id: m.id,
      title: titleOf(m),
      cover: m.coverImage?.large || m.coverImage?.extraLarge,
      at: Date.now(),
    };
    const filtered = recents.filter((x) => x.id !== m.id);
    const next = [item, ...filtered].slice(0, 18);
    setRecents(next);
    try {
      window.shokai?.store?.set("ui.recents", next);
    } catch {}
    try {
      localStorage.setItem("ui.recents", JSON.stringify(next));
    } catch {}
  }

  async function reloadAll() {
    try {
      const [viewer, trendingAll] = await Promise.all([viewerCached(), trendingAnimeCached()]);
      setMe(viewer);

      setCarousel(trendingAll.slice(0, 6));
      setTrending(trendingAll.slice(0, 18));
      setNextAiring(
        [...trendingAll]
          .filter((m) => m.nextAiringEpisode)
          .sort(
            (a, b) =>
              (a.nextAiringEpisode!.airingAt || 0) -
              (b.nextAiringEpisode!.airingAt || 0)
          )
          .slice(0, 5)
      );

      const lists = await userLists(viewer.id);
      const watchingList = (lists?.lists || []).find((l: any) =>
        ["CURRENT", "WATCHING"].includes(String(l.name).toUpperCase())
      );
      const completedList = (lists?.lists || []).find(
        (l: any) => String(l.name).toUpperCase() === "COMPLETED"
      );
      const planningList = (lists?.lists || []).find(
        (l: any) => String(l.name).toUpperCase() === "PLANNING"
      );

      setContinueWatching((watchingList?.entries || []).map((e: any) => e.media).slice(0, 12));
      setStats({
        watching: watchingList?.entries?.length || 0,
        completed: completedList?.entries?.length || 0,
        planning: planningList?.entries?.length || 0,
      });

      // 1) V2 versuchen
      const usedV2 = await tryAnimeNetRecV2({
        viewer,
        trendingAll,
        lists,
        sessionMins,
        mood,
        setRecommend,
      });

      if (!usedV2) {
        // 2) alter NetRec (deine bisherige Version)
        const profile = buildProfile(lists as any);
        const ctx = inferContext(new Date(), mood);

        const candidates: Media[] = uniqById([
          ...trendingAll,
          ...(watchingList?.entries || []).map((e: any) => e.media),
          ...(completedList?.entries || []).slice(0, 120).map((e: any) => e.media),
          ...(planningList?.entries || []).slice(0, 60).map((e: any) => e.media),
        ]);

        const recs = recommendForDashboard(candidates, profile, ctx, {
          k: 12,
          lambdaMMR: 0.7,
          popularityCap: 200000,
          seenPenalty: 0.1,
          sessionMins: sessionMins,
        });

        setRecommend(recs);
        await saveLastRecommendedIds("dashboard", recs.map((x) => x.id));
      }

      await loadRecents();
    } catch (e) {
      console.error(e);
      setRecommend([]);
    }
  }

  async function tryAnimeNetRecV2({
    viewer,
    trendingAll,
    lists,
    sessionMins,
    mood,
    setRecommend,
  }: {
    viewer: any;
    trendingAll: any[];
    lists: any;
    sessionMins: number | undefined;
    mood: any;
    setRecommend: (m: any[]) => void;
  }): Promise<boolean> {
    try {
      const mod = await import("@logic/netrecV2");
      const engine =
        typeof mod.createAnimeNetRecV2 === "function"
          ? mod.createAnimeNetRecV2()
          : new mod.AnimeNetRecV2();
  
      // ---- KATALOG (kurz) ----
      const candidateMedias: any[] = [
        ...trendingAll,
        ...((lists?.lists || []).flatMap((l: any) => l.entries || []).map((e: any) => e.media) ?? []),
      ].filter(Boolean);
  
      const catalog: Record<number, any> = {};
      for (const m of candidateMedias) {
        catalog[m.id] = {
          id: m.id,
          title: m.title?.english || m.title?.romaji || m.title?.native || String(m.id),
          episodes: m.episodes || 0,
          year: m.seasonYear,
          season: m.season,
          baselineScore: (m.popularity || 0) / 1000,
          tags: (m.tags || []).map((t: any) => t.name).filter(Boolean),
        };
      }
  
      // ---- PROFIL ----
      const completedIds =
        (lists?.lists || [])
          .filter((l: any) => String(l.name).toUpperCase() === "COMPLETED")
          .flatMap((l: any) => (l.entries || []).map((e: any) => e.media?.id))
          .filter(Boolean) || [];
  
      const ptwIds =
        (lists?.lists || [])
          .filter((l: any) => String(l.name).toUpperCase() === "PLANNING")
          .flatMap((l: any) => (l.entries || []).map((e: any) => e.media?.id))
          .filter(Boolean) || [];
  
      const scores: Record<number, number> = {};
      for (const l of lists?.lists || []) {
        for (const e of l.entries || []) {
          if (e?.media?.id && typeof e.score === "number" && e.score > 0) {
            scores[e.media.id] = e.score;
          }
        }
      }
  
      const profile = mod.makeProfile({
        userId: String(viewer.id),
        watched: completedIds,
        ptw: ptwIds,
        scores,
        hidden: [],
      });
  
      const ctx = { catalog };
  
      const result = await engine.recommend(profile, ctx, 12);
  
      // ---- HIER: Event auf jeden Fall schreiben + loggen ----
      try {
        const ev = {
          ts: Date.now(),
          userId: String(viewer.id),
          itemId: result[0]?.id ?? 0,
          type: "impression",
          context: "dashboard:v2",
        };
        // direkt IPC
        await window.shokai.rec.insertEvent(ev);
      } catch (e) {
      }
  
      // ---- Ergebnisse zurück auf echte Media mappen ----
      const byId = new Map<number, any>();
      for (const m of candidateMedias) byId.set(m.id, m);
      const mapped = result.map((r: any) => byId.get(r.id)).filter(Boolean);
  
      setRecommend(mapped);
      return true;
    } catch (e) {
      return false;
    }
  }  

  const cols = useResponsiveCols();
  const nowText = useMemo(() => new Date().toLocaleDateString(), []);
  const scoreFormat: ScoreFormat | undefined = me?.mediaListOptions?.scoreFormat;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="sh-glass" style={{ padding: 16 }}>
        <div className="sh-muted" style={{ fontSize: 12 }}>
          Hallo, {me?.name || "Benutzer"}!
        </div>
        <div className="sh-h1" style={{ marginTop: 2 }}>
          Willkommen zurück · Wir haben neue Folgen für dich gefunden
        </div>
        <div className="sh-muted" style={{ marginTop: 4, fontSize: 12 }}>
          {nowText}
        </div>
      </div>

      <BannerCarousel items={carousel} onOpen={async (id) => setOpen(await mediaDetails(id))} titleOf={titleOf} />

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: `repeat(${Math.min(4, cols)}, 1fr)` }}>
        <StatCard label="Watching" value={stats.watching} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="Planning" value={stats.planning} />
        <StatCard label="Zuletzt angesehen" value={recents.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: cols >= 4 ? "2fr 1fr" : "1fr", gap: 20 }}>
        <section id="continue">
          <Section title="Weiter ansehen">
            <Grid>
              {continueWatching.map((m) => (
                <AnimeCard
                  key={m.id}
                  m={m}
                  title={titleOf(m)}
                  scoreFormat={scoreFormat}
                  onOpen={async () => {
                    const full = await mediaDetails(m.id);
                    setOpen(full);
                    pushRecent(m);
                  }}
                />
              ))}
            </Grid>
          </Section>
        </section>
        <aside>
          <Section title="Nächste Ausstrahlungen">
            <div className="sh-glass" style={{ padding: 12, display: "grid", gap: 10 }}>
              {nextAiring.length === 0 ? (
                <div className="sh-muted">Keine Daten.</div>
              ) : (
                nextAiring.map((m) => (
                  <NextAiringRow
                    key={m.id}
                    title={titleOf(m)}
                    inText={airingInText(m)}
                    onClick={async () => setOpen(await mediaDetails(m.id))}
                  />
                ))
              )}
            </div>
          </Section>
        </aside>
      </div>

      <Section title="Anime Empfehlungen für dich - Powered by AnimeNetRec V2">
        <Grid>
          {recommend.map((m) => (
            <AnimeCard
              key={m.id}
              m={m}
              title={titleOf(m)}
              scoreFormat={scoreFormat}
              onOpen={async () => setOpen(await mediaDetails(m.id))}
            />
          ))}
        </Grid>
      </Section>

      <Section title="Beliebt heute">
        <Grid>
          {trending.map((m) => (
            <AnimeCard
              key={m.id}
              m={m}
              title={titleOf(m)}
              scoreFormat={scoreFormat}
              onOpen={async () => setOpen(await mediaDetails(m.id))}
            />
          ))}
        </Grid>
      </Section>

      <AnimatePresence>
        {open && (
          <InfoDrawer
            media={open}
            scoreFormat={scoreFormat}
            title={titleOf(open)}
            onClose={() => setOpen(null)}
            onSaved={async () => {
              setOpen(null);
              await reloadAll();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Helpers/Components ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="sh-section">
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sh-grid"
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="sh-glass" style={{ padding: 14 }}>
      <div className="sh-muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div className="sh-h1" style={{ marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function Poster({ src, alt }: { src?: string; alt?: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "2 / 3",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,.06)",
        border: `1px solid rgba(255,255,255,.10)`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || ""}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0 }} />
      )}
    </div>
  );
}

function ScoreBadge({ value, format }: { value?: number; format?: ScoreFormat }) {
  if (value == null) return null;
  const max =
    format === "POINT_100" ? 100 : format === "POINT_5" ? 5 : format === "POINT_3" ? 3 : 10;
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        fontSize: 11,
        fontWeight: 900,
        padding: "2px 8px",
        background: "rgba(0,0,0,.55)",
        border: `1px solid ${tokens.colors.glassBorder}`,
        borderRadius: 999,
      }}
    >
      ★ {value}/{max}
    </div>
  );
}

function AnimeCard({
  m,
  title,
  scoreFormat,
  onOpen,
}: {
  m: Media;
  title: string;
  scoreFormat?: ScoreFormat;
  onOpen: () => void;
}) {
  const cover = m.coverImage?.extraLarge || m.coverImage?.large;
  const status = m.mediaListEntry?.status;
  const progress = m.mediaListEntry?.progress ?? 0;
  const total = m.episodes || 0;
  const userScore = m.mediaListEntry?.score;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="sh-glass"
      style={{ padding: 8, cursor: "pointer" }}
      onClick={onOpen}
    >
      <div style={{ position: "relative" }}>
        <Poster src={cover} alt={title} />
        {status && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              fontSize: 11,
              fontWeight: 900,
              padding: "2px 8px",
              background: "rgba(0,0,0,.45)",
              border: `1px solid ${tokens.colors.glassBorder}`,
              borderRadius: 999,
            }}
          >
            {status}
          </div>
        )}
        <ScoreBadge value={userScore} format={scoreFormat} />
        {status === "CURRENT" && total > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              height: 6,
              borderRadius: 4,
              background: "rgba(255,255,255,.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (progress / total) * 100)}%`,
                height: "100%",
                background: tokens.colors.accent,
              }}
            />
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          marginTop: 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={title}
      >
        {title}
      </div>
    </motion.div>
  );
}

function NextAiringRow({ title, inText, onClick }: { title: string; inText: string; onClick: () => void }) {
  return (
    <div
      className="sh-glass"
      style={{ padding: 10, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
      onClick={onClick}
    >
      <div style={{ fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </div>
      <div className="sh-muted" style={{ fontSize: 12 }}>
        {inText}
      </div>
      <button className="sh-btn">Öffnen</button>
    </div>
  );
}

import { sanitizeHtml } from "@utils/sanitize";

function InfoDrawer({
  media,
  title,
  scoreFormat,
  onClose,
  onSaved,
}: {
  media: Media;
  title: string;
  scoreFormat?: ScoreFormat;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [progress, setProgress] = useState(media.mediaListEntry?.progress || 0);
  const [status, setStatus] = useState<string>(media.mediaListEntry?.status || "CURRENT");
  const [score, setScore] = useState<number>(
    typeof media.mediaListEntry?.score === "number" ? (media.mediaListEntry!.score as number) : 0
  );
  const max = media.episodes || 12;

  const bounds = getScoreBounds(scoreFormat);
  const clampScore = (v: number) => Math.max(bounds.min, Math.min(bounds.max, roundToStep(v, bounds.step)));

  return (
    <>
      <motion.div
        className="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "#000", zIndex: 39 }}
      />
      <motion.div
        className="sh-glass"
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          height: "100vh",
          width: 460,
          zIndex: 40,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          background: tokens.colors.surface,
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: `1px solid ${tokens.colors.glassBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, flex: 1 }}>{title}</div>
          <button className="sh-btn" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="sh-scroll" style={{ padding: 12 }}>
          {media.bannerImage && (
            <img
              src={media.bannerImage}
              style={{
                width: "100%",
                height: 160,
                objectFit: "cover",
                borderRadius: 12,
                border: `1px solid ${tokens.colors.glassBorder}`,
              }}
            />
          )}
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div className="sh-muted">
              Episoden: {media.episodes || "?"}
              {media.nextAiringEpisode ? ` • Nächste Folge #${media.nextAiringEpisode.episode}` : ""}
            </div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Fortschritt</div>
              <div className="sh-muted" style={{ marginBottom: 6 }}>
                {progress}/{max}
              </div>
              <input
                type="range"
                min={0}
                max={max}
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="sh-btn" onClick={() => setProgress(Math.max(0, progress - 1))}>
                  –
                </button>
                <button className="sh-btn" onClick={() => setProgress(Math.min(max, progress + 1))}>
                  +
                </button>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: `1px solid ${tokens.colors.glassBorder}`,
                    background: tokens.colors.glass,
                    color: "#fff",
                    padding: "0 10px",
                  }}
                >
                  {["CURRENT", "PLANNING", "PAUSED", "DROPPED", "COMPLETED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 800, margin: "8px 0 6px" }}>Deine Bewertung</div>
              <div className="sh-muted" style={{ marginBottom: 6 }}>
                {score ? `★ ${score}/${bounds.max}` : "keine Bewertung"}
              </div>
              <input
                type="range"
                min={bounds.min}
                max={bounds.max}
                step={bounds.step}
                value={score}
                onChange={(e) => setScore(clampScore(parseFloat(e.target.value)))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="sh-btn" onClick={() => setScore(clampScore(score - bounds.step))}>
                  –
                </button>
                <button className="sh-btn" onClick={() => setScore(clampScore(score + bounds.step))}>
                  +
                </button>
                <button className="sh-btn" onClick={() => setScore(0)}>
                  Löschen
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                className="sh-btn primary"
                onClick={async () => {
                  const nextStatus = media.episodes && progress >= media.episodes ? "COMPLETED" : status;
                  await saveEntry(media.id, nextStatus, progress, score || undefined);
                  onSaved();
                }}
              >
                Speichern
              </button>
            </div>

            <div className="sh-glass" style={{ padding: 12 }}>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml((media as any).description) }} />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function getScoreBounds(fmt?: ScoreFormat): { min: number; max: number; step: number } {
  switch (fmt) {
    case "POINT_100":
      return { min: 0, max: 100, step: 1 };
    case "POINT_10_DECIMAL":
      return { min: 0, max: 10, step: 0.1 };
    case "POINT_10":
      return { min: 0, max: 10, step: 1 };
    case "POINT_5":
      return { min: 0, max: 5, step: 0.5 };
    case "POINT_3":
      return { min: 0, max: 3, step: 1 };
    default:
      return { min: 0, max: 10, step: 1 };
  }
}

function roundToStep(v: number, step: number) {
  const k = Math.round(v / step);
  const out = parseFloat((k * step).toFixed(step < 1 ? String(step).split(".")[1].length : 0));
  return out;
}

function useResponsiveCols() {
  const [cols, setCols] = useState(6);
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1800) setCols(7);
      else if (w >= 1440) setCols(6);
      else if (w >= 1200) setCols(5);
      else if (w >= 980) setCols(4);
      else if (w >= 760) setCols(3);
      else setCols(2);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}

function airingInText(m: Media) {
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

function BannerCarousel({
  items,
  onOpen,
  titleOf,
}: {
  items: Media[];
  onOpen: (id: number) => void;
  titleOf: (m: Media) => string;
}) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    stop();
    if (!hover && items.length) {
      timer.current = window.setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
    }
    return stop;
    function stop() {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }
  }, [items.length, hover]);

  const cur = items[idx];

  return (
    <div
      className="sh-glass"
      style={{ padding: 0, overflow: "hidden", position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ position: "relative", width: "100%", height: 320 }}>
        {cur?.bannerImage || cur?.coverImage?.extraLarge ? (
          <img
            src={cur.bannerImage || cur.coverImage?.extraLarge!}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: tokens.colors.glass }} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cur ? titleOf(cur) : "—"}
          </div>
          <div className="sh-muted" style={{ fontSize: 12 }}>
            {cur?.episodes ? `${cur.episodes} Episoden` : "?"}
          </div>
          <div style={{ flex: 1 }} />
          <button className="sh-btn" onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}>
            ‹
          </button>
          <button className="sh-btn primary" onClick={() => cur && onOpen(cur.id)} disabled={!cur}>
            Details
          </button>
          <button className="sh-btn" onClick={() => setIdx((i) => (i + 1) % items.length)}>
            ›
          </button>
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 56, display: "flex", gap: 6 }}>
          {items.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: i === idx ? tokens.colors.accent : "rgba(255,255,255,.35)",
                border: `1px solid ${tokens.colors.glassBorder}`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* === kleine Helfer === */
function uniqById(arr: Media[]): Media[] {
  const m = new Map<number, Media>();
  for (const x of arr) if (x?.id && !m.has(x.id)) m.set(x.id, x);
  return Array.from(m.values());
}
