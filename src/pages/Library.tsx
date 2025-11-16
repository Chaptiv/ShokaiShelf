import React, { useEffect, useState } from "react";
import tokens from "@shingen/tokens";
import {
  viewerCached,
  userLists,
  mediaDetails,
  saveEntry,
  type Media,
} from "@api/anilist";
import { AnimatePresence, motion } from "framer-motion";

type Lang = "en" | "ja" | "romaji" | "de";
type ScoreFormat = "POINT_100" | "POINT_10" | "POINT_10_DECIMAL" | "POINT_5" | "POINT_3" | string;

export default function Library() {
  const [me, setMe] = useState<{
    id: number; name: string; avatar?: { large?: string };
    mediaListOptions?: { scoreFormat?: ScoreFormat };
  } | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [lists, setLists] = useState<{ name: string; entries: any[] }[]>([]);
  const [open, setOpen] = useState<Media | null>(null);

  useEffect(() => {
    (async () => {
      const meV = await viewerCached();
      setMe(meV);
      setLists((await userLists(meV.id))?.lists || []);
      try {
        const v = (await window.shokai?.store?.get("ui.lang")) ?? localStorage.getItem("ui.lang") ?? "en";
        setLang(normalizeLang(String(v)));
      } catch {}
    })();
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

  const watching  = getList(lists, ["CURRENT", "WATCHING"]);
  const planning  = getList(lists, ["PLANNING"]);
  const paused    = getList(lists, ["PAUSED"]);
  const dropped   = getList(lists, ["DROPPED"]);
  const completed = getList(lists, ["COMPLETED"]);

  async function reloadLists() {
    if (!me) return;
    const col = await userLists(me.id);
    setLists(col?.lists || []);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
    <div className="sh-glass" style={{ padding: 16 }}>
  	<div className="sh-muted" style={{ fontSize: 12 }}>AniList Listen</div>
 	<div className="sh-h1" style={{ marginTop: 2 }}>{me?.name ? `Hallo, ${me.name}` : "Hallo!"}</div>
   </div>

      <Section title="Aktuell (Watching)">
        <Grid>
          {watching.map((e) => (
            <Card key={e.media.id} m={e.media} title={titleOf(e.media)} scoreFormat={me?.mediaListOptions?.scoreFormat}
              sub={nextAiringText(e.media)} onOpen={async ()=> setOpen(await mediaDetails(e.media.id))} />
          ))}
        </Grid>
      </Section>

      <Section title="Geplant (Planning)">
        <Grid>
          {planning.map((e) => (
            <Card key={e.media.id} m={e.media} title={titleOf(e.media)} scoreFormat={me?.mediaListOptions?.scoreFormat}
              onOpen={async ()=> setOpen(await mediaDetails(e.media.id))} />
          ))}
        </Grid>
      </Section>

      {paused.length > 0 && (
        <Section title="Pausiert">
          <Grid>
            {paused.map((e) => (
              <Card key={e.media.id} m={e.media} title={titleOf(e.media)} scoreFormat={me?.mediaListOptions?.scoreFormat}
                onOpen={async ()=> setOpen(await mediaDetails(e.media.id))} />
            ))}
          </Grid>
        </Section>
      )}

      {dropped.length > 0 && (
        <Section title="Abgebrochen">
          <Grid>
            {dropped.map((e) => (
              <Card key={e.media.id} m={e.media} title={titleOf(e.media)} scoreFormat={me?.mediaListOptions?.scoreFormat}
                onOpen={async ()=> setOpen(await mediaDetails(e.media.id))} />
            ))}
          </Grid>
        </Section>
      )}

      <Section title="Abgeschlossen (Completed)">
        <Grid>
          {completed.map((e) => (
            <Card key={e.media.id} m={e.media} title={titleOf(e.media)} scoreFormat={me?.mediaListOptions?.scoreFormat}
              sub="Abgeschlossen" onOpen={async ()=> setOpen(await mediaDetails(e.media.id))} />
          ))}
        </Grid>
      </Section>

      <AnimatePresence>
        {open && (
          <InfoDrawer
            media={open}
            title={titleOf(open)}
            scoreFormat={me?.mediaListOptions?.scoreFormat}
            onClose={() => setOpen(null)}
            onSaved={async () => { setOpen(null); await reloadLists(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* helpers & components */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><div className="sh-section"><h2 style={{ margin: 0 }}>{title}</h2></div>{children}</div>);
}
function Grid({ children }: { children: React.ReactNode }) {
  return (<div className="sh-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", alignItems: "start" }}>{children}</div>);
}
function Card({
  m, title, sub, scoreFormat, onOpen,
}: { m: Media; title: string; sub?: string; scoreFormat?: ScoreFormat; onOpen: () => void; }) {
  const cover = m.coverImage?.extraLarge || m.coverImage?.large;
  const status = m.mediaListEntry?.status;
  const progress = m.mediaListEntry?.progress ?? 0;
  const total = m.episodes || 0;
  const userScore = m.mediaListEntry?.score;

  return (
    <div className="sh-glass" style={{ padding: 8, cursor: "pointer" }} onClick={onOpen}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "2 / 3", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" }}>
          {cover ? <img src={cover} alt={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ position: "absolute", inset: 0 }} />}
        </div>

        {status && (
          <div style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 900, padding: "2px 8px",
            background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 999 }}>
            {status}
          </div>
        )}

        {typeof userScore === "number" && (
          <div style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 900, padding: "2px 8px",
            background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 999 }}>
            ★ {renderScore(userScore, scoreFormat)}
          </div>
        )}

        {status === "CURRENT" && total > 0 && (
          <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, height: 6, borderRadius: 4, background: "rgba(255,255,255,.2)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (progress / total) * 100)}%`, height: "100%", background: tokens.colors.accent }} />
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title}>
        {title}
      </div>
      <div className="sh-muted" style={{ fontSize: 12, marginTop: 2 }}>
        {sub || (m.nextAiringEpisode ? nextAiringText(m) : (status === "COMPLETED" ? "Abgeschlossen" : ""))}
      </div>
    </div>
  );
}
function getList(lists: { name?: string; entries?: any[] }[], names: string[]) {
  const set = new Set(names.map((n) => n.toUpperCase()));
  return (lists.find((l) => set.has(String(l.name).toUpperCase()))?.entries || []).filter((e) => e?.media?.id);
}
function nextAiringText(m: Media) {
  const ts = m.nextAiringEpisode?.airingAt; if (!ts) return "";
  const diff = Math.max(0, ts * 1000 - Date.now());
  const min = Math.floor(diff / 60000);
  if (min < 60) return `in ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return (min % 60) ? `in ${h}h ${min % 60}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `in ${d}d ${rh}h`;
}
function renderScore(v: number, fmt?: ScoreFormat) {
  const max = fmt === "POINT_100" ? 100 : fmt === "POINT_5" ? 5 : fmt === "POINT_3" ? 3 : 10;
  return `${v}/${max}`;
}

/* Drawer + Utils */
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
        <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,.12)", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 18, flex: 1 }}>{title}</div>
          <button className="sh-btn" onClick={onClose}>Schließen</button>
        </div>
        <div className="sh-scroll" style={{ padding: 12 }}>
          {media.bannerImage && (
            <img src={media.bannerImage} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)" }} />
          )}

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div className="sh-muted">
              Episoden: {media.episodes || "?"}
              {media.nextAiringEpisode ? ` • Nächste Folge #${media.nextAiringEpisode.episode}` : ""}
            </div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Fortschritt</div>
              <div className="sh-muted" style={{ marginBottom: 6 }}>{progress}/{max}</div>
              <input type="range" min={0} max={max} value={progress} onChange={(e) => setProgress(parseInt(e.target.value))} style={{ width: "100%" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="sh-btn" onClick={() => setProgress(Math.max(0, progress - 1))}>–</button>
                <button className="sh-btn" onClick={() => setProgress(Math.min(max, progress + 1))}>+</button>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                        style={{ height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.08)", color: "#fff", padding: "0 10px" }}>
                  {["CURRENT", "PLANNING", "PAUSED", "DROPPED", "COMPLETED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Score</div>
              <div className="sh-muted" style={{ marginBottom: 6 }}>{score} / {bounds.max}</div>
              <input type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={score}
                     onChange={(e) => setScore(clampScore(parseFloat(e.target.value)))} style={{ width: "100%" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="sh-btn" onClick={() => setScore(clampScore(score - bounds.step))}>–</button>
                <button className="sh-btn" onClick={() => setScore(clampScore(score + bounds.step))}>+</button>
                <button className="sh-btn" onClick={() => setScore(0)}>Score löschen</button>
              </div>
            </div>

            <button className="sh-btn primary" onClick={async () => {
              const nextStatus = media.episodes && progress >= media.episodes ? "COMPLETED" : status;
              await saveEntry(media.id, nextStatus, progress, score || undefined);
              onSaved();
            }}>
              Speichern
            </button>

            <div className="sh-glass" style={{ padding: 12 }}>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(media.description) }} />
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
