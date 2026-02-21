import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { searchAnime, saveEntry, deleteEntry, mediaDetails, viewerCached, trendingAnimeCached, type Media } from "../api/anilist";
import { saveFeedback, getLikedMediaIds, getDislikedMediaIds } from "../logic/feedback-store";
import DreamCard from "../components/DreamCard";
import MediaDetailView_dream from "../components/MediaDetailView_dream";
import { type FeedbackReason } from "../components/FeedbackPopover";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import FeedbackModalV4 from "../components/FeedbackModalV4";
import { getDreamEngine } from "../logic/netrecDream";
import type { GranularReason } from "../logic/netrecDream/dream-types";
import { logError } from "@utils/logger";
import { genreOverlap } from "@logic/netrecV3";

// Debounce Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Popular Tags for genre chips
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

// Horizontal scroll row component
function AnimeRow({
  title,
  items,
  onCardClick,
}: {
  title: string;
  items: Media[];
  onCardClick: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: "48px" }}
    >
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 700,
          opacity: 0.5,
          marginBottom: "16px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {title}
      </h3>
      <div
        className="anime-row-scroll"
        style={{
          display: "flex",
          gap: "12px",
          overflowX: "auto",
          paddingBottom: "8px",
          scrollBehavior: "smooth",
        }}
      >
        {items.map((anime) => {
          const cover =
            anime.coverImage?.extraLarge || anime.coverImage?.large || "";
          const displayTitle =
            anime.title?.english || anime.title?.romaji || "Unknown";
          return (
            <motion.div
              key={anime.id}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onCardClick(anime.id)}
              style={{
                flexShrink: 0,
                width: "160px",
                height: "240px",
                borderRadius: "10px",
                overflow: "hidden",
                cursor: "pointer",
                position: "relative",
                background: "#1e293b",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {cover && (
                <img
                  src={cover}
                  alt={displayTitle}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
              {/* Title overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "24px 10px 10px",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "white",
                    lineHeight: 1.3,
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {displayTitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Empty State — shown when there is no active query
function EmptyState({
  recentSearches,
  onRecentClick,
  onTagClick,
  trendingItems,
  onCardClick,
}: {
  recentSearches: string[];
  onRecentClick: (query: string) => void;
  onTagClick: (tag: string) => void;
  trendingItems: Media[];
  onCardClick: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "20px 0" }}>
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: "40px" }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              opacity: 0.5,
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
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

      {/* Trending Now */}
      <AnimeRow
        title={t("search.trendingNow")}
        items={trendingItems}
        onCardClick={onCardClick}
      />

      {/* Browse by Genre */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 700,
            opacity: 0.5,
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {t("search.browseGenres")}
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
    </div>
  );
}

export default function SearchDream() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const trendingPool = useRef<Media[]>([]);

  // Dream V4 Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState<{
    media: Media | null;
    type: 'like' | 'dislike';
  } | null>(null);

  // Load recent searches, viewer, and trending pool on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    viewerCached().then(setViewer).catch(() => { });
    // Fire-and-forget: load trending pool into ref
    trendingAnimeCached()
      .then((data) => { trendingPool.current = data; })
      .catch(() => { });
  }, []);

  useEffect(() => {
    getLikedMediaIds().then((ids) => setLikedIds(new Set(ids))).catch(() => { });
    getDislikedMediaIds().then((ids) => setDislikedIds(new Set(ids))).catch(() => { });
  }, []);

  // Search effect
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);

  // Trending items derived from the ref (only used in empty state)
  const [trendingItems, setTrendingItems] = useState<Media[]>([]);
  useEffect(() => {
    trendingAnimeCached()
      .then((data) => {
        trendingPool.current = data;
        setTrendingItems(data);
      })
      .catch(() => { });
  }, []);

  // "Similar" row: top result genres filtered from trending pool
  const similarItems = useMemo(() => {
    if (results.length === 0 || trendingPool.current.length === 0) return [];
    const topGenres: string[] = results[0]?.genres ?? [];
    if (topGenres.length === 0) return [];
    const resultIds = new Set(results.map((r) => r.id));
    return trendingPool.current
      .filter((anime) => !resultIds.has(anime.id) && genreOverlap(anime, topGenres) > 0)
      .slice(0, 12);
  }, [results]);

  async function performSearch(searchQuery: string) {
    setIsSearching(true);
    try {
      const res = await searchAnime(searchQuery, 30);
      setResults(res);
      saveRecentSearch(searchQuery);
      setRecentSearches(getRecentSearches());
    } catch (e) {
      logError("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  }

  function handleTagClick(tag: string) {
    setQuery(tag);
    inputRef.current?.focus();
  }

  function handleRecentClick(search: string) {
    setQuery(search);
    inputRef.current?.focus();
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  // Handlers for DreamCard - Dream V4 Integration
  const handleLike = useCallback((id: number, e: React.MouseEvent) => {
    const media = results.find(r => r.id === id);
    if (media) {
      setFeedbackModal({ media, type: 'like' });
    }
    setLikedIds((prev) => new Set([...prev, id]));
    setDislikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [results]);

  const handleFeedback = useCallback((id: number, reason: FeedbackReason) => {
    const media = results.find(r => r.id === id);
    if (media) {
      setFeedbackModal({ media, type: 'dislike' });
    }
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

    await saveFeedback(mediaId, feedbackType, {
      title,
      reasons,
      context: {
        wasFromRecommendation: false,
        recommendationSource: 'search',
        sessionMood: 'exploring'
      }
    });

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

    await saveFeedback(
      feedbackModal.media.id,
      feedbackModal.type,
      { title: feedbackModal.media.title?.english || feedbackModal.media.title?.romaji }
    );

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
      logError("remove failed", e);
    }
  }, []);

  // Open detail view
  const handleOpenDetail = useCallback(async (id: number) => {
    try {
      const details = await mediaDetails(id);
      setSelectedMedia(details);
    } catch (e) {
      logError("Failed to load media details:", e);
    }
  }, []);

  const hasActiveSearch = query.length > 0;

  // Build "Similar: Genre · Genre" label
  const topGenres: string[] = results[0]?.genres ?? [];
  const similarLabel = topGenres.length > 0
    ? t("search.similarTo", { genres: topGenres.slice(0, 3).join(" · ") })
    : "";

  return (
    <>
      {/* Hide scrollbar in AnimeRow via a style tag */}
      <style>{`.anime-row-scroll::-webkit-scrollbar { display: none; } .anime-row-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <div
        style={{
          minHeight: "100vh",
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
              onChange={(e) => setQuery(e.target.value)}
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
                e.currentTarget.style.boxShadow =
                  "0 12px 40px rgba(0,0,0,0.4), 0 0 0 3px rgba(0, 212, 255, 0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)";
              }}
            />
            {query && (
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
          {/* Empty State */}
          {!hasActiveSearch && !isSearching && (
            <EmptyState
              recentSearches={recentSearches}
              onRecentClick={handleRecentClick}
              onTagClick={handleTagClick}
              trendingItems={trendingItems}
              onCardClick={handleOpenDetail}
            />
          )}

          {/* Loading Spinner */}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p style={{ opacity: 0.5, fontSize: "14px", marginBottom: "24px" }}>
                {t("search.resultsFound", { count: results.length })}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "24px",
                  marginBottom: "48px",
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

              {/* Similar Row */}
              {similarItems.length > 0 && (
                <AnimeRow
                  title={similarLabel}
                  items={similarItems}
                  onCardClick={handleOpenDetail}
                />
              )}
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
    </>
  );
}
