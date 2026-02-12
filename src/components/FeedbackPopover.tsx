import React, { useState } from "react";
import { motion } from "framer-motion";

export type FeedbackReason =
  | "too_long"
  | "artstyle"
  | "boring"
  | "not_now"
  | "mood_wrong"
  | "already_seen";

interface FeedbackPopoverProps {
  onSelect: (reason: FeedbackReason) => void;
  onClose: () => void;
}

const OPTIONS: { id: FeedbackReason; label: string; icon: string; description?: string }[] = [
  { id: "too_long", label: "Zu lang", icon: "⏳", description: "Weniger Episoden bitte" },
  { id: "artstyle", label: "Artstyle", icon: "🎨", description: "Nicht mein visueller Stil" },
  { id: "boring", label: "Langweilig", icon: "💤", description: "Klingt nicht interessant" },
  { id: "mood_wrong", label: "Falscher Vibe", icon: "🎭", description: "Passt nicht zur Stimmung" },
  { id: "already_seen", label: "Schon gesehen", icon: "👀", description: "Kenne ich bereits" },
  { id: "not_now", label: "Nicht jetzt", icon: "🚫", description: "Später nochmal zeigen" },
];

export function FeedbackPopover({ onSelect, onClose }: FeedbackPopoverProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        position: "absolute",
        bottom: "70px",
        left: "10px",
        background: "rgba(10, 15, 25, 0.98)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "180px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset",
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{
        fontSize: "10px",
        opacity: 0.4,
        padding: "8px 12px 6px",
        textTransform: "uppercase",
        fontWeight: 700,
        letterSpacing: "0.5px",
        color: "#94a3b8"
      }}>
        Warum nicht?
      </div>
      {OPTIONS.map((opt, index) => (
        <motion.button
          key={opt.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03 }}
          onClick={() => onSelect(opt.id)}
          onMouseEnter={() => setHoveredId(opt.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 12px",
            background: hoveredId === opt.id ? "rgba(0, 212, 255, 0.1)" : "transparent",
            border: "none",
            borderRadius: "10px",
            color: hoveredId === opt.id ? "#00d4ff" : "#fff",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
            transition: "all 0.15s ease",
            transform: hoveredId === opt.id ? "translateX(4px)" : "translateX(0)",
          }}
        >
          <span style={{
            fontSize: "18px",
            width: "24px",
            textAlign: "center",
            filter: hoveredId === opt.id ? "none" : "grayscale(30%)",
            transition: "filter 0.15s"
          }}>{opt.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{opt.label}</div>
            {opt.description && (
              <div style={{
                fontSize: "11px",
                opacity: 0.5,
                marginTop: "2px",
                fontWeight: 400
              }}>
                {opt.description}
              </div>
            )}
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}