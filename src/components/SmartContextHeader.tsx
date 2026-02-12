import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { type Media } from "../api/anilist";
import { useTranslation } from "react-i18next";

export interface SmartContext {
  greetingType: "continuity" | "discovery";
  message: string;
  featuredAnime: Media;
  reasons: string[];
}

interface Props {
  context: SmartContext | null;
  onShowDetails?: (id: number) => void;
  onAddToList?: (id: number) => void;
}

export default function SmartContextHeader({ context, onShowDetails, onAddToList }: Props) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!context || !context.featuredAnime) return null;

  const { featuredAnime, message, reasons, greetingType } = context;
  const banner = featuredAnime.bannerImage || featuredAnime.coverImage?.extraLarge;
  const title = featuredAnime.title?.english || featuredAnime.title?.romaji || "Unknown";
  const episodes = featuredAnime.episodes;
  const format = featuredAnime.format;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: isMobile ? "auto" : "60vh",
      minHeight: isMobile ? "400px" : "500px",
      maxHeight: "700px",
      overflow: "hidden",
      marginBottom: "48px",
    }}>
      {/* Background Image with Parallax Effect */}
      <motion.div
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: "-10%",
        }}
      >
        <img
          src={banner}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(8px) brightness(0.4) saturate(1.2)",
          }}
        />
      </motion.div>

      {/* Gradient Overlays */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(15, 23, 42, 0.3) 0%, rgba(15, 23, 42, 0.8) 70%, #0f172a 100%)",
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to right, rgba(15, 23, 42, 0.8) 0%, transparent 50%)",
      }} />

      {/* Content Container */}
      <div style={{
        position: "relative",
        zIndex: 10,
        height: "100%",
        maxWidth: "1600px",
        margin: "0 auto",
        padding: isMobile ? "40px 20px" : "0 48px",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "24px" : "60px",
        flexDirection: isMobile ? "column" : "row",
      }}>
        {/* Cover Image - Only on Desktop */}
        {!isMobile && (
          <motion.div
            initial={{ opacity: 0, x: -30, rotateY: 15 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{
              flexShrink: 0,
              perspective: "1000px",
            }}
          >
            <img
              src={featuredAnime.coverImage?.extraLarge}
              alt={title}
              style={{
                width: "280px",
                borderRadius: "16px",
                boxShadow: "0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
                transform: "perspective(1000px) rotateY(-5deg)",
              }}
            />
          </motion.div>
        )}

        {/* Text Content */}
        <div style={{
          maxWidth: "700px",
          textAlign: isMobile ? "center" : "left",
        }}>
          {/* Category Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              background: "rgba(0, 212, 255, 0.15)",
              border: "1px solid rgba(0, 212, 255, 0.3)",
              borderRadius: "99px",
              marginBottom: "20px",
            }}
          >
            <span style={{
              fontSize: "12px",
              color: "#00d4ff",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}>
              {greetingType === "continuity"
                ? t("smartContext.greetingContinuity")
                : t("smartContext.greetingDiscovery")}
            </span>
          </motion.div>

          {/* Main Message */}
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: isMobile ? "32px" : "48px",
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: "8px",
              color: "white",
              textShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {message}
          </motion.h1>

          {/* Anime Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              fontSize: isMobile ? "20px" : "24px",
              fontWeight: 600,
              color: "#00d4ff",
              marginBottom: "24px",
            }}
          >
            {title}
          </motion.div>

          {/* Reason Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(12px)",
              padding: "20px 24px",
              borderRadius: "14px",
              marginBottom: "32px",
              borderLeft: "4px solid #00d4ff",
            }}
          >
            <div style={{ fontSize: "13px", opacity: 0.6, marginBottom: "6px", fontWeight: 500 }}>
              {t("smartContext.whyThisAnime")}
            </div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "white", lineHeight: 1.5 }}>
              {reasons[0] || t("smartContext.defaultReason")}
            </div>
            {/* Meta Info */}
            <div style={{ display: "flex", gap: "16px", marginTop: "12px", opacity: 0.6, fontSize: "13px" }}>
              {format && <span>{format}</span>}
              {episodes && <span>{episodes} {t("smartContext.episodes")}</span>}
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: isMobile ? "center" : "flex-start",
              flexWrap: "wrap",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0, 212, 255, 0.4)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onShowDetails?.(featuredAnime.id)}
              style={{
                padding: "16px 36px",
                background: "linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)",
                border: "none",
                borderRadius: "99px",
                fontWeight: 800,
                fontSize: "16px",
                cursor: "pointer",
                color: "#000",
                boxShadow: "0 8px 24px rgba(0, 212, 255, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "18px" }}>→</span>
              {t("smartContext.moreInfo")}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.15)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddToList?.(featuredAnime.id)}
              style={{
                padding: "16px 32px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "99px",
                fontWeight: 700,
                fontSize: "16px",
                cursor: "pointer",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "18px" }}>+</span>
              {t("smartContext.watchlist")}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
