import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export interface VibeDef {
  id: string;
  name: string;
  emoji: string;
  genres: string[];
  tags: string[];
  color: string;
  description: string;
}



interface MoodBubblesProps {
  onSelect: (vibe: VibeDef) => void;
  compact?: boolean;
}

export default function MoodBubbles({ onSelect, compact = false }: MoodBubblesProps) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const VIBES: VibeDef[] = [
    {
      id: "cry",
      name: t("moods.vibes.cry.name"),
      emoji: "😭",
      genres: ["Drama"],
      tags: ["Tragedy", "Emotional", "Tearjerker"],
      color: "#3b82f6",
      description: t("moods.vibes.cry.desc")
    },
    {
      id: "hype",
      name: t("moods.vibes.hype.name"),
      emoji: "😤",
      genres: ["Action", "Sports"],
      tags: ["Battle", "Tournament", "Superpowers"],
      color: "#ef4444",
      description: t("moods.vibes.hype.desc")
    },
    {
      id: "mindfuck",
      name: t("moods.vibes.mindfuck.name"),
      emoji: "🧠",
      genres: ["Psychological", "Mystery", "Thriller"],
      tags: ["Plot Twist", "Time Manipulation", "Conspiracy"],
      color: "#a855f7",
      description: t("moods.vibes.mindfuck.desc")
    },
    {
      id: "wholesome",
      name: t("moods.vibes.wholesome.name"),
      emoji: "🥰",
      genres: ["Slice of Life", "Romance"],
      tags: ["Cute Girls Doing Cute Things", "Feel-Good", "Heartwarming"],
      color: "#ec4899",
      description: t("moods.vibes.wholesome.desc")
    },
    {
      id: "chill",
      name: t("moods.vibes.chill.name"),
      emoji: "☕",
      genres: ["Slice of Life"],
      tags: ["Iyashikei", "Relaxing", "Calm"],
      color: "#10b981",
      description: t("moods.vibes.chill.desc")
    },
    {
      id: "dark",
      name: t("moods.vibes.dark.name"),
      emoji: "🌑",
      genres: ["Horror", "Supernatural"],
      tags: ["Gore", "Demons", "Dark Fantasy"],
      color: "#64748b",
      description: t("moods.vibes.dark.desc")
    },
    {
      id: "adventure",
      name: t("moods.vibes.adventure.name"),
      emoji: "🗺️",
      genres: ["Adventure", "Fantasy"],
      tags: ["Exploration", "Journey", "Magic"],
      color: "#f59e0b",
      description: t("moods.vibes.adventure.desc")
    },
    {
      id: "funny",
      name: t("moods.vibes.funny.name"),
      emoji: "🤣",
      genres: ["Comedy"],
      tags: ["Parody", "Slapstick", "Gag Humor"],
      color: "#22c55e",
      description: t("moods.vibes.funny.desc")
    },
  ];

  if (compact) {
    return (
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        justifyContent: "center",
      }}>
        {VIBES.map((vibe, i) => (
          <motion.button
            key={vibe.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(vibe)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: `${vibe.color}15`,
              border: `1px solid ${vibe.color}40`,
              borderRadius: "99px",
              cursor: "pointer",
              color: "white",
              outline: "none",
            }}
          >
            <span style={{ fontSize: "16px" }}>{vibe.emoji}</span>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{vibe.name}</span>
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      textAlign: "center",
      padding: "60px 20px",
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 style={{
          fontSize: "36px",
          marginBottom: "12px",
          color: "white",
          fontWeight: 800,
        }}>
          {t("moods.title")}
        </h2>
        <p style={{
          opacity: 0.5,
          marginBottom: "48px",
          fontSize: "16px",
          color: "white",
        }}>
          {t("moods.subtitle")}
        </p>
      </motion.div>

      {/* Bubbles Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "20px",
        maxWidth: "800px",
        margin: "0 auto",
      }}>
        {VIBES.map((vibe, i) => (
          <motion.button
            key={vibe.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 400, damping: 20 }}
            whileHover={{ scale: 1.08, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(vibe)}
            onHoverStart={() => setHoveredId(vibe.id)}
            onHoverEnd={() => setHoveredId(null)}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              aspectRatio: "1",
              background: `linear-gradient(145deg, ${vibe.color}25 0%, ${vibe.color}10 100%)`,
              border: `2px solid ${hoveredId === vibe.id ? vibe.color : `${vibe.color}40`}`,
              borderRadius: "50%",
              cursor: "pointer",
              color: "white",
              outline: "none",
              boxShadow: hoveredId === vibe.id
                ? `0 12px 40px ${vibe.color}40, 0 0 0 4px ${vibe.color}20`
                : `0 8px 24px ${vibe.color}20`,
              transition: "border-color 0.2s, box-shadow 0.2s",
              overflow: "hidden",
            }}
          >
            {/* Glow effect */}
            <AnimatePresence>
              {hoveredId === vibe.id && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at center, ${vibe.color}30 0%, transparent 70%)`,
                    pointerEvents: "none",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Emoji */}
            <motion.span
              animate={{ scale: hoveredId === vibe.id ? 1.2 : 1 }}
              style={{ fontSize: "44px", marginBottom: "6px", position: "relative", zIndex: 1 }}
            >
              {vibe.emoji}
            </motion.span>

            {/* Name */}
            <span style={{
              fontSize: "15px",
              fontWeight: 700,
              position: "relative",
              zIndex: 1,
            }}>
              {vibe.name}
            </span>

            {/* Description on hover */}
            <AnimatePresence>
              {hoveredId === vibe.id && (
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  style={{
                    fontSize: "11px",
                    opacity: 0.7,
                    marginTop: "4px",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {vibe.description}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
