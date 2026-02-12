import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { searchAnime, saveEntry, deleteEntry, mediaDetails, viewerCached, type Media } from "../api/anilist";
import { saveFeedback, getLikedMediaIds, getDislikedMediaIds } from "../logic/feedback-store";
import MoodBubbles, { type VibeDef } from "../components/MoodBubbles";
import DreamCard from "../components/DreamCard";
import MediaDetailView_dream from "../components/MediaDetailView_dream";
import { type FeedbackReason } from "../components/FeedbackPopover";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import FeedbackModalV4 from "../components/FeedbackModalV4";
import { getDreamEngine } from "../logic/netrecDream";
import type { GranularReason } from "../logic/netrecDream/dream-types";

// Debounce Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Search Result Types
interface TagResult {
  type: "tag";
  name: string;
  count: number;
  color: string;
}

interface MediaResult {
  type: "media";
  data: any;
}

type SearchResult = TagResult | MediaResult;

// Popular Tags for suggestions
const POPULAR_TAGS = [
  { name: "Action", color: "#ef4444" },
  { name: "Romance", color: "#ec4899" },
  { name: "Comedy", color: "#22c55e" },
  { name: "Fantasy", color: "#a855f7" },
  { name: "Sci-Fi", color: "#3b82f6" },
  { name: "Slice of Life", color: "#10b981" },
  { name: "Mystery", color: "#6366f1" },
  { name: "Horror", color: "#64748b" },
];

// Recent Searches (from localStorage)
function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem("recent_searches") || "[]").slice(0, 5);
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem("recent_searches", JSON.stringify(recent.slice(0, 5)));
  } catch { }
}

// Tag Result Card Component
function TagResultCard({
  tag,
  onClick,
}: {
  tag: TagResult;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        gridColumn: "span 2",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 24px",
        background: `linear-gradient(135deg, ${tag.color}15 0%, ${tag.color}08 100%)`,
        border: `1px solid ${tag.color}30`,
        borderRadius: "14px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
          {tag.name}
        </h3>
        <p style={{ opacity: 0.5, fontSize: "13px" }}>{tag.count}+ {t("common.anime")}</p>
      </div>
      <motion.div
        style={{
          fontSize: "24px",
          color: tag.color,
          opacity: 0.8,
        }}
      >
        →
      </motion.div>
    </motion.div>
  );
}

// Empty State Component
function EmptyState({
  recentSearches,
  onRecentClick,
  onVibeSelect,
  onTagClick,
}: {
  recentSearches: string[];
  onRecentClick: (query: string) => void;
  onVibeSelect: (vibe: VibeDef) => void;
  onTagClick: (tag: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "20px 0" }}>
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: "48px" }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 700, opacity: 0.5, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("search.recentSearches")}
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {recentSearches.map((search, i) => (
              <motion.button
                key={search}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => onRecentClick(search)}
                style={{
                  padding: "10px 18px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "99px",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {search}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Popular Genres */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: "48px" }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, opacity: 0.5, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {t("search.popularGenres")}
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {POPULAR_TAGS.map((tag, i) => (
            <motion.button
              key={tag.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onTagClick(tag.name)}
              style={{
                padding: "12px 20px",
                background: `${tag.color}15`,
                border: `1px solid ${tag.color}40`,
                borderRadius: "12px",
                color: "white",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                boxShadow: `0 4px 12px ${tag.color}15`,
              }}
            >
              {tag.name}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Mood Bubbles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, opacity: 0.5, marginBottom: "24px", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>
          {t("search.orChooseVibe")}
        </h3>
        <MoodBubbles onSelect={onVibeSelect} />
      </motion.div>
    </div>
  );
}

// Active Vibe Badge
function ActiveVibeBadge({
  vibe,
  onClear,
}: {
  vibe: VibeDef;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        background: `${vibe.color}20`,
        border: `1px solid ${vibe.color}50`,
        borderRadius: "99px",
        marginBottom: "24px",
      }}
    >
      <span style={{ fontSize: "18px" }}>{vibe.emoji}</span>
      <span style={{ fontWeight: 600, color: "white" }}>{vibe.name} Vibe</span>
      <button
        onClick={onClear}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.6)",
          cursor: "pointer",
          padding: "2px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <AiOutlineClose size={16} />
      </button>
    </motion.div>
  );
}

export default function SearchDream() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<VibeDef | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Dream V4 Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState<{
    media: Media | null;
    type: 'like' | 'dislike';
  } | null>(null);

  // Load recent searches and viewer
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    viewerCached().then(setViewer).catch(() => { });
  }, []);

  useEffect(() => {
    getLikedMediaIds().then((ids) => setLikedIds(new Set(ids))).catch(() => { });
    getDislikedMediaIds().then((ids) => setDislikedIds(new Set(ids))).catch(() => { });
  }, []);

  // Search effect
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
    } else if (selectedVibe) {
      searchByVibe(selectedVibe);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, selectedVibe]);

  async function performSearch(searchQuery: string) {
    setIsSearching(true);
    try {
      const res = await searchAnime(searchQuery, 30);
      setResults(res);
      saveRecentSearch(searchQuery);
      setRecentSearches(getRecentSearches());
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  }

  async function searchByVibe(vibe: VibeDef) {
    setIsSearching(true);
    try {
      // Search by genre (vibe's primary genre)
      const genre = vibe.genres[0];
      const res = await searchAnime(genre, 40);
      setResults(res);
    } catch (e) {
      console.error("Vibe search error:", e);
    } finally {
      setIsSearching(false);
    }
  }

  function handleVibeSelect(vibe: VibeDef) {
    setSelectedVibe(vibe);
    setQuery("");
  }

  function handleTagClick(tag: string) {
    setQuery(tag);
    setSelectedVibe(null);
    inputRef.current?.focus();
  }

  function handleRecentClick(search: string) {
    setQuery(search);
    setSelectedVibe(null);
    inputRef.current?.focus();
  }

  function clearSearch() {
    setQuery("");
    setSelectedVibe(null);
    setResults([]);
    inputRef.current?.focus();
  }

  // Handlers for DreamCard - Dream V4 Integration
  const handleLike = useCallback((id: number, e: React.MouseEvent) => {
    // Find the media object and show granular feedback modal
    const media = results.find(r => r.id === id);
    if (media) {
      setFeedbackModal({ media, type: 'like' });
    }
    // Update UI immediately
    setLikedIds((prev) => new Set([...prev, id]));
    setDislikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [results]);

  const handleFeedback = useCallback((id: number, reason: FeedbackReason) => {
    // Find the media object and show granular feedback modal
    const media = results.find(r => r.id === id);
    if (media) {
      setFeedbackModal({ media, type: 'dislike' });
    }
    // Update UI immediately
    setDislikedIds((prev) => new Set([...prev, id]));
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setResults((prev) => prev.filter((r) => r.id !== id));
  }, [results]);

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
        recommendationSource: 'search',
        sessionMood: 'exploring'
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

  const handleRemoveFromList = useCallback(async (entryId: number, mediaId: number) => {
    try {
      await deleteEntry(entryId);
      setResults((prev) =>
        prev.map((m) =>
          m.id === mediaId ? { ...m, mediaListEntry: null } : m
        )
      );
    } catch (e) {
      console.error("remove failed", e);
    }
  }, []);

  // Open detail view
  const handleOpenDetail = useCallback(async (id: number) => {
    try {
      const details = await mediaDetails(id);
      setSelectedMedia(details);
    } catch (e) {
      console.error("Failed to load media details:", e);
    }
  }, []);

  const hasActiveSearch = query.length > 0 || selectedVibe !== null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        padding: "40px 20px 80px",
      }}
    >
      {/* Search Header */}
      <div style={{ maxWidth: "800px", margin: "0 auto 40px" }}>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: "32px",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: "24px",
            color: "white",
          }}
        >
          {t("search.title")}
        </motion.h1>

        {/* Search Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            position: "relative",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <AiOutlineSearch
            size={22}
            style={{
              position: "absolute",
              left: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.4)",
            }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedVibe(null);
            }}
            placeholder={t("search.placeholder")}
            style={{
              width: "100%",
              padding: "18px 50px 18px 54px",
              fontSize: "17px",
              borderRadius: "99px",
              background: "rgba(30, 41, 59, 0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              outline: "none",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              transition: "all 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.5)";
              e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4), 0 0 0 3px rgba(0, 212, 255, 0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)";
            }}
          />
          {(query || selectedVibe) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={clearSearch}
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <AiOutlineClose size={14} />
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
        {/* Active Vibe Badge */}
        <AnimatePresence>
          {selectedVibe && (
            <div style={{ textAlign: "center" }}>
              <ActiveVibeBadge
                vibe={selectedVibe}
                onClear={() => setSelectedVibe(null)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Empty State (no search, no vibe) */}
        {!hasActiveSearch && !isSearching && (
          <EmptyState
            recentSearches={recentSearches}
            onRecentClick={handleRecentClick}
            onVibeSelect={handleVibeSelect}
            onTagClick={handleTagClick}
          />
        )}

        {/* Loading State */}
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "60px 0",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid rgba(0, 212, 255, 0.2)",
                borderTopColor: "#00d4ff",
                borderRadius: "50%",
              }}
            />
          </motion.div>
        )}

        {/* Results Grid */}
        {hasActiveSearch && !isSearching && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p style={{ opacity: 0.5, fontSize: "14px", marginBottom: "24px" }}>
              {t("search.resultsFound", { count: results.length })}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "24px",
              }}
            >
              {results.map((media, index) => (
                <motion.div
                  key={media.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <DreamCard
                    media={media}
                    matchScore={0}
                    reasons={[]}
                    onLike={handleLike}
                    onFeedback={handleFeedback}
                    onQuickAdd={handleQuickAdd}
                    onSnooze={() => { }}
                    onClick={handleOpenDetail}
                    listStatus={media.mediaListEntry?.status}
                    listProgress={media.mediaListEntry?.progress}
                    listScore={media.mediaListEntry?.score}
                    listEntryId={media.mediaListEntry?.id}
                    liked={likedIds.has(media.id)}
                    disliked={dislikedIds.has(media.id)}
                    onRemoveFromList={handleRemoveFromList}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* No Results */}
        {hasActiveSearch && !isSearching && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: "center",
              padding: "80px 20px",
            }}
          >
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🔍</div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
              {t("search.noResults")}
            </h3>
            <p style={{ opacity: 0.5, fontSize: "14px" }}>
              {t("search.tryOtherTerm")}
            </p>
          </motion.div>
        )}
      </div>

      {/* Detail View Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <MediaDetailView_dream
            media={selectedMedia}
            title={selectedMedia.title?.english || selectedMedia.title?.romaji || "Unknown"}
            scoreFormat={viewer?.mediaListOptions?.scoreFormat}
            onClose={() => setSelectedMedia(null)}
            onSaved={() => setSelectedMedia(null)}
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
    </div>
  );
}
