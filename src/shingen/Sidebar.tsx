import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import tokens from "@shingen/tokens";
import { logoutAniList } from "@api/anilist";

type PageKey = "home" | "feed" | "search" | "library" | "settings" | "echo";

type Props = {
  page: PageKey;
  setPage: (p: PageKey) => void;
  authed: boolean;
  username: string;
  avatar: string;
  hideCharacters?: boolean;
};

const RAIL_W = 72;       // so schmal wie praktikabel
const ICO = 26;          // Icon-Größe
const AVATAR = 52;       // größerer Avatar
const ACCENT = "#00d4ff";

export default function Sidebar({ page, setPage, authed, username, avatar }: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const justOpenedRef = useRef(false);

  // Menü schließen bei Page-Wechsel
  useEffect(() => {
    setMenuOpen(false);
  }, [page]);

  // Menü außerhalb schließen
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = e.target as HTMLElement;

      // Skip if we just opened the menu
      if (justOpenedRef.current) {
        justOpenedRef.current = false;
        return;
      }

      if (!ref.current) return;

      // Don't close if clicking on the avatar button
      if (buttonRef.current && buttonRef.current.contains(el)) {
        return;
      }

      // Close if clicking outside the menu
      if (!ref.current.contains(el)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <aside
      ref={ref}
      style={{
        width: RAIL_W,
        background: "linear-gradient(180deg, rgba(11,17,24,0.98) 0%, rgba(8,12,18,0.99) 100%)",
        borderRight: `1px solid ${tokens.colors.glassBorder}`,
        backdropFilter: "blur(20px)",
        padding: 8,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        alignItems: "start",
        justifyItems: "center",
        gap: 6,
        boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
        zIndex: 100,
        position: "relative",
      }}
    >
      {/* Avatar – ohne Box, nur Klickfläche */}
      <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center", marginTop: 2 }}>
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => {
              const newValue = !v;
              if (newValue) {
                // Mark that we just opened the menu
                justOpenedRef.current = true;
              }
              return newValue;
            });
          }}
          title={authed ? (username || t('nav.profile')) : t('nav.notLoggedIn')}
          aria-label={t('nav.profileMenu')}
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid rgba(0,212,255,0.3)`,
            padding: 0,
            cursor: "pointer",
            background: "transparent",
            transition: "all 0.2s ease",
            boxShadow: menuOpen ? `0 0 16px ${ACCENT}40` : "0 4px 12px rgba(0,0,0,0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.borderColor = "rgba(0,212,255,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)";
          }}
        >
          {avatar ? (
            <img src={avatar} alt={username || "user"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,.10)" }} />
          )}
        </button>

        {/* Dropdown – klappt nach rechts auf */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              left: RAIL_W - 8,           // rechts neben der Rail
              top: 0,
              background: "linear-gradient(135deg, #0f1722 0%, #0a1018 100%)",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 14,
              boxShadow: "0 12px 40px rgba(0,0,0,.5), 0 0 20px rgba(0,212,255,0.08)",
              backdropFilter: "blur(16px)",
              padding: 8,
              display: "grid",
              gap: 4,
              minWidth: 170,
              zIndex: 9999,
            }}
          >
            <div style={{ padding: "8px 12px", color: "#00d4ff", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: authed ? "#00ff88" : "#ff6b6b", boxShadow: authed ? "0 0 8px #00ff88" : "0 0 8px #ff6b6b" }} />
              {authed ? (username || t('nav.profile')) : t('nav.notLoggedIn')}
            </div>
            <hr style={{ border: 0, borderTop: "1px solid rgba(0,212,255,0.1)", margin: "4px 8px" }} />
            <MenuBtn onClick={() => { setMenuOpen(false); setPage("echo"); }} icon={<EchoIcon />}>
              Echo
            </MenuBtn>
            <MenuBtn onClick={() => { setMenuOpen(false); setPage("achievements" as any); }} icon={<AchievementIcon />}>
              {t('nav.achievements')}
            </MenuBtn>
            <MenuBtn onClick={() => { setMenuOpen(false); setPage("settings"); }} icon={<SettingsIcon />}>
              {t('nav.settings')}
            </MenuBtn>
            <hr style={{ border: 0, borderTop: "1px solid rgba(0,212,255,0.1)", margin: "4px 8px" }} />
            <MenuBtn onClick={async () => { setMenuOpen(false); await logoutAniList(); window.location.assign("/"); }} danger>
              {t('nav.logout')}
            </MenuBtn>
          </div>
        )}
      </div>

      {/* NAV – nur Icons, weiß, minimal; KEIN „Einstellungen“-Eintrag */}
      <nav style={{ display: "grid", gap: 8, justifyItems: "center", marginTop: 8 }}>
        <RailBtn
          active={page === "home"}
          label={t('nav.home')}
          onClick={() => setPage("home")}
        >
          <HomeIcon />
        </RailBtn>
        <RailBtn
          active={page === "feed"}
          label="Feed"
          onClick={() => setPage("feed")}
        >
          <SocialIcon />
        </RailBtn>
        <RailBtn
          active={page === "search"}
          label={t('nav.search')}
          onClick={() => setPage("search")}
        >
          <SearchIcon />
        </RailBtn>
        <RailBtn
          active={page === "library"}
          label={t('nav.library')}
          onClick={() => setPage("library")}
        >
          <LibraryIcon />
        </RailBtn>
      </nav>
    </aside>
  );
}

function RailBtn({ active, label, onClick, children }: {
  active?: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        position: "relative",
        background: active
          ? "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.08) 100%)"
          : hovered
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        border: `1px solid ${active ? "rgba(0,212,255,0.35)" : hovered ? "rgba(255,255,255,0.1)" : "transparent"}`,
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: hovered && !active ? "scale(1.05)" : "scale(1)",
        boxShadow: active ? "0 4px 20px rgba(0,212,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
      }}
    >
      {/* Active indicator bar */}
      {active && (
        <div
          style={{
            position: "absolute",
            left: -8,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 24,
            borderRadius: 4,
            background: "linear-gradient(180deg, #00d4ff 0%, #0099cc 100%)",
            boxShadow: "0 0 12px rgba(0,212,255,0.6)",
          }}
        />
      )}
      <div style={{
        width: ICO,
        height: ICO,
        color: active ? "#00d4ff" : hovered ? "#fff" : "rgba(255,255,255,0.75)",
        transition: "all 0.2s ease",
        filter: active ? "drop-shadow(0 0 6px rgba(0,212,255,0.5))" : "none",
      }}>
        {children}
      </div>
    </button>
  );
}

function MenuBtn({ onClick, icon, children, danger }: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        background: hovered
          ? danger ? "rgba(255,107,107,0.12)" : "rgba(0,212,255,0.1)"
          : "transparent",
        color: danger ? "#ff8888" : "#dbe4ff",
        border: `1px solid ${hovered ? (danger ? "rgba(255,107,107,0.25)" : "rgba(0,212,255,0.2)") : "transparent"}`,
        borderRadius: 10,
        padding: "10px 12px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.15s ease",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {icon && (
        <span style={{ width: 16, height: 16, opacity: hovered ? 1 : 0.7, transition: "opacity 0.15s" }}>
          {icon}
        </span>
      )}
      {!icon && danger && (
        <span style={{ width: 16, height: 16, opacity: hovered ? 1 : 0.7, transition: "opacity 0.15s" }}>
          <LogoutIcon />
        </span>
      )}
      {children}
    </button>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5v8a2 2 0 0 1-2 2h-4.5a.5.5 0 0 1-.5-.5V15a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v5.5a.5.5 0 0 1-.5.5H5a2 2 0 0 1-2-2v-8z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2z" />
      <path d="M10 21V3h4a2 2 0 0 1 2 2v16h-6z" />
      <path d="M20 21V7h-2" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <circle cx="17" cy="11" r="3" />
      <path d="M21 21v-2a3 3 0 00-3-3h-1" />
    </svg>
  );
}

function EchoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5a7 7 0 0 1 7 7" />
      <path d="M12 5a7 7 0 0 0-7 7" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <path d="M12 2a10 10 0 0 0-10 10" />
      <path d="M12 19v3" />
    </svg>
  );
}

function AchievementIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
