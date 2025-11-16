// src/state/SettingsContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type TitleLang = "EN" | "JP" | "DE";

type Settings = {
  titleLang: TitleLang;
  setTitleLang: (v: TitleLang) => void;
};

const SettingsCtx = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [titleLang, setTitleLangState] = useState<TitleLang>("EN");

  useEffect(() => {
    const saved = localStorage.getItem("shokai.settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.titleLang) setTitleLangState(parsed.titleLang as TitleLang);
      } catch {}
    }
  }, []);

  const setTitleLang = (v: TitleLang) => {
    setTitleLangState(v);
    const prev = localStorage.getItem("shokai.settings");
    let obj: any = {};
    try { obj = prev ? JSON.parse(prev) : {}; } catch {}
    obj.titleLang = v;
    localStorage.setItem("shokai.settings", JSON.stringify(obj));
  };

  const value = useMemo(() => ({ titleLang, setTitleLang }), [titleLang]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

// Titel-Auswahl nach Sprache
export type TitleObj = { romaji?: string; english?: string; native?: string; german?: string };
export function selectTitle(t: TitleObj | undefined, lang: TitleLang): string {
  if (!t) return "Untitled";
  if (lang === "EN") return t.english || t.romaji || t.native || t.german || "Untitled";
  if (lang === "JP") return t.romaji || t.native || t.english || t.german || "Untitled";
  return t.german || t.english || t.romaji || t.native || "Untitled"; // DE
}
