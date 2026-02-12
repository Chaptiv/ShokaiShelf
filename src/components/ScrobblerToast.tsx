// src/components/ScrobblerToast.tsx
// Toast-Notification für Scrobbler-Erkennungen

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { searchAnime, type Media, type ScrobblerCandidate } from "@api/anilist";
import tokens from "@shingen/tokens";
import { MdClose, MdCheck } from "react-icons/md";
import { useTranslation } from "react-i18next";

interface Props {
  candidate: ScrobblerCandidate;
  onConfirm: (mediaId: number) => void;
  onDismiss: () => void;
}

export default function ScrobblerToast({ candidate, onConfirm, onDismiss }: Props) {
  const { t } = useTranslation();
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    // Suche nach dem Anime basierend auf dem erkannten Titel
    setLoading(true);
    searchAnime(candidate.cleanTitle, 5)
      .then(setResults)
      .catch(err => {
        console.error('[ScrobblerToast] Search failed:', err);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [candidate.cleanTitle]);

  const handleConfirm = (mediaId: number) => {
    setSelectedId(mediaId);
    // Kurze Animation bevor wir schließen
    setTimeout(() => {
      onConfirm(mediaId);
    }, 300);
  };

  const formatLabel = (format?: string | null) =>
    format ? t(`media.format.${format}`, { defaultValue: format }) : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: 0 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 50, x: 0 }}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 420,
        maxWidth: "calc(100vw - 48px)",
        background: tokens.colors.glass,
        backdropFilter: "blur(20px)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: tokens.colors.accent }}>
            {t("scrobblerToast.detected")}
          </h3>
          <p style={{ margin: "6px 0 0 0", fontSize: 14, opacity: 0.7 }}>
            {candidate.cleanTitle}
            {candidate.episode && ` - ${t("media.episode")} ${candidate.episode}`}
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.5 }}>
            {t("scrobblerToast.viaApp", { app: candidate.app })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{
            padding: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.6)",
            borderRadius: 8,
          }}
          title={t("common.dismiss")}
        >
          <MdClose size={20} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 24, opacity: 0.6 }}>
          <div style={{
            width: 24,
            height: 24,
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: tokens.colors.accent,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 12px"
          }} />
          {t("scrobblerToast.searching")}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, opacity: 0.6 }}>
          {t("scrobblerToast.noMatches")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
          <p style={{ margin: "0 0 8px 0", fontSize: 13, opacity: 0.6 }}>
            {t("scrobblerToast.whichAnime")}
          </p>
          {results.map(anime => (
            <motion.button
              key={anime.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleConfirm(anime.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                background: selectedId === anime.id
                  ? "rgba(0, 212, 255, 0.2)"
                  : "rgba(255,255,255,0.05)",
                border: selectedId === anime.id
                  ? "1px solid rgba(0, 212, 255, 0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
            >
              {anime.coverImage?.large ? (
                <img
                  src={anime.coverImage.large}
                  alt=""
                  style={{ width: 48, height: 64, objectFit: "cover", borderRadius: 6 }}
                />
              ) : (
                <div style={{ width: 48, height: 64, background: "rgba(255,255,255,0.1)", borderRadius: 6 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {anime.title?.english || anime.title?.romaji || t("common.unknown")}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  {formatLabel(anime.format)} • {anime.episodes ? t("media.episodesCount", { count: anime.episodes }) : t("media.episodesUnknown")}
                </div>
              </div>
              {selectedId === anime.id && (
                <MdCheck size={24} style={{ color: tokens.colors.accent, flexShrink: 0 }} />
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={onDismiss}
          style={{
            width: "100%",
            padding: 12,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            cursor: "pointer",
            color: "rgba(255,255,255,0.7)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t("common.dismiss")}
        </button>
      </div>
    </motion.div>
  );
}
