import React, { useEffect, useMemo, useState } from "react";
import tokens from "@shingen/tokens";
import {
  viewerCached,
  trendingAnimeCached,
  searchAnime,
  userLists,
  mediaDetails,
  saveEntry,
  subscribeAuth,
  type Media,
} from "@api/anilist";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildProfile,
  inferContext,
  recommendForSearch,
  type Mood,
} from "@logic/netrec";

type Lang = "en" | "ja" | "romaji" | "de";
type ScoreFormat = "POINT_100" | "POINT_10" | "POINT_10_DECIMAL" | "POINT_5" | "POINT_3" | string;

export default function Search() {
  const [me, setMe] = useState<{
    id: number; name: string; avatar?: { large?: string };
    mediaListOptions?: { scoreFormat?: ScoreFormat };
  } | null>(null);
  const [lang, setLang] = useState<Lang>("en");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);

  const [recommended, setRecommended] = useState<Media[]>([]);
  const [popular, setPopular] = useState<Media[]>([]);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);
  const [recents, setRecents] = useState<{ id: number; title: string; cover?: string; at: number }[]>([]);
  const [open, setOpen] = useState<Media | null>(null);

  const [mood, setMood] = useState<Mood>("auto");
  const [sessionMins, setSessionMins] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const v = (await window.shokai?.store?.get("ui.lang")) ?? localStorage.getItem("ui.lang") ?? "en";
        setLang(normalizeLang(String(v)));
        try { await window.shokai?.store?.set("ui.lang", v); } catch {}
        try { localStorage.setItem("ui.lang", String(v)); } catch {}
      } catch { setLang("en"); }

      try {
        const m = await window.shokai?.store?.get("ui.mood"); if (m) setMood(String(m) as Mood);
        const sm = await window.shokai?.store?.get("ui.sessionMins"); if (typeof sm === "number" && sm > 0) setSessionMins(sm);
      } catch {}
    })();

    const un1 = window.shokai?.auth?.onUpdated?.(() => { void initialLoad(); });
    const un2 = subscribeAuth(() => { void initialLoad(); });
    return () => { if (un1) un1(); if (un2) un2(); };
  }, []);

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
        try { await window.shokai?.store?.set("ui.recents", r); } catch {}
      } else {
        try { localStorage.setItem("ui.recents", JSON.stringify(r)); } catch {}
      }
      setRecents(Array.isArray(r) ? r : []);
    } catch { setRecents([]); }
  }
  async function saveRecents(next: { id: number; title: string; cover?: string; at: number }[]) {
    setRecents(next);
    try { await window.shokai?.store?.set("ui.recents", next); } catch {}
    try { localStorage.setItem("ui.recents", JSON.stringify(next)); } catch {}
  }
  function pushRecent(m: Media) {
    const item = { id: m.id, title: titleOf(m), cover: m.coverImage?.large || m.coverImage?.extraLarge, at: Date.now() };
    const filtered = recents.filter((x) => x.id !== m.id);
    const next = [item, ...filtered].slice(0, 18);
    void saveRecents(next);
  }

  async function initialLoad() {
    try {
      const [viewer, trendingAll] = await Promise.all([viewerCached(), trendingAnimeCached()]);
      setMe(viewer);

      setPopular(trendingAll.slice(12, 24).length ? trendingAll.slice(12, 24) : trendingAll.slice(0, 12));

      const lists = await userLists(viewer.id);
      const w = (lists?.lists || []).find((l: any) => ["CURRENT", "WATCHING"].includes(String(l.name).toUpperCase()));
      const continueIds = new Set<number>((w?.entries || []).map((e: any) => e.media?.id).filter(Boolean));
      setContinueWatching((w?.entries || []).map((e: any) => e.media).slice(0, 12));

      const profile = buildProfileV2(lists as any);
      const ctx = inferContext(new Date(), mood);
      const recs = await recommendForSearch(trendingAll, profile, ctx, {
        limit: 12,
        session: { minutes: sessionMins },
        lambdaMMR: 0.5,
        popularityCap: 80000,
        seenPenalty: 0.2,
        excludeIds: continueIds,
      });
      setRecommended(recs);

      await loadRecents();
    } catch (e) {
      console.error(e);
    }
  }
  useEffect(() => { void initialLoad(); }, [mood, sessionMins]);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try { setResults(await searchAnime(q)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const showDiscovery = useMemo(() => query.trim().length === 0, [query]);
  const cols = useResponsiveCols();
  const scoreFormat: ScoreFormat | undefined = me?.mediaListOptions?.scoreFormat;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="sh-glass" style={{ padding: 16 }}>
  	<div className="sh-muted" style={{ fontSize: 12 }}>Suche</div>
  	<div className="sh-h1" style={{ marginTop: 2 }}>Entdecke Neues</div>
     </div>


      <div className="sh-glass" style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="search-input"
            placeholder="Anime suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              border: `1px solid ${tokens.colors.glassBorder}`,
              background: tokens.colors.glass, color: "#fff", padding: "0 14px",
            }}
          />
          <button className="sh-btn" onClick={() => setQuery("")}>Löschen</button>
          <button className="sh-btn primary" onClick={doSearch}>Suchen</button>
        </div>
      </div>

      {showDiscovery ? (
        <div style={{ display: "grid", gap: 24 }}>
          <Section title="Shokai-Rhythm (entdecken)">
            <Grid>
              {recommended.map((m) => (
                <Card key={m.id} m={m} title={titleOf(m)} scoreFormat={scoreFormat} onOpen={setOpen} onSeen={pushRecent} />
              ))}
            </Grid>
          </Section>

          <Section title="Zuletzt angesehen">
            {recents.length === 0 ? (
              <div className="sh-muted">Noch nichts angesehen.</div>
            ) : (
              <Grid>
                {recents.slice(0, 12).map((r) => (
                  <RecentCard key={r.id} r={r} onOpen={async (id) => setOpen(await mediaDetails(id))} />
                ))}
              </Grid>
            )}
          </Section>

          <Section title="Beliebt heute">
            <Grid>
              {popular.map((m) => (
                <Card key={m.id} m={m} title={titleOf(m)} scoreFormat={scoreFormat} onOpen={setOpen} onSeen={pushRecent} />
              ))}
            </Grid>
          </Section>
        </div>
      ) : (
        <div>
          <div className="sh-section">
            <h2>Ergebnisse</h2>
            <div className="sh-muted">{loading ? "Lade …" : `${results.length} Treffer`}</div>
          </div>
          <Grid>
            {results.map((m) => (
              <Card key={m.id} m={m} title={titleOf(m)} scoreFormat={scoreFormat} onOpen={setOpen} onSeen={pushRecent} />
            ))}
          </Grid>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <InfoDrawer
            media={open}
            title={titleOf(open)}
            scoreFormat={scoreFormat}
            onClose={() => setOpen(null)}
            onSaved={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* components */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><div className="sh-section"><h2 style={{ margin: 0 }}>{title}</h2></div>{children}</div>);
}
function Grid({ children }: { children: React.ReactNode }) {
  return (<div className="sh-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", alignItems: "start" }}>{children}</div>);
}
function Poster({ src, alt }: { src?: string; alt?: string }) {
  return (<div style={{ position: "relative", width: "100%", aspectRatio: "2 / 3", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" }}>
    {src ? <img src={src} alt={alt || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ position: "absolute", inset: 0 }} /> }
  </div>);
}
function ScoreBadge({ value, format }: { value?: number; format?: ScoreFormat }) {
  if (value == null) return null;
  const max = format === "POINT_100" ? 100 : format === "POINT_5" ? 5 : format === "POINT_3" ? 3 : 10;
  return (
    <div style={{
      position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 900, padding: "2px 8px",
      background: "rgba(0,0,0,.55)", border: `1px solid ${tokens.colors.glassBorder}`, borderRadius: 999
    }}>
      ★ {value}/{max}
    </div>
  );
}
function Card({ m, title, scoreFormat, onOpen, onSeen }: {
  m: Media; title: string; scoreFormat?: ScoreFormat; onOpen: (m: Media) => void; onSeen: (m: Media) => void;
}) {
  const cover = m.coverImage?.extraLarge || m.coverImage?.large;
  const status = m.mediaListEntry?.status;
  const progress = m.mediaListEntry?.progress ?? 0;
  const total = m.episodes || 0;
  const userScore = m.mediaListEntry?.score;

  return (
    <motion.div whileHover={{ y: -4 }} className="sh-glass" style={{ padding: 8, cursor: "pointer" }}
      onClick={async () => { const full = await mediaDetails(m.id); onOpen(full); onSeen(m); }}>
      <div style={{ position: "relative" }}>
        <Poster src={cover} alt={title} />
        {status && (<div style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 900, padding: "2px 8px",
          background: "rgba(0,0,0,.45)", border: `1px solid ${tokens.colors.glassBorder}`, borderRadius: 999 }}>{status}</div>)}
        <ScoreBadge value={userScore} format={scoreFormat} />
        {status === "CURRENT" && total > 0 && (
          <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, height: 6, borderRadius: 4, background: "rgba(255,255,255,.2)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (progress / total) * 100)}%`, height: "100%", background: tokens.colors.accent }} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title}>{title}</div>
    </motion.div>
  );
}
function RecentCard({ r, onOpen }: { r: { id: number; title: string; cover?: string; at: number }; onOpen: (id: number) => void }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="sh-glass" style={{ padding: 8, cursor: "pointer" }} onClick={() => onOpen(r.id)}>
      <Poster src={r.cover} alt={r.title} />
      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.title}>{r.title}</div>
      <div className="sh-muted" style={{ fontSize: 11, marginTop: 2 }}>vor {timeAgo(r.at)}</div>
    </motion.div>
  );
}
import { sanitizeHtml } from "@utils/sanitize";

function InfoDrawer({
  media, title, scoreFormat, onClose, onSaved,
}: { media: Media; title: string; scoreFormat?: ScoreFormat; onClose: () => void; onSaved: () => void; }) {
  const [progress, setProgress] = useState(media.mediaListEntry?.progress || 0);
  const [status, setStatus] = useState<string>(media.mediaListEntry?.status || "CURRENT");
  const [score, setScore] = useState<number>(typeof media.mediaListEntry?.score === "number" ? (media.mediaListEntry!.score as number) : 0);
  const max = media.episodes || 12;

  const bounds = getScoreBounds(scoreFormat);
  const clampScore = (v: number) => Math.max(bounds.min, Math.min(bounds.max, roundToStep(v, bounds.step)));

  return (
    <>
      <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000", zIndex: 39 }} />
      <motion.div className="sh-glass" initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }}
        style={{ position: "fixed", right: 0, top: 0, height: "100vh", width: 460, zIndex: 40, display: "grid", gridTemplateRows: "auto 1fr", background: tokens.colors.surface }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${tokens.colors.glassBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18, flex: 1 }}>{title}</div>
          <button className="sh-btn" onClick={onClose}>Schließen</button>
        </div>
        <div className="sh-scroll" style={{ padding: 12 }}>
          {media.bannerImage && (<img src={media.bannerImage} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, border: `1px solid ${tokens.colors.glassBorder}` }} />)}
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div className="sh-muted">Episoden: {media.episodes || "?"}{media.nextAiringEpisode ? ` • Nächste Folge #${media.nextAiringEpisode.episode}` : ""}</div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Fortschritt</div>
              <div className="sh-muted" style={{ marginBottom: 6 }}>{progress}/{max}</div>
              <input type="range" min={0} max={max} value={progress} onChange={(e) => setProgress(parseInt(e.target.value))} style={{ width: "100%" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="sh-btn" onClick={() => setProgress(Math.max(0, progress - 1))}>–</button>
                <button className="sh-btn" onClick={() => setProgress(Math.min(max, progress + 1))}>+</button>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 44, borderRadius: 12, border: `1px solid ${tokens.colors.glassBorder}`, background: tokens.colors.glass, color: "#fff", padding: "0 10px" }}>
                  {["CURRENT", "PLANNING", "PAUSED", "DROPPED", "COMPLETED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 800, margin: "8px 0 6px" }}>Deine Bewertung</div>
              <div className="sh-muted" style={{ marginBottom: 6 }}>
                {score ? `★ ${score}/${bounds.max}` : "keine Bewertung"}
              </div>
              <input type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={score} onChange={(e) => setScore(clampScore(parseFloat(e.target.value)))} style={{ width: "100%" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="sh-btn" onClick={() => setScore(clampScore(score - bounds.step))}>–</button>
                <button className="sh-btn" onClick={() => setScore(clampScore(score + bounds.step))}>+</button>
                <button className="sh-btn" onClick={() => setScore(0)}>Löschen</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button className="sh-btn primary" onClick={async () => {
                const nextStatus = media.episodes && progress >= media.episodes ? "COMPLETED" : status;
                await saveEntry(media.id, nextStatus, progress, score || undefined);
                onSaved();
              }}>Speichern</button>
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
    case "POINT_100": return { min: 0, max: 100, step: 1 };
    case "POINT_10_DECIMAL": return { min: 0, max: 10, step: 0.1 };
    case "POINT_10": return { min: 0, max: 10, step: 1 };
    case "POINT_5": return { min: 0, max: 5, step: 0.5 };
    case "POINT_3": return { min: 0, max: 3, step: 1 };
    default: return { min: 0, max: 10, step: 1 };
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
    const onResize = () => { const w = window.innerWidth;
      if (w >= 1800) setCols(7); else if (w >= 1440) setCols(6); else if (w >= 1200) setCols(5);
      else if (w >= 980) setCols(4); else if (w >= 760) setCols(3); else setCols(2); };
    onResize(); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, []); return cols;
}
function timeAgo(ts: number) {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`; const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`; const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`; const d = Math.floor(h / 24); return `${d}d`;
}
