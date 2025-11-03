import React, { useEffect, useRef, useState } from "react";
import tokens from "@shingen/tokens";
import { logoutAniList } from "@api/anilist";

type PageKey = "home" | "search" | "library" | "settings";

type Props = {
  page: PageKey;
  setPage: (p: PageKey) => void;
  authed: boolean;
  username: string;
  avatar: string;
};

const RAIL_W = 72;       // so schmal wie praktikabel
const ICO = 26;          // Icon-Größe
const AVATAR = 52;       // größerer Avatar

export default function Sidebar({ page, setPage, authed, username, avatar }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Menü außerhalb schließen
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (!ref.current) return;
      if (!ref.current.contains(el)) setMenuOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <aside
      ref={ref}
      style={{
        width: RAIL_W,
        background: "#0b1118",
        borderRight: `1px solid ${tokens.colors.glassBorder}`,
        padding: 8,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        alignItems: "start",
        justifyItems: "center",
        gap: 6,
      }}
    >
      {/* Avatar – ohne Box, nur Klickfläche */}
      <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center", marginTop: 2 }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title={authed ? (username || "Profil") : "Nicht angemeldet"}
          aria-label="Profilmenü"
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid rgba(255,255,255,.18)`,
            padding: 0,
            cursor: "pointer",
            background: "transparent",
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
              background: "#0f1722",
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,.35)",
              padding: 6,
              display: "grid",
              gap: 4,
              minWidth: 160,
              zIndex: 1000,
            }}
          >
            <div style={{ padding: "6px 8px", color: "#dbe4ff", opacity: .8, fontSize: 12 }}>
              {authed ? (username || "Profil") : "Nicht angemeldet"}
            </div>
            <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,.08)", margin: "4px 0" }} />
            <button
              onClick={() => { setMenuOpen(false); setPage("settings"); }}
              style={menuBtn}
            >
              Einstellungen
            </button>
            <button
              onClick={async () => { setMenuOpen(false); await logoutAniList(); window.location.assign("/"); }}
              style={{ ...menuBtn, color: "#ffb3b3" }}
            >
              Abmelden
            </button>
          </div>
        )}
      </div>

      {/* NAV – nur Icons, weiß, minimal; KEIN „Einstellungen“-Eintrag */}
      <nav style={{ display: "grid", gap: 8, justifyItems: "center", marginTop: 8 }}>
        <RailBtn
          active={page === "home"}
          label="Startseite"
          onClick={() => setPage("home")}
        >
          <HomeIcon />
        </RailBtn>
        <RailBtn
          active={page === "search"}
          label="Suche"
          onClick={() => setPage("search")}
        >
          <SearchIcon />
        </RailBtn>
        <RailBtn
          active={page === "library"}
          label="Bibliothek"
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
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        background: active ? "rgba(255,255,255,.08)" : "transparent",
        border: `1px solid ${active ? "rgba(255,255,255,.16)" : "transparent"}`,
        cursor: "pointer",
      }}
    >
      <div style={{ width: ICO, height: ICO, color: "#fff" }}>{children}</div>
    </button>
  );
}

const menuBtn: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  color: "#dbe4ff",
  border: "1px solid transparent",
  borderRadius: 8,
  padding: "8px 10px",
  textAlign: "left",
  cursor: "pointer",
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5v8a2 2 0 0 1-2 2h-4.5a.5.5 0 0 1-.5-.5V15a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v5.5a.5.5 0 0 1-.5.5H5a2 2 0 0 1-2-2v-8z"/>
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

// HIER IST DAS NEUE ICON
function CharacterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  );
}