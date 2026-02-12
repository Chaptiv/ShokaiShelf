/**
 * InsightCard - Text-only Cards for Feed Insights
 *
 * Displays stats, suggestions, and achievements interspersed in feed
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface InsightCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "stats" | "suggestion" | "achievement";
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Category-based styling
const CATEGORY_STYLES = {
  stats: {
    gradient: "linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)",
    border: "rgba(0, 212, 255, 0.25)",
    accent: "#00d4ff",
    iconBg: "rgba(0, 212, 255, 0.15)",
  },
  suggestion: {
    gradient: "linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)",
    border: "rgba(168, 85, 247, 0.25)",
    accent: "#a855f7",
    iconBg: "rgba(168, 85, 247, 0.15)",
  },
  achievement: {
    gradient: "linear-gradient(135deg, rgba(250, 204, 21, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%)",
    border: "rgba(250, 204, 21, 0.25)",
    accent: "#facc15",
    iconBg: "rgba(250, 204, 21, 0.15)",
  },
};

export default function InsightCard({
  title,
  description,
  icon,
  category,
  action
}: InsightCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const styles = CATEGORY_STYLES[category];

  return (
    <motion.div
      className="insight-card"
      whileHover={{ scale: 1.02, y: -4 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        background: styles.gradient,
        border: `1px solid ${styles.border}`,
        borderRadius: 16,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        aspectRatio: "3/4",
        minHeight: "280px",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        cursor: action ? "pointer" : "default",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isHovered
          ? `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px ${styles.border}`
          : "0 8px 24px rgba(0, 0, 0, 0.15)",
      }}
      onClick={action?.onClick}
    >
      {/* Subtle glow effect on hover */}
      <motion.div
        animate={{ opacity: isHovered ? 0.15 : 0 }}
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${styles.accent} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Icon with background */}
      <motion.div
        animate={{ scale: isHovered ? 1.1 : 1 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: styles.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          boxShadow: `0 4px 12px ${styles.accent}20`,
        }}
      >
        {icon}
      </motion.div>

      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: 0,
          color: "white",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          opacity: 0.65,
          fontSize: 14,
          margin: 0,
          color: "rgba(255, 255, 255, 0.9)",
          lineHeight: 1.5,
          maxWidth: "240px",
        }}
      >
        {description}
      </p>

      {action && (
        <motion.button
          whileHover={{ scale: 1.05, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          style={{
            marginTop: 4,
            padding: "10px 20px",
            background: `${styles.accent}20`,
            border: `1px solid ${styles.accent}50`,
            borderRadius: 10,
            color: styles.accent,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s",
          }}
        >
          {action.label}
          <motion.span
            animate={{ x: isHovered ? 4 : 0 }}
            style={{ fontSize: 16 }}
          >
            →
          </motion.span>
        </motion.button>
      )}

      {/* Category label */}
      <div style={{
        position: "absolute",
        top: 12,
        right: 12,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: styles.accent,
        opacity: 0.6,
      }}>
        {category === "stats" && t('insight.stats')}
        {category === "suggestion" && t('insight.suggestion')}
        {category === "achievement" && t('insight.achievement')}
      </div>
    </motion.div>
  );
}
