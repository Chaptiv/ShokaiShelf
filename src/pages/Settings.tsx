import React, { useEffect, useState } from "react";
import tokens from "@shingen/tokens";
import { viewerCached, subscribeAuth } from "@api/anilist";

type ScoreFormat = "POINT_100" | "POINT_10" | "POINT_10_DECIMAL" | "POINT_5" | "POINT_3" | string;

export default function Settings({ onLoggedIn }: { onLoggedIn?: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [me, setMe] = useState<{ id:number; name:string; avatar?:{large?:string}; mediaListOptions?:{ scoreFormat?: ScoreFormat } }|null>(null);
  const [expText, setExpText] = useState<string>("");

  async function loadStatus() {
    try {
      const cfg = await window.shokai?.store?.get("anilist");
      const token: string | undefined = cfg?.access_token;
      setAuthed(!!token);

      const exp = Number(cfg?.expires_at || 0);
      if (exp > 0) {
        const ms = exp - Date.now();
        setExpText(ms > 0 ? `Token läuft in ${fmtDuration(ms)} ab` : "Token abgelaufen");
      } else {
        setExpText("");
      }

      if (token) {
        const v = await viewerCached();
        setMe(v);
      } else {
        setMe(null);
      }
    } catch {
      setAuthed(false); setMe(null); setExpText("");
    }
  }

  useEffect(() => {
    void loadStatus();
    const off = subscribeAuth(() => {
      void loadStatus();
      onLoggedIn?.();
    });
    return off;
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="sh-glass" style={{ padding: 16 }}>
        <div className="sh-h1">Einstellungen</div>
        <div className="sh-muted">AniList-Anbindung & App-Status</div>
      </div>

      <div className="sh-glass" style={{ padding: 16, display: "grid", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {me?.avatar?.large ? (
            <img src={me.avatar.large} style={{ width: 48, height: 48, borderRadius: "50%" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: tokens.colors.glass }} />
          )}
          <div>
            <div style={{ fontWeight: 800 }}>
              {authed ? (me?.name || "Eingeloggt") : "Nicht angemeldet"}
            </div>
            <div className="sh-muted" style={{ fontSize: 12 }}>
              {authed ? (expText || "Token aktiv") : "Bitte mit AniList verbinden"}
            </div>
          </div>
        </div>

        {!authed ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="sh-btn primary"
              onClick={async () => {
                // ⬇️ HTTP-Callback-Flow starten (öffnet System-Browser)
                await window.shokai?.auth?.login();
                // Nach Callback sendet Main „auth:updated“ → loadStatus() wird über subscribeAuth getriggert
              }}
            >
              Mit AniList anmelden (Browser)
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="sh-btn"
              onClick={async () => {
                await window.shokai?.auth?.logout();
                await loadStatus();
              }}
            >
              Abmelden
            </button>
            <button
              className="sh-btn"
              onClick={async () => {
                // manuelles Refresh (falls vorhanden)
                try {
                  await window.shokai?.auth?.refresh?.();
                } catch {}
                await loadStatus();
              }}
            >
              Token aktualisieren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}
