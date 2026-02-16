/**
 * Social Dream - Modern Social Feed Page
 *
 * Features:
 * - Beautiful gradient header
 * - Tab-based feed selection (Following/Global)
 * - Activity cards with hover effects
 * - Composer widget for posts
 * - Modern filter system
 * - Stats overview
 * - Dream-style animations
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  fetchActivityFeed,
  fetchGlobalActivities,
  mediaDetails,
  type ActivityEntry,
  type Media,
} from "@api/anilist";
import ActivityCard from "@components/ActivityCard";
import ComposerWidget from "@components/ComposerWidget";
import MediaDetailView_dream from "@components/MediaDetailView_dream";
import { MdRefresh, MdFilterList, MdPeople, MdPublic, MdTrendingUp } from "react-icons/md";
import { AiOutlineClose } from "react-icons/ai";
import { devLog, devWarn, logError } from "@utils/logger";


type FeedType = "following" | "global";

// Loading State Component
function LoadingState({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "40vh",
      gap: 24,
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        style={{
          width: 48,
          height: 48,
          border: "3px solid rgba(0, 212, 255, 0.2)",
          borderTopColor: "#00d4ff",
          borderRadius: "50%",
        }}
      />
      <p style={{ opacity: 0.6 }}>{label}</p>
    </div>
  );
}

// Stats Card Component
function StatsCard({ label, value, icon, color, delay = 0 }: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -4 }}
      style={{
        padding: 16,
        background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
        border: `1px solid ${color}25`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </motion.div>
  );
}

// Empty State Component
function EmptyState({
  onReset,
  hasFilters,
  title,
  description,
  resetLabel,
}: {
  onReset: () => void;
  hasFilters: boolean;
  title: string;
  description: string;
  resetLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 64,
        textAlign: "center",
        background: "linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        {hasFilters ? "🔍" : "📭"}
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 700 }}>
        {title}
      </h3>
      <p style={{ margin: 0, opacity: 0.6, maxWidth: 300, marginInline: "auto" }}>
        {description}
      </p>
      {hasFilters && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          style={{
            marginTop: 24,
            padding: "12px 24px",
            background: "linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {resetLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

export default function Social_dream() {
  const { t } = useTranslation();
  const [feedType, setFeedType] = useState<FeedType>("following");
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  // Activity Filters
  const [showListActivity, setShowListActivity] = useState(true);
  const [showTextActivity, setShowTextActivity] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      let data: ActivityEntry[];
      if (feedType === "following") {
        data = await fetchActivityFeed({ following: true, perPage: 50 });
      } else {
        data = await fetchGlobalActivities(50);
      }

      setActivities(data);
    } catch (err) {
      logError("[Social] Failed to load feed", err);
      setError(
        err instanceof Error ? err.message : t("social.loadError")
      );
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [feedType, t]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (activity.type === "ListActivity" && !showListActivity) return false;
      if (activity.type === "TextActivity" && !showTextActivity) return false;
      return true;
    });
  }, [activities, showListActivity, showTextActivity]);

  // Calculate stats
  const stats = useMemo(() => {
    const listUpdates = activities.filter((a) => a.type === "ListActivity").length;
    const textPosts = activities.filter((a) => a.type === "TextActivity").length;
    const uniqueUsers = new Set(activities.map((a) => a.user?.id)).size;
    return { listUpdates, textPosts, uniqueUsers };
  }, [activities]);

  const handleOpenDetail = useCallback(async (id: number) => {
    try {
      const details = await mediaDetails(id);
      setSelectedMedia(details);
    } catch (e) {
      logError("Failed to load details:", e);
    }
  }, []);

  const hasFilters = !showListActivity || !showTextActivity;

  return (
    <div style={{ paddingBottom: 64, maxWidth: 900, margin: "0 auto" }}>
      {/* Dream Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32 }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 42,
            fontWeight: 900,
            background: "linear-gradient(135deg, #fff 0%, #00d4ff 50%, #a855f7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: -1,
          }}
        >
          {t("social.title")}
        </h1>
        <p style={{ margin: "8px 0 0 0", fontSize: 15, opacity: 0.6 }}>
          {t("social.subtitle")}
        </p>
      </motion.header>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatsCard
          icon="📝"
          value={stats.listUpdates}
          label={t("social.listUpdates")}
          color="#22c55e"
          delay={0.1}
        />
        <StatsCard
          icon="💬"
          value={stats.textPosts}
          label={t("social.textPosts")}
          color="#3b82f6"
          delay={0.15}
        />
        <StatsCard
          icon="👥"
          value={stats.uniqueUsers}
          label={t("social.activeUsers")}
          color="#a855f7"
          delay={0.2}
        />
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Feed Type Toggle */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: 4,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFeedType("following")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: feedType === "following"
                ? "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)"
                : "transparent",
              border: feedType === "following"
                ? "1px solid rgba(0, 212, 255, 0.3)"
                : "1px solid transparent",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              color: feedType === "following" ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "all 0.2s",
            }}
          >
            <MdPeople size={18} />
            {t("social.following")}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFeedType("global")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: feedType === "global"
                ? "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)"
                : "transparent",
              border: feedType === "global"
                ? "1px solid rgba(0, 212, 255, 0.3)"
                : "1px solid transparent",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              color: feedType === "global" ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "all 0.2s",
            }}
          >
            <MdPublic size={18} />
            {t("social.global")}
          </motion.button>
        </div>

        {/* Filter Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            background: showFilters
              ? "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)"
              : "rgba(255,255,255,0.03)",
            border: showFilters
              ? "1px solid rgba(0, 212, 255, 0.3)"
              : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            color: showFilters ? "#00d4ff" : "rgba(255,255,255,0.6)",
          }}
        >
          <MdFilterList size={18} />
          {t("social.filter")}
          {hasFilters && (
            <span
              style={{
                width: 8,
                height: 8,
                background: "#00d4ff",
                borderRadius: "50%",
              }}
            />
          )}
        </motion.button>

        {/* Refresh Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void loadFeed()}
          disabled={loading}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
          >
            <MdRefresh size={18} />
          </motion.div>
          {loading ? t("common.loading") : t("common.refresh")}
        </motion.button>
      </motion.div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: 24,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 20,
                background: "linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {t("social.showActivityTypes")}
                </span>
                <button
                  onClick={() => setShowFilters(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.5)",
                    padding: 4,
                  }}
                >
                  <AiOutlineClose size={16} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <motion.label
                  whileHover={{ scale: 1.02 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    background: showListActivity
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: showListActivity
                      ? "1px solid rgba(34, 197, 94, 0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showListActivity}
                    onChange={(e) => setShowListActivity(e.target.checked)}
                    style={{ accentColor: "#22c55e" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>📝 {t("social.listUpdates")}</span>
                </motion.label>
                <motion.label
                  whileHover={{ scale: 1.02 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    background: showTextActivity
                      ? "rgba(59, 130, 246, 0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: showTextActivity
                      ? "1px solid rgba(59, 130, 246, 0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showTextActivity}
                    onChange={(e) => setShowTextActivity(e.target.checked)}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>💬 {t("social.statusPosts")}</span>
                </motion.label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: 16,
              marginBottom: 24,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 12,
              color: "#ef4444",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>⚠️</span>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer (only for following feed) */}
      {feedType === "following" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ComposerWidget onPost={() => void loadFeed()} />
        </motion.div>
      )}

      {/* Activity Feed */}
      {loading && activities.length === 0 ? (
        <LoadingState label={t("social.loadingFeed")} />
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          title={hasFilters ? t("social.noActivityWithFilters") : t("social.noActivity")}
          description={
            hasFilters ? t("social.noActivityWithFiltersDesc") : t("social.noActivityDesc")
          }
          resetLabel={t("social.resetFilters")}
          onReset={() => {
            setShowListActivity(true);
            setShowTextActivity(true);
          }}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {filteredActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * Math.min(index, 10) }}
            >
              <ActivityCard activity={activity} onMediaClick={handleOpenDetail} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Detail View */}
      <AnimatePresence>
        {selectedMedia && (
          <MediaDetailView_dream
            media={selectedMedia}
            title={selectedMedia.title?.english || selectedMedia.title?.romaji || "Unknown"}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
