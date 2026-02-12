/**
 * Library Dream - Modern Library Page
 *
 * Features:
 * - Stats Dashboard with animations
 * - Tab-based navigation
 * - Search and filters
 * - Grid/List view modes
 * - Dream-style cards
 * - Airing calendar
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  viewerCached,
  userLists,
  mediaDetails,
  saveEntry,
  deleteEntry,
  subscribeAuth,
  type Media,
} from "../api/anilist";
import DreamCard from "../components/DreamCard";
import MediaDetailView_dream from "../components/MediaDetailView_dream";
import { AiOutlineSearch, AiOutlineClose, AiOutlineAppstore, AiOutlineUnorderedList } from "react-icons/ai";
import { type FeedbackReason } from "../components/FeedbackPopover";
import { saveFeedback, getLikedMediaIds, getDislikedMediaIds } from "../logic/feedback-store";
import FeedbackModalV4 from "../components/FeedbackModalV4";
import { getDreamEngine } from "../logic/netrecDream";
import type { GranularReason } from "../logic/netrecDream/dream-types";
import {
  BookIcon, PlayIcon, ClipboardIcon, CheckIcon, PauseIcon, XIcon,
  StarIcon, ClockIcon, CalendarIcon
} from "../components/icons/StatusIcons";
import OfflineIndicator from "../components/OfflineIndicator";

type ListStatus = "CURRENT" | "PLANNING" | "COMPLETED" | "PAUSED" | "DROPPED" | "REPEATING";
type ViewMode = "grid" | "list";
type SortBy = "updated" | "title" | "progress" | "score";

interface ListEntry {
  media: Media;
  status: string;
  progress: number;
  score?: number;
  updatedAt?: number;
}

// Status Tabs Configuration
function getStatusTabs(t: (key: string) => string) {
  return [
    { value: "ALL", label: t('library.all'), icon: <BookIcon />, color: "#94a3b8" },
    { value: "CURRENT", label: t('library.watching'), icon: <PlayIcon />, color: "#22c55e" },
    { value: "PLANNING", label: t('library.planning'), icon: <ClipboardIcon />, color: "#3b82f6" },
    { value: "COMPLETED", label: t('library.completed'), icon: <CheckIcon />, color: "#a855f7" },
    { value: "PAUSED", label: t('library.paused'), icon: <PauseIcon />, color: "#f59e0b" },
    { value: "DROPPED", label: t('library.dropped'), icon: <XIcon />, color: "#ef4444" },
  ];
}

// Sort Options
function getSortOptions(t: (key: string) => string) {
  return [
    { value: "updated", label: t('library.sortUpdated') },
    { value: "title", label: t('library.sortTitle') },
    { value: "progress", label: t('library.sortProgress') },
    { value: "score", label: t('library.sortScore') },
  ];
}

// Loading State Component
function LoadingState() {
  const { t } = useTranslation();
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
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
      <p style={{ opacity: 0.6 }}>{t('library.loadingLibrary')}</p>
    </div>
  );
}

// Stats Card Component
function StatsCard({ label, value, icon, color, delay = 0 }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
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
        padding: 20,
        background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
        border: `1px solid ${color}25`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 28, display: "flex", alignItems: "center" }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </motion.div>
  );
}

// Airing Card Component
function AiringCard({ item, onClick }: {
  item: { media: Media; episode: number; dayOfWeek: string; time: string };
  onClick: () => void;
}) {
  const title = item.media.title?.english || item.media.title?.romaji || "Unknown";
  const cover = item.media.coverImage?.medium;

  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 4 }}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        background: "rgba(0, 212, 255, 0.06)",
        border: "1px solid rgba(0, 212, 255, 0.15)",
        borderRadius: 12,
        cursor: "pointer",
      }}
    >
      {cover && (
        <img
          src={cover}
          alt={title}
          style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 6 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>Episode {item.episode}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#00d4ff" }}>{item.dayOfWeek}</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>{item.time}</div>
      </div>
    </motion.div>
  );
}

// Library Entry Card (List View)
function LibraryListCard({ entry, onOpen, onUpdate }: { entry: ListEntry; onOpen: () => void; onUpdate: () => void }) {
  const { t } = useTranslation();
  const title = entry.media.title?.english || entry.media.title?.romaji || "Unknown";
  const cover = entry.media.coverImage?.medium;
  const progress = entry.progress;
  const total = entry.media.episodes || 0;
  const progressPercent = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
  const format = entry.media.format?.replace("_", " ") || "";

  const statusColors: Record<string, string> = {
    CURRENT: "#22c55e",
    PLANNING: "#3b82f6",
    COMPLETED: "#a855f7",
    PAUSED: "#f59e0b",
    DROPPED: "#ef4444",
  };
  const accent = statusColors[entry.status] || "#94a3b8";

  const handleProgress = async (e: React.MouseEvent, newProgress: number) => {
    e.stopPropagation();
    if (newProgress < 0) return;
    try {
      await saveEntry(entry.media.id, entry.status, newProgress);
      onUpdate();
    } catch (err) {
      console.error("Failed to update progress", err);
    }
  };

  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 120px 80px 100px",
        gap: 16,
        alignItems: "center",
        padding: "12px 20px",
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: 12,
        cursor: "pointer",
        transition: "background 0.2s",
      }}
    >
      {cover && (
        <img
          src={cover}
          alt={title}
          style={{ width: 60, height: 85, objectFit: "cover", borderRadius: 8 }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            background: "rgba(255,255,255,0.1)",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700
          }}>
            {format}
          </span>
          {entry.media.episodes ? t('library.episodes', { count: entry.media.episodes }) : t('library.ongoing')}
        </div>
      </div>
      <div>
        {(entry.status === "CURRENT" || entry.status === "PAUSED" || entry.status === "REPEATING") && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={(e) => handleProgress(e, progress - 1)}
                  style={{
                    width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)",
                    background: "transparent", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center",
                    padding: 0, fontSize: 12
                  }}
                >
                  -
                </button>
                <span style={{ fontWeight: 600 }}>{progress}</span>
                <button
                  onClick={(e) => handleProgress(e, progress + 1)}
                  style={{
                    width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)",
                    background: "transparent", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center",
                    padding: 0, fontSize: 12
                  }}
                >
                  +
                </button>
              </div>
              <span style={{ opacity: 0.5 }}>/ {total || "?"}</span>
            </div>
            <div style={{ height: 4, background: "rgba(255, 255, 255, 0.1)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: "linear-gradient(90deg, #00d4ff, #38bdf8)", borderRadius: 2 }} />
            </div>
          </>
        )}
      </div>
      <div style={{ textAlign: "center" }}>
        {entry.score ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
            <span style={{ color: "#fbbf24" }}><StarIcon /></span>
            <span style={{ fontWeight: 700 }}>{entry.score}</span>
          </div>
        ) : (
          <span style={{ opacity: 0.3 }}>—</span>
        )}
      </div>
      <div
        style={{
          padding: "6px 12px",
          background: `${accent}20`,
          border: `1px solid ${accent}40`,
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center",
          color: accent,
        }}
      >
        {entry.status}
      </div>
    </motion.div>
  );
}

export default function Library_dream() {
  const { t } = useTranslation();
  const STATUS_TABS = useMemo(() => getStatusTabs(t), [t]);
  const SORT_OPTIONS = useMemo(() => getSortOptions(t), [t]);
  const [me, setMe] = useState<any>(null);
  const [allEntries, setAllEntries] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<number>>(new Set());
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // View State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail View
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  // Dream V4 Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState<{
    media: Media | null;
    type: 'like' | 'dislike';
  } | null>(null);

  // Load Library with offline support
  async function loadLibrary() {
    setLoading(true);
    setIsOfflineMode(false);

    try {
      const viewer = await viewerCached();
      setMe(viewer);

      // Try to load from API
      const data = await userLists(viewer.id);

      const entries: ListEntry[] = [];
      for (const list of data?.lists || []) {
        for (const entry of list.entries || []) {
          if (entry.media) {
            entries.push({
              media: entry.media,
              status: entry.status || list.name,
              progress: entry.progress || 0,
              score: entry.score,
              updatedAt: entry.updatedAt,
            });
          }
        }
      }

      // Initial Sort by updatedAt
      entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      setAllEntries(entries);

      // Cache for offline use
      try {
        // @ts-ignore - window.shokai is defined in preload
        await window.shokai?.offline?.cacheLibrary(String(viewer.id), entries);
        console.log("[Library] Cached", entries.length, "entries for offline use");
      } catch (cacheErr) {
        console.warn("[Library] Failed to cache:", cacheErr);
      }
    } catch (e) {
      console.error("[library] Online load failed:", e);

      // Fallback to offline cache
      try {
        // @ts-ignore
        const userId = await window.shokai?.store?.get("anilist.user_id");
        if (userId) {
          // @ts-ignore
          const result = await window.shokai?.offline?.getCachedLibrary(String(userId));
          if (result?.entries && result.entries.length > 0) {
            console.log("[Library] Using offline cache:", result.entries.length, "entries");
            setIsOfflineMode(true);

            // Convert cached entries back to ListEntry format
            const entries: ListEntry[] = result.entries.map((cached: any) => ({
              media: JSON.parse(cached.media),
              status: cached.status,
              progress: cached.progress,
              score: cached.score,
              updatedAt: cached.updatedAt,
            }));

            entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setAllEntries(entries);
          }
        }
      } catch (offlineErr) {
        console.error("[Library] Offline fallback failed:", offlineErr);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
    const unsub = subscribeAuth(() => loadLibrary());
    return () => unsub?.();
  }, []);

  useEffect(() => {
    getLikedMediaIds().then((ids) => setLikedIds(new Set(ids))).catch(() => { });
    getDislikedMediaIds().then((ids) => setDislikedIds(new Set(ids))).catch(() => { });
  }, []);

  // Title Helper
  function titleOf(m: Media): string {
    return m.title?.english || m.title?.romaji || m.title?.native || String(m.id);
  }

  // Stats Calculation
  const stats = useMemo(() => {
    const completed = allEntries.filter(e => e.status === "COMPLETED");
    const watching = allEntries.filter(e => e.status === "CURRENT");
    const totalEpisodes = completed.reduce((sum, e) => sum + (e.media.episodes || 0), 0);
    const totalDays = (totalEpisodes * 24) / 1440;

    const scoredEntries = allEntries.filter(e => e.score && e.score > 0);
    const avgScore = scoredEntries.length > 0
      ? scoredEntries.reduce((sum, e) => sum + (e.score || 0), 0) / scoredEntries.length
      : 0;

    return {
      total: allEntries.length,
      completed: completed.length,
      watching: watching.length,
      planning: allEntries.filter(e => e.status === "PLANNING").length,
      totalDays: totalDays.toFixed(1),
      avgScore: avgScore.toFixed(1),
    };
  }, [allEntries]);

  // Filtered & Sorted Entries
  const filteredEntries = useMemo(() => {
    let result = [...allEntries];

    // Tab Filter
    if (activeTab !== "ALL") {
      result = result.filter(e => e.status === activeTab);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => titleOf(e.media).toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "title":
          comparison = titleOf(a.media).localeCompare(titleOf(b.media));
          break;
        case "updated":
          comparison = (b.updatedAt || 0) - (a.updatedAt || 0);
          break;
        case "progress":
          const aP = a.progress / (a.media.episodes || 1);
          const bP = b.progress / (b.media.episodes || 1);
          comparison = bP - aP;
          break;
        case "score":
          comparison = (b.score || 0) - (a.score || 0);
          break;
      }
      return sortOrder === "asc" ? -comparison : comparison;
    });

    return result;
  }, [allEntries, activeTab, searchQuery, sortBy, sortOrder]);

  // Airing This Week
  const airingThisWeek = useMemo(() => {
    const watching = allEntries.filter(e => e.status === "CURRENT");
    const airing = watching.filter(e => {
      const nextAiring = (e.media as any).nextAiringEpisode;
      if (!nextAiring) return false;
      const airingAt = nextAiring.airingAt * 1000;
      const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
      return airingAt > Date.now() && airingAt < weekFromNow;
    });

    return airing.map(e => {
      const nextAiring = (e.media as any).nextAiringEpisode;
      const date = new Date(nextAiring.airingAt * 1000);
      const dayOfWeek = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][date.getDay()];

      return {
        media: e.media,
        episode: nextAiring.episode,
        airingAt: nextAiring.airingAt * 1000,
        dayOfWeek,
        time: date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      };
    }).sort((a, b) => a.airingAt - b.airingAt);
  }, [allEntries]);

  // Open Detail
  const openDetail = useCallback(async (id: number) => {
    const full = await mediaDetails(id);
    setSelectedMedia(full);
  }, []);

  // Card Handlers - Dream V4 Integration
  const handleLike = useCallback((id: number, e: React.MouseEvent) => {
    // Find the media object and show granular feedback modal
    const entry = allEntries.find(e => e.media.id === id);
    if (entry?.media) {
      setFeedbackModal({ media: entry.media, type: 'like' });
    }
    // Update UI immediately
    setLikedIds((prev) => new Set([...prev, id]));
    setDislikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [allEntries]);

  const handleFeedback = useCallback((id: number, reason: FeedbackReason) => {
    // Find the media object and show granular feedback modal
    const entry = allEntries.find(e => e.media.id === id);
    if (entry?.media) {
      setFeedbackModal({ media: entry.media, type: 'dislike' });
    }
    // Update UI immediately
    setDislikedIds((prev) => new Set([...prev, id]));
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [allEntries]);

  // Dream V4 Feedback Submit Handler
  const handleFeedbackSubmit = useCallback(async (reasons: GranularReason[]) => {
    if (!feedbackModal?.media) return;

    const mediaId = feedbackModal.media.id;
    const feedbackType = feedbackModal.type;
    const title = feedbackModal.media.title?.english || feedbackModal.media.title?.romaji;

    // Save to feedback store
    await saveFeedback(mediaId, feedbackType, {
      title,
      reasons,
      context: {
        wasFromRecommendation: false,
        recommendationSource: 'library',
        sessionMood: 'casual'
      }
    });

    // Process through Dream Engine if available
    const engine = getDreamEngine();
    if (engine) {
      const media = feedbackModal.media;
      await engine.processFeedback(
        mediaId,
        feedbackType,
        reasons,
        {
          title: media.title?.english || media.title?.romaji,
          genres: media.genres ?? undefined,
          tags: media.tags?.map(t => typeof t === 'string' ? t : t.name),
          studios: media.studios?.nodes?.map(s => s.name),
          year: media.seasonYear ?? undefined,
          episodes: media.episodes ?? undefined
        }
      );
    }

    setFeedbackModal(null);
  }, [feedbackModal]);

  const handleFeedbackSkip = useCallback(async () => {
    if (!feedbackModal?.media) {
      setFeedbackModal(null);
      return;
    }

    // Just save basic feedback without reasons
    await saveFeedback(
      feedbackModal.media.id,
      feedbackModal.type,
      { title: feedbackModal.media.title?.english || feedbackModal.media.title?.romaji }
    );

    // Still process through Dream Engine with empty reasons
    const engine = getDreamEngine();
    if (engine) {
      const media = feedbackModal.media;
      await engine.processFeedback(
        feedbackModal.media.id,
        feedbackModal.type,
        [],
        {
          title: media.title?.english || media.title?.romaji,
          genres: media.genres ?? undefined,
          tags: media.tags?.map(t => typeof t === 'string' ? t : t.name),
          studios: media.studios?.nodes?.map(s => s.name),
          year: media.seasonYear ?? undefined,
          episodes: media.episodes ?? undefined
        }
      );
    }

    setFeedbackModal(null);
  }, [feedbackModal]);

  const handleQuickAdd = useCallback((id: number, status: string) => {
    saveEntry(id, status);
  }, []);

  const handleRemoveFromList = useCallback(async (entryId: number) => {
    try {
      await deleteEntry(entryId);
      await loadLibrary();
    } catch (e) {
      console.error("remove failed", e);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", padding: 40 }}>
        <LoadingState />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
        {/* Offline Mode Banner */}
        {isOfflineMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 20,
              padding: "12px 20px",
              background: "rgba(234, 179, 8, 0.15)",
              border: "1px solid rgba(234, 179, 8, 0.3)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>📴</span>
            <div>
              <div style={{ fontWeight: 600, color: "#eab308" }}>{t('library.offlineMode')}</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                {t('library.offlineDescription')}
              </div>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 40 }}
        >
          <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{t('library.yourLibrary')}</h1>
          <p style={{ opacity: 0.5, fontSize: 16 }}>
            {t('library.animeInCollection', { count: stats.total })}
          </p>
        </motion.div>

        {/* Stats Dashboard */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}>
          <StatsCard label={t('library.total')} value={stats.total} icon={<BookIcon />} color="#94a3b8" delay={0} />
          <StatsCard label={t('library.watching')} value={stats.watching} icon={<PlayIcon />} color="#22c55e" delay={0.05} />
          <StatsCard label={t('library.completed')} value={stats.completed} icon={<CheckIcon />} color="#a855f7" delay={0.1} />
          <StatsCard label={t('library.planning')} value={stats.planning} icon={<ClipboardIcon />} color="#3b82f6" delay={0.15} />
          <StatsCard label={t('library.watchtime')} value={`${stats.totalDays}d`} icon={<ClockIcon />} color="#f59e0b" delay={0.2} />
          <StatsCard label={t('library.avgScore')} value={stats.avgScore} icon={<StarIcon />} color="#fbbf24" delay={0.25} />
        </div>

        {/* Airing This Week */}
        {airingThisWeek.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 40,
              padding: 24,
              background: "rgba(0, 212, 255, 0.04)",
              border: "1px solid rgba(0, 212, 255, 0.15)",
              borderRadius: 20,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}><CalendarIcon /></span>
              {t('library.thisWeek')}
            </h2>
            <div style={{ display: "grid", gap: 8 }}>
              {airingThisWeek.slice(0, 5).map((item, idx) => (
                <AiringCard
                  key={idx}
                  item={item}
                  onClick={() => openDetail(item.media.id)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          marginBottom: 24,
          paddingBottom: 8,
        }}>
          {STATUS_TABS.map((tab) => (
            <motion.button
              key={tab.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: "12px 20px",
                background: activeTab === tab.value ? `${tab.color}20` : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${activeTab === tab.value ? tab.color : "rgba(255, 255, 255, 0.1)"}`,
                borderRadius: 12,
                color: activeTab === tab.value ? tab.color : "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Search & Filters */}
        <div style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 400 }}>
            <AiOutlineSearch
              size={20}
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.4,
              }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('library.searchPlaceholder')}
              style={{
                width: "100%",
                padding: "14px 44px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 12,
                color: "white",
                fontSize: 15,
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "white",
                }}
              >
                <AiOutlineClose size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            style={{
              padding: "14px 20px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 12,
              color: "white",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            style={{
              padding: "14px 16px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 12,
              color: "white",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>

          {/* View Mode */}
          <div style={{ display: "flex", gap: 4, background: "rgba(0, 0, 0, 0.3)", borderRadius: 10, padding: 4, marginLeft: "auto" }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode("grid")}
              style={{
                padding: "10px 14px",
                background: viewMode === "grid" ? "rgba(0, 212, 255, 0.2)" : "transparent",
                border: "none",
                borderRadius: 8,
                color: viewMode === "grid" ? "#00d4ff" : "white",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AiOutlineAppstore size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode("list")}
              style={{
                padding: "10px 14px",
                background: viewMode === "list" ? "rgba(0, 212, 255, 0.2)" : "transparent",
                border: "none",
                borderRadius: 8,
                color: viewMode === "list" ? "#00d4ff" : "white",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AiOutlineUnorderedList size={20} />
            </motion.button>
          </div>
        </div>

        {/* Results Count */}
        <p style={{ opacity: 0.5, fontSize: 14, marginBottom: 24 }}>
          {filteredEntries.length} Ergebnisse
          {searchQuery && ` für "${searchQuery}"`}
        </p>

        {/* Content */}
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Keine Einträge gefunden</h3>
            <p style={{ opacity: 0.5 }}>
              {searchQuery ? "Versuche einen anderen Suchbegriff" : "Füge Anime zu deiner Liste hinzu"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 20,
          }}>
            {filteredEntries.map((entry) => (
              <div key={entry.media.id}>
                <DreamCard
                  media={entry.media}
                  matchScore={0}
                  reasons={[]}
                  onLike={handleLike}
                  onFeedback={handleFeedback}
                  onQuickAdd={handleQuickAdd}
                  onSnooze={() => { }}
                  onClick={openDetail}
                  listStatus={entry.status}
                  listProgress={entry.progress}
                  listScore={entry.score}
                  listEntryId={entry.media.mediaListEntry?.id}
                  liked={likedIds.has(entry.media.id)}
                  disliked={dislikedIds.has(entry.media.id)}
                  onRemoveFromList={(entryId, _mediaId) => handleRemoveFromList(entryId)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredEntries.map((entry) => (
              <LibraryListCard
                key={entry.media.id}
                entry={entry}
                onOpen={() => openDetail(entry.media.id)}
                onUpdate={loadLibrary}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail View */}
      <AnimatePresence>
        {selectedMedia && (
          <MediaDetailView_dream
            media={selectedMedia}
            title={selectedMedia.title?.english || selectedMedia.title?.romaji || "Unknown"}
            scoreFormat={me?.mediaListOptions?.scoreFormat}
            onClose={() => setSelectedMedia(null)}
            onSaved={() => {
              setSelectedMedia(null);
              loadLibrary();
            }}
          />
        )}
      </AnimatePresence>

      {/* Dream V4 Feedback Modal */}
      <AnimatePresence>
        {feedbackModal?.media && (
          <FeedbackModalV4
            media={feedbackModal.media}
            feedbackType={feedbackModal.type}
            onSubmit={handleFeedbackSubmit}
            onSkip={handleFeedbackSkip}
          />
        )}
      </AnimatePresence>

      {/* Offline Indicator */}
      <OfflineIndicator position="bottom-right" />
    </div>
  );
}
