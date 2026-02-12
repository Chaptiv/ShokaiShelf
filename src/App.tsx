import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsProvider } from "@state/SettingsContext";
import Sidebar from "@shingen/Sidebar";
import Dashboard from "@pages/Dashboard_dream"; // 🎨 Dream Version
// Feed.tsx entfernt - Social_dream.tsx wird stattdessen verwendet
import Search from "@pages/Search_dream"; // 🎨 Dream Version
import Library from "@pages/Library_dream"; // 🎨 Dream Version
import Social from "@pages/Social_dream"; // 🎨 Dream Version
import Settings from "@pages/Settings";
import Echo from "@pages/Echo";
import Achievements from "@pages/Achievements";
import ScrobblerToast from "@components/ScrobblerToast";
import UpdateBanner from "@components/UpdateBanner";
import type { ScrobblerCandidate } from "../electron/scrobbler";
import * as anilistAPI from "@api/anilist";
import * as netrecV3 from "@logic/netrecV3";
import { findBestMatch } from "@logic/scrobble-matcher";
import { checkAndMigrate, getMigrationStatus } from "@logic/netrecDream/migration";
import { createDreamEngine } from "@logic/netrecDream";
import "./i18n";

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

type PageKey = "home" | "feed" | "search" | "library" | "social" | "settings" | "echo" | "achievements";

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

/* ───────────────── Onboarding Icons ───────────────── */
const OnboardingIcons = {
  welcome: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
    </svg>
  ),
  navigate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 7.5 7.8 8.4 8.3 9.1C6.4 9.6 5 11.3 5 13.5C5 15.5 6.2 17.1 7.8 17.7C7.3 18.3 7 19.1 7 20C7 21.7 8.3 23 10 23" stroke="#00d4ff" />
      <path d="M12 2C14.5 2 16.5 4 16.5 6.5C16.5 7.5 16.2 8.4 15.7 9.1C17.6 9.6 19 11.3 19 13.5C19 15.5 17.8 17.1 16.2 17.7C16.7 18.3 17 19.1 17 20C17 21.7 15.7 23 14 23" stroke="#00d4ff" />
      <path d="M12 8V23" stroke="#00d4ff" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <path d="M21 8V21H3V8" fill="rgba(0,212,255,0.1)" stroke="#00d4ff" />
      <path d="M23 3H1V8H23V3Z" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
      <path d="M10 12H14" stroke="#00d4ff" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <circle cx="18" cy="5" r="3" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
      <circle cx="6" cy="12" r="3" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
      <circle cx="18" cy="19" r="3" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="#00d4ff" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="#00d4ff" />
    </svg>
  ),
};

/* ───────────────── Onboarding ───────────────── */
function Onboarding({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: t('onboarding.welcome'),
      subtitle: t('onboarding.thankYou'),
      body: t('onboarding.intro'),
      icon: OnboardingIcons.welcome,
      badge: t('onboarding.setupComplete'),
    },
    {
      title: t('onboarding.howItWorks'),
      subtitle: t('onboarding.navigationDesc'),
      body: t('onboarding.navigationBody'),
      icon: OnboardingIcons.navigate,
      badge: t('onboarding.navigationBadge'),
    },
    {
      title: "AnimeNetRec V2",
      subtitle: t('onboarding.recEngineTitle'),
      body: t('onboarding.recEngineDesc'),
      icon: OnboardingIcons.brain,
      badge: t('onboarding.recEngineBadge'),
    },
    {
      title: t('onboarding.localWorker'),
      subtitle: t('onboarding.localWorkerTitle'),
      body: t('onboarding.localWorkerDesc'),
      icon: OnboardingIcons.box,
      badge: t('onboarding.localPower'),
    },
    {
      title: t('onboarding.publicBuilds'),
      subtitle: t('onboarding.publicBuildsTitle'),
      body: t('onboarding.publicBuildsDesc'),
      icon: OnboardingIcons.share,
      badge: t('onboarding.sharing'),
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
                  background: "rgba(0,0,0,0.35)",
                  display: "grid",
                  placeItems: "center",
                  padding: 5,
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
                {t('onboarding.stepOf', { step: step + 1, total: steps.length })}
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
              {t('onboarding.close')}
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
                  {t('common.back')}
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
                  {t('common.next')}
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
                  {t('onboarding.letsGo')}
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
  const { t } = useTranslation();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const redirectUri = "http://127.0.0.1:43210/callback";
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const onSave = async () => {
    setErr("");
    if (!clientId.trim() || !clientSecret.trim()) {
      setErr(t('setup.credentialsRequired'));
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
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{t('setup.title')}</div>
              <div style={{ fontSize: 11, color: "rgba(221,235,255,0.55)" }}>{t('setup.subtitle')}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 20, color: "#fff" }}>
          <p style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
            {t('setup.enterCredentials')}
          </p>

          <label style={labelStyle}>{t('setup.clientId')}</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={t('setup.clientIdPlaceholder')}
            style={inputStyle}
          />

          <label style={labelStyle}>{t('setup.clientSecret')}</label>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={t('setup.clientSecretPlaceholder')}
            style={inputStyle}
            type="password"
          />

          <label style={labelStyle}>{t('setup.redirectUri')}</label>
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
              {t('setup.configSaved')}{" "}
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
                {t('setup.reloadApp')}
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
              {t('setup.saveAndContinue')}
            </button>
          )}

          <p style={{ marginTop: 14, fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>
            {t('setup.publicBuildsNote')}
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
  const { t } = useTranslation();
  return (
    <div style={{
      height: "100vh",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(circle at top, #101624 0%, #060912 55%, #060912 100%)",
      color: "#fff"
    }}>
      <div style={{ textAlign: "center", maxWidth: 500, padding: 32 }}>
        <div style={{
          width: 80,
          height: 80,
          margin: "0 auto 24px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)",
          border: "2px solid rgba(0, 212, 255, 0.3)",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 0 40px rgba(0, 212, 255, 0.15)",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={{
          fontSize: 32,
          fontWeight: 900,
          marginBottom: 12,
          background: "linear-gradient(135deg, #fff 0%, #00d4ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text"
        }}>
          {t('login.connectTitle')}
        </h2>

        <p style={{
          opacity: 0.7,
          marginBottom: 32,
          fontSize: 16,
          lineHeight: 1.6
        }}>
          {t('login.connectDescription')}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => window.shokai?.auth?.login?.()}
            style={{
              background: "linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)",
              border: "none",
              borderRadius: 12,
              padding: "14px 28px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 15,
              color: "#000",
              transition: "all 0.2s",
              boxShadow: "0 4px 20px rgba(0, 212, 255, 0.3)",
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {t('login.signIn')}
          </button>
          <button
            onClick={onRetry}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              padding: "14px 20px",
              color: "rgba(255,255,255,0.8)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
          >
            {t('login.checkAgain')}
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
        background: "linear-gradient(135deg, #0a0e27 0%, #000000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{
        fontSize: 42,
        fontWeight: 900,
        background: "linear-gradient(135deg, #00d4ff 0%, #8a2be2 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        marginBottom: 32,
        letterSpacing: -1,
      }}>
        ShokaiShelf
      </div>

      {/* Spinner */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)",
          borderTop: "3px solid #00d4ff",
          marginBottom: 24,
          animation: "spin 0.8s linear infinite",
        }}
      />

      {/* Status */}
      <p style={{ opacity: 0.6, fontSize: 14, fontWeight: 500 }}>{status}</p>

      <style>
        {`@keyframes spin { from {transform: rotate(0deg);} to {transform: rotate(360deg);} }`}
      </style>
    </div>
  );
}

/* ───────────────── App ───────────────── */
export default function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState<PageKey>("home");
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bootStatus, setBootStatus] = useState(t('boot.starting'));
  const [engineReady, setEngineReady] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [scrobblerCandidate, setScrobblerCandidate] = useState<ScrobblerCandidate | null>(null);
  const [miruScrobble, setMiruScrobble] = useState<any>(null);
  const [lastScrobbledUrl, setLastScrobbledUrl] = useState<string | null>(null);
  const [userLibrary, setUserLibrary] = useState<any[]>([]);

  const hasBridge = typeof window !== "undefined" && !!window.shokai;

  // versucht AnimeNetRec V3 vorzuwarmen; wenn Datei nicht da ist: egal
  const preloadEngine = async () => {
    try {
      setBootStatus(t('boot.loadingEngine'));
      try {
        netrecV3.createEngine();
      } catch {
        // Ignorieren: Seiten handlen Fallback selbst
      }
      setEngineReady(true);
    } catch (_e) {
      // Engine nicht vorhanden ??' trotzdem weiter
      setEngineReady(true);
    }
  };

  // Dream V4 migration check
  const checkDreamMigration = async (userName: string) => {
    try {
      setBootStatus(t('boot.checkingProfile'));
      const status = await getMigrationStatus(userName);

      if (status === 'not_started') {
        setMigrating(true);
        setBootStatus(t('boot.migrating'));

        const result = await checkAndMigrate(userName);

        if (result.migrated) {
          console.log("[App] Dream V4 migration successful");
          // Initialize Dream engine
          createDreamEngine();
        } else if (result.profile) {
          console.log("[App] Dream V4 profile already exists");
          createDreamEngine();
        }

        setMigrating(false);
      } else if (status === 'complete') {
        // Profile exists, initialize engine
        createDreamEngine();
      }
    } catch (error) {
      console.warn("[App] Dream migration check failed:", error);
      setMigrating(false);
    }
  };

  const refresh = async () => {
    if (!hasBridge) {
      console.log("No bridge found");
      return;
    }

    console.log("=== REFRESH START ===");

    try {
      setBootStatus(t('boot.checkingConfig'));
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

      setBootStatus(t('boot.connecting'));
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

      setBootStatus(t('boot.loadingProfile'));
      console.log("Loading profile...");

      let currentUserName = status.viewerName || "";
      try {
        const me = await anilistAPI.viewer();
        currentUserName = me?.name || status.viewerName || "";
        setUsername(currentUserName);
        setAvatar(me?.avatar?.large || "");

        // Load library for smart scrobbling
        if (me?.id) {
          const listsData = await anilistAPI.userLists(me.id);
          setUserLibrary(listsData?.lists || []);
        }
      } catch (e) {
        console.log("Profile load failed, using status name:", e);
        setUsername(status.viewerName || "");
      }

      setBootStatus(t('boot.initEngine'));
      await preloadEngine();

      // Check and perform Dream V4 migration
      if (currentUserName) {
        await checkDreamMigration(currentUserName);
      }

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

  // Discord RPC - Page Updates
  useEffect(() => {
    if (!hasBridge || !(window as any).shokai?.discord) return;
    const activities: Record<PageKey, string> = {
      home: 'Discovering new anime',
      feed: 'Touching grass',
      search: 'Hunting for anime',
      library: 'Organizing the collection',
      social: 'Touching grass',
      settings: 'Tweaking the settings',
      echo: 'Reviewing the Echo',
      achievements: 'Checking achievements',
    };
    (window as any).shokai.discord.setActivity({
      title: 'ShokaiShelf',
      state: activities[page],
    });
  }, [page, hasBridge]);

  // Scrobbler detection listener
  useEffect(() => {
    if (!hasBridge || !(window as any).shokai?.scrobbler) return;
    const unsub = (window as any).shokai.scrobbler.onDetection(async (candidate: ScrobblerCandidate) => {
      // Update Discord RPC with anime being watched
      if (candidate.cleanTitle && (window as any).shokai?.discord) {
        const episodeText = candidate.episode ? ` - Episode ${candidate.episode}` : '';
        (window as any).shokai.discord.setActivity({
          title: candidate.cleanTitle,
          state: `Watching${episodeText}`,
          episode: candidate.episode,
        });
        console.log('[App] Discord RPC updated (local):', candidate.cleanTitle);
      }

      // Wenn wir in der Library einen sehr guten Match finden, boosten wir die Confidence
      if (userLibrary.length > 0) {
        const match = findBestMatch(candidate.cleanTitle, userLibrary);
        if (match.media && match.confidence > 0.85) {
          console.log(`[App] Scrobbler Smart Match: ${candidate.cleanTitle} -> ${match.media.title.english}`);

          // Wenn extrem sicher, könnten wir hier auch auto-scrobbeln. 
          // Aber beim lokalen Scrobbler (Dateien) ist ein Toast oft sicherer.
          // Wir setzen aber die Media-Informationen schon mal für den Toast.
          (candidate as any).mediaId = match.media.id;
          candidate.confidence = Math.max(candidate.confidence, match.confidence);
        }
      }

      // Nur benachrichtigen, wenn nicht extrem sicher
      if (candidate.confidence < 0.9) {
        (window as any).shokai?.app?.notify({
          title: t('scrobbler.detected'),
          body: t('scrobbler.detectedRunning', { title: candidate.cleanTitle, app: candidate.app })
        });
      }

      setScrobblerCandidate(candidate);
    });
    return () => unsub?.();
  }, [hasBridge, userLibrary]);

  // Miru scrobble listener
  useEffect(() => {
    if (!hasBridge || !(window as any).shokai?.miru) return;
    const unsub = (window as any).shokai.miru.onScrobble(async (data: any) => {
      // Ignore if it's the same URL we just handled
      if (lastScrobbledUrl === data.url && data.progress === 0) return;

      console.log('[App] Miru scrobble:', data);

      // Update Discord RPC with anime being watched
      if (data.title && (window as any).shokai?.discord) {
        const episodeText = data.episode ? ` - Episode ${data.episode}` : '';
        (window as any).shokai.discord.setActivity({
          title: data.title,
          state: `Watching${episodeText}`,
          episode: data.episode,
        });
        console.log('[App] Discord RPC updated:', data.title);
      }

      // Smart Matcher: Versuche ID aus Library oder Suche zu finden
      let mediaId = data.mediaId;
      let confidence = data.confidence || 0;

      if (!mediaId && userLibrary.length > 0) {
        const match = findBestMatch(data.title, userLibrary);
        if (match.media && match.confidence > 0.85) {
          mediaId = match.media.id;
          confidence = match.confidence;
          console.log(`[App] Smart Match (Library): ${data.title} -> ${match.media.title.english} (${Math.round(confidence * 100)}%)`);
        }
      }

      // Nur bei PLAY events (progress = 0) zeigen wir den Toast
      if (data.progress === 0 && !data.completed) {
        // Wenn wir extrem sicher sind (>92%), überspringen wir den Toast und scrobbeln still
        if (mediaId && confidence > 0.92) {
          console.log('[App] High confidence, skipping toast:', data.title);
          setLastScrobbledUrl(data.url);
          // Wir lernen das Match trotzdem im Scrobbler-Gedächtnis
          (window as any).shokai?.scrobbler?.confirmMatch(data.title, mediaId);
        } else {
          // Ansonsten fragen wir den User
          setMiruScrobble({ ...data, mediaId, confidence });
          setLastScrobbledUrl(data.url);

          // System-Benachrichtigung schicken
          (window as any).shokai?.app?.notify({
            title: t('scrobbler.detected'),
            body: t('scrobbler.pleaseConfirmBody', { title: data.title })
          });
        }
      } else if (data.completed || data.progress >= 75) {
        // Auto-update bei completion (>75% watched)
        try {
          const { saveEntry, searchMedia } = await import("./api/anilist");

          // Letzter Rettungsanker: Wenn wir noch keine ID haben, suchen wir jetzt global
          if (!mediaId) {
            const searchResults = await searchMedia(data.title);
            const match = findBestMatch(data.title, userLibrary, searchResults);
            if (match.media) {
              mediaId = match.media.id;
              confidence = match.confidence;
            }
          }

          if (mediaId) {
            await saveEntry(mediaId, "CURRENT", data.episode);
            console.log('[App] Auto-updated AniList:', mediaId, 'Episode', data.episode);

            // Wenn wir erfolgreich waren, lernen wir das für die Zukunft!
            (window as any).shokai?.scrobbler?.confirmMatch(data.title, mediaId);
          } else {
            // FALLBACK: Kein Match gefunden - User muss manuell bestätigen
            console.log('[App] No match found for 75% event, showing toast:', data.title);
            setMiruScrobble({ ...data, mediaId: null, confidence: 0 });
            setLastScrobbledUrl(data.url);

            // System-Benachrichtigung
            (window as any).shokai?.app?.notify({
              title: t('scrobbler.almostFinished'),
              body: t('scrobbler.almostFinishedBody', { title: data.title })
            });
          }
        } catch (err) {
          console.error('[App] Auto-update failed:', err);
        }
      }
    });
    return () => unsub?.();
  }, [hasBridge, lastScrobbledUrl, userLibrary]);

  // kein preload
  if (!hasBridge) {
    return (
      <SettingsProvider>
        <BootLoader status={t('boot.preloadNotFound')} />
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
      <UpdateBanner />
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar page={page} setPage={setPage} authed={true} username={username} avatar={avatar} hideCharacters />
        <div style={{ flex: 1, overflowY: "auto", background: "#060912" }}>
          <div style={{ padding: page === "home" ? 0 : 20 }}>
            <AnimatePresence mode="popLayout">
              {page === "home" && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Dashboard onNavigate={setPage} />
                </motion.div>
              )}
              {page === "feed" && (
                <motion.div key="feed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Social />
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
              {page === "social" && (
                <motion.div key="social" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Social />
                </motion.div>
              )}
              {page === "settings" && (
                <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Settings onLoggedIn={() => refresh()} />
                </motion.div>
              )}
              {page === "echo" && (
                <motion.div key="echo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Echo />
                </motion.div>
              )}
              {page === "achievements" && (
                <motion.div key="achievements" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Achievements />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      {scrobblerCandidate && (
        <ScrobblerToast
          candidate={scrobblerCandidate}
          onConfirm={(mediaId) => {
            (window as any).shokai?.scrobbler?.confirmMatch(scrobblerCandidate.cleanTitle, mediaId);
            setScrobblerCandidate(null);
          }}
          onDismiss={() => setScrobblerCandidate(null)}
        />
      )}

      {miruScrobble && (
        <ScrobblerToast
          candidate={{
            cleanTitle: miruScrobble.title,
            episode: miruScrobble.episode,
            app: miruScrobble.site,
            confidence: miruScrobble.confidence,
          }}
          onConfirm={async (mediaId) => {
            // Update AniList with episode progress
            try {
              const { saveEntry } = await import("./api/anilist");
              await saveEntry(mediaId, "CURRENT", miruScrobble.episode);
              console.log('[App] Updated AniList:', mediaId, 'Episode', miruScrobble.episode);

              // Teach the scrobbler!
              (window as any).shokai?.scrobbler?.confirmMatch(miruScrobble.title, mediaId);

            } catch (err) {
              console.error('[App] Failed to update AniList:', err);
            }
            setMiruScrobble(null);
          }}
          onDismiss={() => setMiruScrobble(null)}
        />
      )}
    </SettingsProvider>
  );
}
