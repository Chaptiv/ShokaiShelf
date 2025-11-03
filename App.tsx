import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsProvider } from "@state/SettingsContext";
import Sidebar from "@shingen/Sidebar";
import Dashboard from "@pages/Dashboard";
import Search from "@pages/Search";
import Library from "@pages/Library";
import Settings from "@pages/Settings";

async function safeStatus(): Promise<any> {
  // 4s Timeout, damit App nicht hängt
  const t = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("status timeout")), 4000)
  );
  // preload evtl. nicht da
  if (!window.shokai || !window.shokai.status) {
    throw new Error("shokai.status not available");
  }
  return Promise.race([window.shokai.status(), t]);
}

type PageKey = "home" | "search" | "library" | "settings";

declare global {
  interface Window {
    shokai?: {
      app: { needsSetup: () => Promise<boolean> };
      setup: { save: (cfg: { client_id: string; client_secret: string; redirect_uri?: string }) => Promise<any> };
      auth: {
        login: () => Promise<any>;
        logout: () => Promise<any>;
        onUpdated?: (cb: (data: any) => void) => () => void;
      };
      status: () => Promise<{ hasCreds: boolean; loggedIn: boolean; viewerName?: string | null }>;
    };
  }
}

/* ───────────────── Onboarding ───────────────── */
function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Willkommen bei ShokaiShelf ✨",
      subtitle: "Danke, dass du ShokaiShelf nutzt.",
      body: "Lokaler Anime-Client, AniList-Anbindung, modernes UI.",
      icon: "🟦",
      badge: "Setup abgeschlossen",
    },
    {
      title: "Wie es funktioniert 🗂️",
      subtitle: "Dashboard, Library, Suche, Einstellungen.",
      body: "• Dashboard = Überblick\n• Library = deine Listen\n• Suche = neue Titel\n• Einstellungen = Login & Keys",
      icon: "🧭",
      badge: "Navigation",
    },
    {
      title: "AnimeNetRec V2 🚀",
      subtitle: "Dein Empfehlungs-Modul.",
      body:
        "Gewichtet deine echten Daten:\n• abgeschlossene Titel\n• abgebrochene Titel\n• hohe Bewertungen\n• Studio-/Season-Nähe\n→ Ergebnis: Empfehlungen, die wirklich zu dir passen.",
      icon: "🧠",
      badge: "Recommendation Engine",
    },
    {
      title: "Local Worker 📦",
      subtitle: "Alles läuft lokal.",
      body:
        "ShokaiShelf’s Recommendation Engine (AnimeNetRec V2) läuft komplett auf deinem Rechner.\n\nEs nutzt nur deine AniList-Daten, berechnet die Empfehlungen lokal und schickt nichts an fremde Server.\n\nNur AniList wird kontaktiert, um deine Liste zu lesen/aktualisieren oder neue Titel zu suchen.",
      icon: "📦",
      badge: "Lokale Power",
    },
    {
      title: "Public-Builds 📦",
      subtitle: "Jeder trägt seine Keys ein.",
      body: "Du kannst ShokaiShelf weitergeben, ohne deine Secrets mitzuschicken.",
      icon: "📦",
      badge: "Weitergabe",
    },
  ];
  const s = steps[step];
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        style={{
          width: 720,
          background: "#0a0f18",
          border: "1px solid rgba(0,212,255,0.15)",
          borderRadius: 18,
          boxShadow: "0 20px 55px rgba(0,0,0,0.55)",
          display: "grid",
          gridTemplateColumns: "230px 1fr",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            background: "radial-gradient(circle at top, #0f1824 0%, #060912 80%)",
            borderRight: "1px solid rgba(255,255,255,0.04)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>ShokaiShelf Onboarding</div>
          {steps.map((st, i) => (
            <button
              key={st.title}
              onClick={() => setStep(i)}
              style={{
                textAlign: "left",
                background: i === step ? "rgba(0,212,255,0.18)" : "transparent",
                border: i === step ? "1px solid rgba(0,212,255,0.4)" : "1px solid transparent",
                borderRadius: 10,
                padding: "9px 10px 8px 10px",
                color: "#fff",
                display: "flex",
                gap: 10,
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.25)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 16,
                }}
              >
                {st.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{st.title}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{st.badge}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: "18px 20px 16px 20px", color: "#fff", display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>
                Schritt {step + 1} von {steps.length}
              </div>
              <h2 style={{ margin: "4px 0 4px 0" }}>{s.title}</h2>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>{s.subtitle}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                borderRadius: 8,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Schließen
            </button>
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.12)",
              border: "1px solid rgba(255,255,255,0.02)",
              borderRadius: 14,
              padding: 14,
              flex: 1,
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              fontSize: 13,
            }}
          >
            {s.body}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {steps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 22,
                    height: 4,
                    borderRadius: 99,
                    background: i === step ? "#00d4ff" : "rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {step > 0 && (
                <button
                  onClick={() => setStep((p) => Math.max(0, p - 1))}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "5px 14px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Zurück
                </button>
              )}
              {step < steps.length - 1 ? (
                <button
                  onClick={() => setStep((p) => Math.min(steps.length - 1, p + 1))}
                  style={{
                    background: "#00d4ff",
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 14px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Weiter
                </button>
              ) : (
                <button
                  onClick={onClose}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: 8,
                    padding: "5px 14px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Los geht’s
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ───────────────── Setup ───────────────── */
function SetupScreen() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const redirectUri = "http://127.0.0.1:43210/callback";
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const onSave = async () => {
    setErr("");
    if (!clientId.trim() || !clientSecret.trim()) {
      setErr("Client ID und Client Secret werden benötigt.");
      return;
    }
    await window.shokai?.setup?.save({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: redirectUri,
    });
    localStorage.setItem("shokai:firstRun", "1");
    setSaved(true);
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "radial-gradient(circle at top, #101624 0%, #060912 55%, #060912 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 460,
          background: "rgba(7,10,16,0.65)",
          border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: 18,
          backdropFilter: "blur(8px)",
          boxShadow: "0 20px 55px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 20px 10px 20px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(140deg, #00d4ff 0%, #5a6fff 90%)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 14,
                color: "#04070f",
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>ShokaiShelf Setup</div>
              <div style={{ fontSize: 11, color: "rgba(221,235,255,0.55)" }}>AniList verbinden</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 20, color: "#fff" }}>
          <p style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
            Trage hier <b>deine</b> AniList OAuth-Daten ein.
          </p>

          <label style={labelStyle}>Client ID</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Deine AniList Client ID"
            style={inputStyle}
          />

          <label style={labelStyle}>Client Secret</label>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Dein AniList Client Secret"
            style={inputStyle}
            type="password"
          />

          <label style={labelStyle}>Redirect URI (fest)</label>
          <input value={redirectUri} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />

          {err && (
            <div
              style={{
                background: "rgba(255,76,76,0.12)",
                border: "1px solid rgba(255,76,76,0.3)",
                borderRadius: 10,
                padding: "6px 9px",
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {err}
            </div>
          )}

          {saved ? (
            <div style={{ marginTop: 14, fontSize: 12, color: "#a8ffdb" }}>
              Konfiguration gespeichert.{" "}
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                App neu laden
              </button>
            </div>
          ) : (
            <button
              onClick={onSave}
              style={{
                width: "100%",
                marginTop: 16,
                background: "linear-gradient(120deg, #00d4ff 0%, #367fff 100%)",
                border: "none",
                borderRadius: 10,
                padding: "9px 12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Speichern & fortfahren
            </button>
          )}

          <p style={{ marginTop: 14, fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>
            Für Public-Builds bitte eigene Keys nutzen.
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  opacity: 0.7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(2,4,8,0.35)",
  border: "1px solid rgba(175,214,255,0.08)",
  borderRadius: 8,
  padding: "7px 9px",
  color: "#fff",
  outline: "none",
  margin: "6px 0 14px 0",
  fontSize: 13,
};

/* ───────────────── Login-Required ───────────────── */
function LoginRequired({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "#0a0e14", color: "#fff" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h2>Du bist abgemeldet</h2>
        <p style={{ opacity: 0.7 }}>Bitte melde dich bei AniList an.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button
            onClick={() => window.shokai?.auth?.login?.()}
            style={{
              background: "#00d4ff",
              border: "none",
              borderRadius: 6,
              padding: "6px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            AniList Login
          </button>
          <button
            onClick={onRetry}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 6,
              padding: "6px 16px",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Erneut prüfen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Fancy Loader ───────────────── */
function BootLoader({ status }: { status: string }) {
  return (
    <div
      style={{
        height: "100vh",
        background: "radial-gradient(circle at top, #0a0e14 0%, #060912 55%, #060912 100%)",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.12)",
            borderTop: "4px solid #00d4ff",
            margin: "0 auto 16px auto",
            animation: "spin 1s linear infinite",
          }}
        />
        <h2 style={{ marginBottom: 6 }}>ShokaiShelf startet…</h2>
        <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 14 }}>{status}</p>
        <style>
          {`@keyframes spin { from {transform: rotate(0deg);} to {transform: rotate(360deg);} }`}
        </style>
      </div>
    </div>
  );
}

/* ───────────────── App ───────────────── */
export default function App() {
  const [page, setPage] = useState<PageKey>("home");
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bootStatus, setBootStatus] = useState("IPC verbinden…");
  const [engineReady, setEngineReady] = useState(true);

  const hasBridge = typeof window !== "undefined" && !!window.shokai;

  // versucht AnimeNetRec V2 vorzuwärmen; wenn Datei nicht da ist: egal
  const preloadEngine = async () => {
    try {
      setBootStatus("AnimeNetRec V2 initialisieren…");
      // Pfad an dein Projekt angepasst
      const mod = await import("@logic/netrecV2");
      if (typeof mod?.warmup === "function") {
        await mod.warmup();
      } else if (typeof mod?.init === "function") {
        await mod.init();
      }
      setEngineReady(true);
    } catch (_e) {
      // Engine nicht vorhanden → trotzdem weiter
      setEngineReady(true);
    }
  };

  const refresh = async () => {
    if (!hasBridge) {
      console.log("No bridge found");
      return;
    }
    
    console.log("=== REFRESH START ===");
    
    try {
      setBootStatus("Setup-Status prüfen…");
      console.log("Calling needsSetup...");
      
      const mustSetup = await Promise.race([
        window.shokai.app.needsSetup(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("needsSetup timeout")), 5000))
      ]);
      
      console.log("needsSetup result:", mustSetup);
      
      if (mustSetup) {
        console.log("Setup required, showing setup screen");
        setNeedsSetup(true);
        setLoggedIn(false);
        setLoading(false);
        return;
      }
  
      setBootStatus("Login-Status prüfen…");
      console.log("Calling status...");
      
      const status = await Promise.race([
        window.shokai.status(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("status timeout")), 5000))
      ]);
      
      console.log("Status result:", status);
      
      if (!status.loggedIn) {
        console.log("Not logged in, showing login screen");
        setNeedsSetup(false);
        setLoggedIn(false);
        setLoading(false);
        return;
      }
  
      setBootStatus("Profil laden…");
      console.log("Loading profile...");
      
      try {
        const api = await import("@api/anilist");
        const me = await api.viewer();
        setUsername(me?.name || status.viewerName || "");
        setAvatar(me?.avatar?.large || "");
      } catch (e) {
        console.log("Profile load failed, using status name:", e);
        setUsername(status.viewerName || "");
      }
  
      setBootStatus("Engine initialisieren…");
      await preloadEngine();
  
      console.log("Everything loaded, showing app");
      setNeedsSetup(false);
      setLoggedIn(true);
      setLoading(false);
  
      const first = localStorage.getItem("shokai:firstRun");
      if (first === "1") {
        setShowOnboarding(true);
        localStorage.setItem("shokai:firstRun", "0");
      }
    } catch (error) {
      console.error("REFRESH ERROR:", error);
      // Bei Fehler: zeige Login-Screen als Fallback
      setNeedsSetup(false);
      setLoggedIn(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasBridge) return;
    refresh();
    const off = window.shokai.auth?.onUpdated?.(() => refresh());
    return () => off && off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBridge]);

  // kein preload
  if (!hasBridge) {
    return (
      <SettingsProvider>
        <BootLoader status="Preload nicht gefunden. Bitte Electron prüfen…" />
      </SettingsProvider>
    );
  }

  // lädt gerade
  if (loading || !engineReady) {
    return (
      <SettingsProvider>
        <BootLoader status={bootStatus} />
      </SettingsProvider>
    );
  }

  if (needsSetup) {
    return (
      <SettingsProvider>
        <SetupScreen />
      </SettingsProvider>
    );
  }

  if (!loggedIn) {
    return (
      <SettingsProvider>
        <LoginRequired onRetry={refresh} />
      </SettingsProvider>
    );
  }

  // echte App
  return (
    <SettingsProvider>
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar page={page} setPage={setPage} authed={true} username={username} avatar={avatar} hideCharacters />
        <div style={{ flex: 1, overflowY: "auto", background: "#060912" }}>
          <div style={{ padding: 20 }}>
            <AnimatePresence mode="popLayout">
              {page === "home" && (
                <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Dashboard />
                </motion.div>
              )}
              {page === "search" && (
                <motion.div key="search" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Search />
                </motion.div>
              )}
              {page === "library" && (
                <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Library />
                </motion.div>
              )}
              {page === "settings" && (
                <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Settings onLoggedIn={() => refresh()} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
    </SettingsProvider>
  );
}
