import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { viewerCached, userLists, saveEntry, mediaDetails, deleteEntry, type Media } from "../api/anilist";
import { saveFeedback, getLikedMediaIds, getDislikedMediaIds } from "../logic/feedback-store";
import { createDreamEngine, getDreamEngine, type DreamRecommendationResult, type ProfileInsights } from "../logic/netrecDream";
import type { GranularReason } from "../logic/netrecDream/dream-types";
import SmartContextHeader, { type SmartContext } from "../components/SmartContextHeader";
import LiquidGrid, { type GridItem } from "../components/LiquidGrid";
import MediaDetailView_dream from "../components/MediaDetailView_dream";
import FeedbackModalV4, { ProfileInsightsPanel } from "../components/FeedbackModalV4";
import { type FeedbackReason } from "../components/FeedbackPopover";
import { TvIcon, TargetIcon, BoltIcon, BrainIcon, ClockIcon, BookIcon } from "../components/icons/StatusIcons";

// Particle animation for likes
function createParticleAnimation(emoji: string, x: number, y: number) {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.innerText = emoji;
    const angle = (360 / count) * i;
    const distance = 60 + Math.random() * 40;
    const dx = Math.cos((angle * Math.PI) / 180) * distance;
    const dy = Math.sin((angle * Math.PI) / 180) * distance;

    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      font-size: ${18 + Math.random() * 8}px;
      pointer-events: none;
      z-index: 9999;
      transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
      opacity: 1;
    `;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy - 50}px) scale(1.3) rotate(${Math.random() * 30 - 15}deg)`;
      el.style.opacity = "0";
    });

    setTimeout(() => el.remove(), 800);
  }
}

// Daily Recommendation Rotation
function getDailyRecommendation(recs: any[], username: string) {
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `dailyRec:${username}`;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const { date, mediaId, history } = JSON.parse(stored);
      if (date === today) {
        return recs.find(r => r.media.id === mediaId) || recs[0];
      }
      // New day - pick one not in history
      // Ensure history is array
      const safeHistory = Array.isArray(history) ? history : [];
      const available = recs.filter(r => !safeHistory.includes(r.media.id));
      const chosen = available[0] || recs[0];

      if (chosen) {
        const newHistory = [...safeHistory.slice(-20), chosen.media.id];
        localStorage.setItem(storageKey, JSON.stringify({
          date: today, mediaId: chosen.media.id, history: newHistory
        }));
        return chosen;
      }
    }

    // First run or fallback
    if (recs[0]) {
      localStorage.setItem(storageKey, JSON.stringify({
        date: today, mediaId: recs[0].media.id, history: [recs[0].media.id]
      }));
      return recs[0];
    }
  } catch (e) {
    console.warn("Daily rec error:", e);
  }
  return recs[0];
}

// Snooze Management
const SNOOZE_KEY = "snoozed_anime";
const SNOOZE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadSnoozedIds(): Set<number> {
  try {
    const data = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
    const now = Date.now();
    const active = new Set<number>();

    for (const [id, expiry] of Object.entries(data)) {
      if ((expiry as number) > now) {
        active.add(Number(id));
      }
    }
    return active;
  } catch {
    return new Set();
  }
}

function saveSnooze(mediaId: number) {
  try {
    const data = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
    data[mediaId] = Date.now() + SNOOZE_DURATION;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save snooze:", e);
  }
}

// Build Smart Context
async function buildSmartContext(
  viewer: { name: string },
  currentlyWatching: any[],
  recommendations: any[],
  dailyRec?: any,
  t?: (key: string, opts?: any) => string
): Promise<SmartContext> {
  // Sort currently watching by last updated
  const sortedCurrent = [...currentlyWatching].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );

  const recentAnime = sortedCurrent[0]?.media;

  // Find a recommendation that matches the recent anime
  const relatedRec = recommendations.find(
    (rec) =>
      rec.sources?.includes("current-similar") ||
      rec.media.genres?.some((g: string) =>
        recentAnime?.genres?.includes(g)
      )
  );

  if (recentAnime && relatedRec && recommendations.length > 0) {
    const title = recentAnime.title?.english || recentAnime.title?.romaji || t?.('common.yourAnime') || "your anime";
    return {
      greetingType: "continuity",
      message: t?.('dashboard.context.likedTitle', { title }) || `Since you like ${title}...`,
      featuredAnime: relatedRec?.media || recommendations[0].media,
      reasons: relatedRec?.reasons || recommendations[0].reasons,
    };
  }

  // Fallback to discovery (Daily Rec)
  const topRec = dailyRec || recommendations[0];
  if (topRec) {
    return {
      greetingType: "discovery",
      message: t?.('dashboard.context.welcomeBack', { name: viewer.name }) || `Welcome back, ${viewer.name}`,
      featuredAnime: topRec.media,
      reasons: topRec.reasons,
    };
  }

  // Final fallback
  return {
    greetingType: "discovery",
    message: t?.('dashboard.context.welcome', { name: viewer.name }) || `Welcome, ${viewer.name}`,
    featuredAnime: dailyRec?.media || recommendations[0]?.media,
    reasons: [t?.('dashboard.context.discoverNew') || "Discover new anime"],
  };
}

// Generate dynamic insight cards
function generateInsights(
  viewer: any,
  currentlyWatching: any[],
  paused: any[],
  recommendations: any[],
  actions: { openDetail: (id: number) => void; navigate: (page: string) => void },
  t: (key: string, opts?: any) => string
): { position: number; insight: GridItem }[] {
  const insights: { position: number; insight: GridItem }[] = [];

  // Insight 1: Watching count (Anime am Start)
  if (currentlyWatching.length > 3) {
    insights.push({
      position: 6,
      insight: {
        type: "insight",
        title: t('dashboard.insights.watchingCount', { count: currentlyWatching.length }),
        icon: <BookIcon />,
        description: t('dashboard.insights.finishSuggestion'),
        category: "stats",
        action: {
          label: t('dashboard.insights.viewAll'),
          onClick: () => actions.navigate('library'),
        },
      },
    });
  }

  // Insight 2: Almost there!
  const almostDone = currentlyWatching.find(e => {
    const total = e.media.episodes || 0;
    return total > 0 && e.progress >= total - 2;
  });
  if (almostDone) {
    insights.push({
      position: 12,
      insight: {
        type: "insight",
        title: t('dashboard.insights.almostThere'),
        icon: <TargetIcon />,
        description: t('dashboard.insights.episodesLeft', { title: almostDone.media.title?.english || almostDone.media.title?.romaji, count: almostDone.media.episodes - almostDone.progress }),
        category: "achievement",
        action: {
          label: t('dashboard.insights.finishIt'),
          onClick: () => actions.openDetail(almostDone.media.id),
        },
      },
    });
  }

  // Insight 3: Forgotten gem
  const pausedAnime = paused?.[0];
  if (pausedAnime) {
    insights.push({
      position: 18,
      insight: {
        type: "insight",
        title: t('dashboard.insights.forgottenGem'),
        icon: <ClockIcon />,
        description: t('dashboard.insights.youPaused', { title: pausedAnime.media.title?.english || pausedAnime.media.title?.romaji }),
        category: "suggestion",
        action: {
          label: t('dashboard.insights.resume'),
          onClick: () => actions.openDetail(pausedAnime.media.id),
        },
      },
    });
  }

  // Insight 4: Quick watch (Short Anime)
  const shortAnime = recommendations.find(
    (r) => r.media?.episodes && r.media.episodes <= 13
  );
  if (shortAnime) {
    insights.push({
      position: 22,
      insight: {
        type: "insight",
        title: t('dashboard.insights.quickWatch'),
        icon: <BoltIcon />,
        description: t('dashboard.insights.onlyEpisodes', { title: shortAnime.media.title?.romaji || t('common.anime'), count: shortAnime.media.episodes }),
        category: "suggestion",
        action: {
          label: t('dashboard.insights.checkItOut'),
          onClick: () => actions.openDetail(shortAnime.media.id),
        },
      },
    });
  }

  return insights;
}

// Inject insights into recommendations
function injectInsights(
  recommendations: any[],
  insights: { position: number; insight: GridItem }[]
): GridItem[] {
  const result: GridItem[] = [];
  const insightMap = new Map(insights.map((i) => [i.position, i.insight]));

  recommendations.forEach((rec, index) => {
    result.push({
      type: "media",
      data: rec.media,
      matchScore: Math.round((rec.dreamScore || rec.score || 0) * 100),
      reasons: rec.reasons || [],
    });

    const insight = insightMap.get(index + 1);
    if (insight) {
      result.push(insight);
    }
  });

  return result;
}

// Loading Screen
function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        style={{
          width: "48px",
          height: "48px",
          border: "3px solid rgba(0, 212, 255, 0.2)",
          borderTopColor: "#00d4ff",
          borderRadius: "50%",
        }}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ color: "white", fontSize: "16px", opacity: 0.7 }}
      >
        {t('dashboard.loadingDream')}
      </motion.p>
    </div>
  );
}

export default function DashboardDream({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<{
    recs: DreamRecommendationResult[];
    current: any[];
    paused: any[];
    context: SmartContext;
    viewer: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<number>>(new Set());
  const [listInfo, setListInfo] = useState<Record<number, { status?: string | null; progress?: number; score?: number; entryId?: number | null }>>({});
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  // Dream V4 state
  const [feedbackModal, setFeedbackModal] = useState<{
    media: Media;
    type: "like" | "dislike";
  } | null>(null);
  const [profileInsights, setProfileInsights] = useState<ProfileInsights | null>(null);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);

  // Load dashboard data
  useEffect(() => {
    getLikedMediaIds().then((ids) => setLikedIds(new Set(ids))).catch(() => { });
    getDislikedMediaIds().then((ids) => setDislikedIds(new Set(ids))).catch(() => { });
  }, []);

  useEffect(() => {
    async function init() {
      const viewer = await viewerCached();
      if (!viewer) return;

      setIsLoading(true);
      try {
        // Use Dream Engine instead of V3
        const engine = getDreamEngine() || createDreamEngine();
        const snoozed = loadSnoozedIds();
        setSnoozedIds(snoozed);

        const [recs, lists] = await Promise.all([
          engine.recommend(viewer.name, 50),
          userLists(viewer.id),
        ]);

        // Load profile insights
        const insights = engine.getProfileInsights();
        if (insights) {
          setProfileInsights(insights);
        }

        const map: Record<number, { status?: string | null; progress?: number; score?: number; entryId?: number | null }> = {};
        for (const list of lists?.lists || []) {
          for (const entry of list.entries || []) {
            const m = entry.media;
            const mid = m?.id;
            if (!mid) continue;
            map[mid] = {
              status: entry.status || list.name,
              progress: entry.progress ?? 0,
              score: typeof entry.score === "number" ? entry.score : undefined,
              entryId: entry.id ?? entry.mediaListEntry?.id ?? m?.mediaListEntry?.id ?? null,
            };
          }
        }
        setListInfo(map);

        // Filter out snoozed anime
        const filteredRecs = recs.filter((r: any) => !snoozed.has(r.media.id));

        // Get lists
        const current = lists.lists.find((l: any) => l.name === "Watching")?.entries || [];
        const paused = lists.lists.find((l: any) => l.name === "Paused")?.entries || [];

        // Daily Recommendation
        const dailyRec = getDailyRecommendation(filteredRecs, viewer.name);

        // Build Context
        const context = await buildSmartContext(viewer, current, filteredRecs, dailyRec, t);

        // Exclude featured anime from grid
        const featuredId = context.featuredAnime?.id;
        const gridRecs = featuredId
          ? filteredRecs.filter((r: any) => r.media.id !== featuredId)
          : filteredRecs;

        setData({ recs: gridRecs, current, paused, context, viewer });
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Handle like - show feedback modal for granular reasons
  const handleLike = useCallback((id: number, e: React.MouseEvent) => {
    createParticleAnimation("💖", e.clientX, e.clientY);

    // Find the media object from recommendations
    const rec = data?.recs.find((r) => r.media.id === id);
    if (rec) {
      setFeedbackModal({ media: rec.media, type: "like" });
    } else {
      // Fallback: save directly without modal
      saveFeedback(id, "like");
    }

    setLikedIds((prev) => new Set([...prev, id]));
    setDislikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [data?.recs]);

  // Handle feedback (dislike) - show feedback modal for granular reasons
  const handleFeedback = useCallback((id: number, reason: FeedbackReason) => {
    // If "not_now", snooze instead of showing modal
    if (reason === "not_now") {
      saveSnooze(id);
      setSnoozedIds((prev) => new Set([...prev, id]));
      // Remove from recommendations
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recs: prev.recs.filter((r) => r.media.id !== id),
        };
      });
      return;
    }

    // Find the media object and show modal
    const rec = data?.recs.find((r) => r.media.id === id);
    if (rec) {
      setFeedbackModal({ media: rec.media, type: "dislike" });
    } else {
      // Fallback: save directly without modal
      saveFeedback(id, "dislike", { reason });
    }

    setDislikedIds((prev) => new Set([...prev, id]));
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    // Remove from recommendations (optimistic update)
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recs: prev.recs.filter((r) => r.media.id !== id),
      };
    });
  }, [data?.recs]);

  // Handle snooze
  const handleSnooze = useCallback((id: number) => {
    saveSnooze(id);
    setSnoozedIds((prev) => new Set([...prev, id]));

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recs: prev.recs.filter((r: any) => r.media.id !== id),
      };
    });
  }, []);

  const handleRemoveFromList = useCallback(async (entryId: number, mediaId: number) => {
    try {
      await deleteEntry(entryId);
      setListInfo((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
    } catch (e) {
      console.error("remove from list failed", e);
    }
  }, []);

  // Handle quick add
  const handleQuickAdd = useCallback(async (id: number, status: string) => {
    try {
      const entryId = await saveEntry(id, status);
      setListInfo((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), status, entryId: entryId ?? prev[id]?.entryId ?? null },
      }));
    } catch (e) {
      console.error("quick add failed", e);
    }
  }, []);

  // Handle start watching from header
  const handleStartWatching = useCallback((id: number) => {
    saveEntry(id, "CURRENT").then((entryId) => {
      setListInfo((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), status: "CURRENT", entryId: entryId ?? prev[id]?.entryId ?? null },
      }));
    });
  }, []);

  // Handle add to list from header
  const handleAddToList = useCallback((id: number) => {
    saveEntry(id, "PLANNING").then((entryId) => {
      setListInfo((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), status: "PLANNING", entryId: entryId ?? prev[id]?.entryId ?? null },
      }));
    });
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

  if (isLoading || !data) {
    return <LoadingScreen />;
  }

  // Generate insights and inject into grid
  const insights = generateInsights(data.viewer, data.current, data.paused, data.recs, {
    openDetail: handleOpenDetail,
    navigate: (p) => onNavigate?.(p)
  }, t);
  const gridItems = injectInsights(data.recs, insights);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        paddingBottom: "80px",
      }}
    >
      <SmartContextHeader
        context={data.context}
        onShowDetails={handleOpenDetail}
        onAddToList={handleAddToList}
      />

      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 24px" }}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 800,
                marginBottom: "4px",
              }}
            >
              {t('dashboard.recommendedForYou')}
            </h2>
            <p style={{ opacity: 0.5, fontSize: "14px" }}>
              {t('dashboard.animeBasedOnTaste', { count: data.recs.length })}
            </p>
          </div>
        </motion.div>

        {/* Grid */}
        <LiquidGrid
          items={gridItems}
          onLike={handleLike}
          onFeedback={handleFeedback}
          onQuickAdd={handleQuickAdd}
          onSnooze={handleSnooze}
          onClick={handleOpenDetail}
          listInfo={listInfo}
          likedIds={likedIds}
          dislikedIds={dislikedIds}
          onRemoveFromList={handleRemoveFromList}
          isLoading={false}
        />
      </div>

      {/* Detail View Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <MediaDetailView_dream
            media={selectedMedia}
            title={selectedMedia.title?.english || selectedMedia.title?.romaji || "Unknown"}
            scoreFormat={data.viewer?.mediaListOptions?.scoreFormat}
            onClose={() => setSelectedMedia(null)}
            onSaved={() => setSelectedMedia(null)}
          />
        )}
      </AnimatePresence>

      {/* Dream V4 Feedback Modal */}
      <AnimatePresence>
        {feedbackModal && (
          <FeedbackModalV4
            media={feedbackModal.media}
            feedbackType={feedbackModal.type}
            titleLang="EN"
            onSubmit={async (reasons: GranularReason[]) => {
              const title = feedbackModal.media.title?.english || feedbackModal.media.title?.romaji || "Unknown";

              // Save feedback with granular reasons
              await saveFeedback(feedbackModal.media.id, feedbackModal.type, {
                title,
                reasons,
              });

              // Update Dream profile
              try {
                const engine = getDreamEngine();
                if (engine) {
                  await engine.processFeedback(
                    feedbackModal.media.id,
                    feedbackModal.type,
                    reasons as string[],
                    {
                      title,
                      genres: feedbackModal.media.genres,
                      tags: feedbackModal.media.tags?.map(t => t.name),
                      studios: feedbackModal.media.studios?.nodes?.map(s => s.name),
                      year: feedbackModal.media.startDate?.year,
                      episodes: feedbackModal.media.episodes,
                    }
                  );

                  // Update profile insights
                  const insights = engine.getProfileInsights();
                  if (insights) {
                    setProfileInsights(insights);
                  }
                }
              } catch (err) {
                console.warn("[DashboardDream] Dream engine feedback processing failed:", err);
              }

              setFeedbackModal(null);
            }}
            onSkip={() => {
              // Save basic feedback without reasons
              const title = feedbackModal.media.title?.english || feedbackModal.media.title?.romaji || "Unknown";
              saveFeedback(feedbackModal.media.id, feedbackModal.type, { title });
              setFeedbackModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Dream V4 Profile Insights Panel */}
      <AnimatePresence>
        {showInsightsPanel && profileInsights && (
          <ProfileInsightsPanel
            insights={profileInsights}
            onClose={() => setShowInsightsPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Profile Insights Toggle Button */}
      {profileInsights && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowInsightsPanel(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "12px 20px",
            background: "linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)",
            border: "none",
            borderRadius: 12,
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(0, 212, 255, 0.3)",
            zIndex: 100,
          }}
        >
          <span style={{ fontSize: 18 }}><BrainIcon /></span>
          {t('dashboard.yourProfile')}
        </motion.button>
      )}
    </div>
  );
}
