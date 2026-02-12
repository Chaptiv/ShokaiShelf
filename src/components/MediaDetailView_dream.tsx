/**
 * MediaDetailView Dream - Modern Detail View
 *
 * Features:
 * - Full-screen overlay with blur backdrop
 * - Split layout with cover and content
 * - Glassmorphism design consistent with Dream style
 * - Smooth animations
 * - V3 AI Recommendation display
 */

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { saveEntry, deleteEntry, type Media } from "../api/anilist";
import {
  MdClose, MdSave, MdCheckCircle, MdDelete, MdStar, MdPlayArrow,
  MdBookmark, MdPause, MdCheck, MdSmartToy, MdExpandMore
} from "react-icons/md";
import {
  PlayIcon, CheckIcon, PauseIcon, XIcon, ClipboardIcon,
  StarIcon, FireIcon, TvIcon, CalendarIcon
} from "./icons/StatusIcons";

type ScoreFormat = "POINT_100" | "POINT_10" | "POINT_10_DECIMAL" | "POINT_5" | "POINT_3" | string;

interface V3Metadata {
  v3Reasons?: string[];
  v3Confidence?: number;
  v3Score?: number;
  v3Sources?: string[];
}

interface MediaDetailViewProps {
  media: Media & V3Metadata;
  title: string;
  scoreFormat?: ScoreFormat;
  onClose: () => void;
  onSaved?: () => void;
}

// Status Options - converted to function for i18n
function getStatusOptions(t: (key: string) => string) {
  return [
    { value: "CURRENT", label: t('media.listStatus.current'), icon: <PlayIcon />, color: "#22c55e" },
    { value: "PLANNING", label: t('media.listStatus.planning'), icon: <ClipboardIcon />, color: "#3b82f6" },
    { value: "COMPLETED", label: t('media.listStatus.completed'), icon: <CheckIcon />, color: "#a855f7" },
    { value: "PAUSED", label: t('media.listStatus.paused'), icon: <PauseIcon />, color: "#f59e0b" },
    { value: "DROPPED", label: t('media.listStatus.dropped'), icon: <XIcon />, color: "#ef4444" },
  ];
}

export default function MediaDetailView_dream({
  media,
  title,
  scoreFormat,
  onClose,
  onSaved,
}: MediaDetailViewProps) {
  const { t } = useTranslation();
  const STATUS_OPTIONS = useMemo(() => getStatusOptions(t), [t]);
  const [progress, setProgress] = useState(media.mediaListEntry?.progress || 0);
  const [status, setStatus] = useState<string>(media.mediaListEntry?.status || "");
  const [score, setScore] = useState<number>(
    typeof media.mediaListEntry?.score === "number" ? media.mediaListEntry.score : 0
  );
  const [saved, setSaved] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  const max = media.episodes || 12;
  const bounds = getScoreBounds(scoreFormat);
  const clampScore = (v: number) => Math.max(bounds.min, Math.min(bounds.max, roundToStep(v, bounds.step)));

  const cover = media.coverImage?.extraLarge || media.coverImage?.large;
  const banner = media.bannerImage;
  const desc = sanitizeHtml((media as any).description);
  const avgScore = (media as any).averageScore;
  const popularity = (media as any).popularity;
  const genres = ((media as any).genres as string[]) || [];
  const tags = (((media as any).tags || []) as { name: string; rank?: number }[]).slice(0, 12);
  const studios = ((media as any).studios?.nodes || []) as { name: string }[];
  const format = (media as any).format;
  const seasonYear = (media as any).seasonYear;
  const season = (media as any).season;

  // V3 Metadata
  const hasV3Data = media.v3Reasons && media.v3Reasons.length > 0;
  const confidence = media.v3Confidence || 0;
  const reasons = media.v3Reasons || [];

  // Check if on list
  const isOnList = !!media.mediaListEntry?.status;

  async function handleSave() {
    try {
      if (!status) {
        return;
      }
      await saveEntry(media.id, status, progress, score || undefined);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSaved?.();
      }, 1500);
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }

  async function handleRemove() {
    if (!confirm(t('media.removeConfirm'))) return;
    try {
      if (media.mediaListEntry?.id) {
        await deleteEntry(media.mediaListEntry.id);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      console.error("Failed to remove:", e);
    }
  }

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Discord RPC
  useEffect(() => {
    const titleText = media.title?.english || media.title?.romaji || 'Anime';
    (window as any).shokai?.discord?.setActivity({
      title: 'ShokaiShelf',
      state: `Inspecting "${titleText}"`,
    });
  }, [media]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(12px)",
          zIndex: 999,
        }}
      />

      {/* Main Modal */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          position: "fixed",
          top: "3vh",
          left: "3vw",
          right: "3vw",
          bottom: "3vh",
          background: "#0f172a",
          borderRadius: 24,
          overflow: "hidden",
          zIndex: 1000,
          boxShadow: "0 40px 100px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          display: "grid",
          gridTemplateColumns: "min(380px, 35vw) 1fr",
        }}
      >
        {/* ========== LEFT SIDE: COVER & ACTIONS ========== */}
        <div style={{
          position: "relative",
          background: "linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%)",
          display: "flex",
          flexDirection: "column",
          padding: 28,
          borderRight: "1px solid rgba(255, 255, 255, 0.06)",
          overflowY: "auto",
          overflowX: "hidden",
        }}>
          {/* Background blur from cover */}
          {cover && (
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${cover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(40px) brightness(0.3)",
              transform: "scale(1.2)",
            }} />
          )}

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Cover Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                width: "100%",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
                marginBottom: 20,
                position: "relative",
                maxHeight: "min(55vh, 480px)",
              }}
            >
              {cover ? (
                <img
                  src={cover}
                  alt={title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                  display: "grid",
                  placeItems: "center",
                }}>
                  <MdPlayArrow size={64} color="rgba(255,255,255,0.3)" />
                </div>
              )}

              {/* Format Badge */}
              <div style={{
                position: "absolute",
                top: 12,
                left: 12,
                padding: "6px 14px",
                background: "rgba(0, 0, 0, 0.8)",
                backdropFilter: "blur(8px)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}>
                {formatFormat(format)}
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <StatCard
                label={t('mediaDetail.score')}
                value={avgScore ? `${(avgScore / 10).toFixed(1)}` : "N/A"}
                icon={<StarIcon />}
                color="#fbbf24"
              />
              <StatCard
                label={t('mediaDetail.popularity')}
                value={popularity ? formatPopularity(popularity) : "N/A"}
                icon={<FireIcon />}
                color="#f97316"
              />
              <StatCard
                label={t('media.episodes')}
                value={media.episodes?.toString() || "?"}
                icon={<TvIcon />}
                color="#00d4ff"
              />
              <StatCard
                label={t('media.year')}
                value={seasonYear?.toString() || t('common.notAvailable')}
                icon={<CalendarIcon />}
                color="#22c55e"
              />
            </motion.div>

            {/* Genres */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {genres.slice(0, 4).map((g, i) => (
                <span
                  key={i}
                  style={{
                    padding: "5px 12px",
                    background: "rgba(0, 212, 255, 0.12)",
                    border: "1px solid rgba(0, 212, 255, 0.25)",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#00d4ff",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={!status}
                style={{
                  padding: "14px 20px",
                  background: saved
                    ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                    : status
                      ? "linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)"
                      : "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: 14,
                  color: status ? "#000" : "rgba(255, 255, 255, 0.5)",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: status ? "pointer" : "not-allowed",
                  boxShadow: status ? "0 8px 24px rgba(0, 212, 255, 0.3)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {saved ? <MdCheckCircle size={20} /> : <MdSave size={20} />}
                {saved ? t('common.saved') : t('common.save')}
              </motion.button>

              {isOnList && (
                <motion.button
                  whileHover={{ scale: 1.02, background: "rgba(239, 68, 68, 0.2)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRemove}
                  style={{
                    padding: "12px 24px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 12,
                    color: "#ef4444",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <MdDelete size={18} />
                  {t('media.removeFromList')}
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* ========== RIGHT SIDE: CONTENT ========== */}
        <div style={{
          overflowY: "auto",
          padding: "32px 40px",
          position: "relative",
        }}>
          {/* Close Button */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              zIndex: 10,
            }}
          >
            <MdClose size={24} />
          </motion.button>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 900,
              marginBottom: 24,
              paddingRight: 80,
              lineHeight: 1.15,
              background: "linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {title}
          </motion.h1>

          {/* V3 AI Recommendation */}
          {hasV3Data && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                marginBottom: 32,
                padding: 24,
                background: "linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)",
                border: "1px solid rgba(0, 212, 255, 0.2)",
                borderRadius: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 8px 24px rgba(0, 212, 255, 0.3)",
                }}>
                  <MdSmartToy size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t('media.aiRecommendation')}</h3>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>NetRec V3 Engine</div>
                </div>
                <div style={{
                  padding: "12px 20px",
                  background: confidence >= 70
                    ? "rgba(34, 197, 94, 0.15)"
                    : confidence >= 50
                      ? "rgba(59, 130, 246, 0.15)"
                      : "rgba(251, 191, 36, 0.15)",
                  border: `2px solid ${confidence >= 70 ? "#22c55e" : confidence >= 50 ? "#3b82f6" : "#fbbf24"
                    }`,
                  borderRadius: 12,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{confidence}%</div>
                  <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Match</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {reasons.map((reason, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: "rgba(255, 255, 255, 0.04)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 14, lineHeight: 1.4 }}>{reason}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Description */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ marginBottom: 32 }}
          >
            <button
              onClick={() => setShowDescription(!showDescription)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                color: "white",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 12,
                padding: 0,
              }}
            >
              {t('media.description')}
              <motion.span
                animate={{ rotate: showDescription ? 180 : 0 }}
              >
                <MdExpandMore size={24} />
              </motion.span>
            </button>
            <AnimatePresence>
              {showDescription && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    fontSize: 15,
                    lineHeight: 1.7,
                    opacity: 0.8,
                    overflow: "hidden",
                  }}
                  dangerouslySetInnerHTML={{ __html: desc }}
                />
              )}
            </AnimatePresence>
            {!showDescription && (
              <div
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  opacity: 0.7,
                  overflow: "hidden",
                  maxHeight: "4.5em",
                  textOverflow: "ellipsis",
                }}
                dangerouslySetInnerHTML={{ __html: desc }}
              />
            )}
          </motion.div>

          {/* Tracking Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            style={{
              padding: 24,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 16,
              marginBottom: 32,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{t('mediaDetail.tracking')}</h3>

            {/* Status Selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 10, fontSize: 13, opacity: 0.6 }}>{t('mediaDetail.status')}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STATUS_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStatus(opt.value)}
                    style={{
                      padding: "10px 16px",
                      background: status === opt.value ? `${opt.color}20` : "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${status === opt.value ? opt.color : "rgba(255, 255, 255, 0.1)"}`,
                      borderRadius: 10,
                      color: status === opt.value ? opt.color : "white",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <label style={{ fontSize: 13, opacity: 0.6 }}>{t('media.progress')}</label>
                <span style={{ fontWeight: 700 }}>{progress} / {max}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setProgress(Math.max(0, progress - 1))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 20,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  −
                </motion.button>
                <div style={{ flex: 1, height: 8, background: "rgba(255, 255, 255, 0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (progress / max) * 100)}%` }}
                    style={{
                      height: "100%",
                      background: "linear-gradient(90deg, #00d4ff 0%, #a855f7 100%)",
                      borderRadius: 4,
                    }}
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setProgress(Math.min(max, progress + 1))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 20,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  +
                </motion.button>
              </div>
            </div>

            {/* Score */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <label style={{ fontSize: 13, opacity: 0.6 }}>{t('media.rating')}</label>
                <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  {score > 0 ? (
                    <><MdStar size={16} color="#fbbf24" /> {score}</>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setScore(clampScore(score - bounds.step))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 20,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  −
                </motion.button>
                <div style={{ flex: 1, display: "flex", gap: 4 }}>
                  {Array.from({ length: bounds.max }, (_, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setScore(i + 1)}
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 6,
                        background: score > i ? "#fbbf24" : "rgba(255, 255, 255, 0.08)",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                    />
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setScore(clampScore(score + bounds.step))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 20,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  +
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Studios */}
          {studios.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ marginBottom: 24 }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, opacity: 0.8 }}>{t('mediaDetail.studio')}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {studios.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "8px 14px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, opacity: 0.8 }}>{t('mediaDetail.tags')}</h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tags.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 8,
                      fontSize: 12,
                      opacity: 0.8,
                    }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// Helper Components
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      padding: 14,
      background: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: 12,
    }}>
      <div style={{ marginBottom: 4, fontSize: 18, display: "flex", alignItems: "center" }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// Helper Functions
function sanitizeHtml(input?: string) {
  if (!input) return "Keine Beschreibung verfügbar.";
  const allowed = new Set(["B", "STRONG", "I", "EM", "BR", "P"]);
  const doc = new DOMParser().parseFromString(String(input), "text/html");
  function walk(n: Node): string {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent || "";
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (!allowed.has(tag)) return Array.from(el.childNodes).map(walk).join("");
      if (tag === "BR") return "<br />";
      return Array.from(el.childNodes).map(walk).join("");
    }
    return "";
  }
  return Array.from(doc.body.childNodes).map(walk).join("") || "Keine Beschreibung verfügbar.";
}

function getScoreBounds(format?: ScoreFormat): { min: number; max: number; step: number } {
  if (!format) return { min: 0, max: 10, step: 1 };
  if (format === "POINT_100") return { min: 0, max: 100, step: 1 };
  if (format === "POINT_10") return { min: 0, max: 10, step: 1 };
  if (format === "POINT_10_DECIMAL") return { min: 0, max: 10, step: 0.5 };
  if (format === "POINT_5") return { min: 0, max: 5, step: 1 };
  if (format === "POINT_3") return { min: 0, max: 3, step: 1 };
  return { min: 0, max: 10, step: 1 };
}

function roundToStep(val: number, step: number): number {
  return Math.round(val / step) * step;
}

function formatFormat(format: string): string {
  const map: Record<string, string> = {
    TV: "TV Serie",
    TV_SHORT: "TV Short",
    MOVIE: "Film",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Musik",
  };
  return map[format] || format || "Anime";
}

function formatPopularity(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(0)}k`;
  return `${pop}`;
}
