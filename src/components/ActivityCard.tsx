// src/components/ActivityCard.tsx
// Enhanced Activity Card mit Likes, Replies und User Hover

import React, { useState } from "react";
import { motion } from "framer-motion";
import tokens from "@shingen/tokens";
import { useTranslation } from "react-i18next";
import {
  toggleLike,
  fetchActivityReplies,
  saveActivityReply,
  type ActivityEntry,
  type ActivityReply,
} from "@api/anilist";
import { MdFavorite, MdFavoriteBorder, MdComment, MdSend } from "react-icons/md";
// Simple HTML sanitization (strip dangerous tags)
const sanitizeAniListHTML = (html: string) =>
  html?.replace(/<script[^>]*>.*?<\/script>/gi, "") ?? "";

interface Props {
  activity: ActivityEntry;
  onMediaClick?: (mediaId: number) => void;
}

export default function ActivityCard({ activity, onMediaClick }: Props) {
  const { t } = useTranslation();
  const [isLiked, setIsLiked] = useState(activity.isLiked || false);
  const [likeCount, setLikeCount] = useState(activity.likeCount || 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ActivityReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [posting, setPosting] = useState(false);

  const handleLike = async () => {
    const prevLiked = isLiked;
    const prevCount = likeCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

    try {
      await toggleLike(activity.id, "ACTIVITY");
    } catch (error) {
      console.error("Failed to toggle like:", error);
      // Revert on error
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  const loadReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }

    setLoadingReplies(true);
    try {
      const data = await fetchActivityReplies(activity.id);
      setReplies(data);
      setShowReplies(true);
    } catch (error) {
      console.error("Failed to load replies:", error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;

    setPosting(true);
    try {
      const newReply = await saveActivityReply(activity.id, replyText);
      setReplies([...replies, newReply]);
      setReplyText("");
    } catch (error) {
      console.error("Failed to post reply:", error);
    } finally {
      setPosting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return t("common.justNow");
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const isTextActivity = activity.type === "TextActivity";

  // Status text für ListActivity
  const getStatusText = () => {
    if (!activity.status) return "";

    const statusMap: Record<string, string> = {
      completed: t("social.activityStatus.completed"),
      "watched episode": t("social.activityStatus.watchedEpisode", { count: activity.progress }),
      "plans to watch": t("social.activityStatus.plansToWatch"),
      dropped: t("social.activityStatus.dropped"),
      paused: t("social.activityStatus.paused"),
      rewatched: t("social.activityStatus.rewatched"),
    };

    return statusMap[activity.status] || activity.status;
  };

  const title = activity.media?.title?.english
    || activity.media?.title?.romaji
    || activity.media?.title?.native
    || (activity.media?.id ? `Anime #${activity.media.id}` : t("common.unknown"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 20,
        background: tokens.colors.glass,
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        border: `1px solid ${tokens.colors.glassBorder}`,
        borderLeft: isTextActivity ? `4px solid ${tokens.colors.accent}` : undefined,
      }}
    >
      {/* User Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <img
          src={activity.user?.avatar?.large || ""}
          alt={activity.user?.name || ""}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            objectFit: "cover",
            cursor: "pointer",
          }}
        />
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            {activity.user?.name}
          </span>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {formatTime(activity.createdAt)}
          </div>
        </div>
      </div>

      {/* Content */}
      {isTextActivity ? (
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            marginBottom: 16,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeAniListHTML(activity.text) }}
        />
      ) : (
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          {activity.media?.coverImage?.large && (
            <img
              src={activity.media.coverImage.large}
              alt=""
              onClick={() => activity.media?.id && onMediaClick?.(activity.media.id)}
              style={{
                width: 80,
                height: 110,
                objectFit: "cover",
                borderRadius: 8,
                flexShrink: 0,
                cursor: onMediaClick ? "pointer" : "default",
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 4 }}>
              {getStatusText()}
            </div>
            <div
              onClick={() => activity.media?.id && onMediaClick?.(activity.media.id)}
              style={{
                fontSize: 16,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                cursor: onMediaClick ? "pointer" : "default",
                textDecoration: onMediaClick ? "underline" : "none",
              }}
            >
              {title}
            </div>
            {activity.media?.format && (
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                {t(`media.format.${activity.media.format}`, { defaultValue: activity.media.format })} • {activity.media.episodes
                  ? t("media.episodesCount", { count: activity.media.episodes })
                  : t("media.episodesUnknown")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div
        style={{
          display: "flex",
          gap: 24,
          paddingTop: 12,
          borderTop: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        <button
          onClick={handleLike}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isLiked ? "#ff6b9d" : "rgba(255,255,255,0.6)",
            fontWeight: 600,
            fontSize: 14,
            padding: 0,
            transition: "color 0.2s",
          }}
        >
          {isLiked ? <MdFavorite size={20} /> : <MdFavoriteBorder size={20} />}
          {likeCount > 0 && likeCount}
        </button>

        <button
          onClick={loadReplies}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: showReplies ? tokens.colors.accent : "rgba(255,255,255,0.6)",
            fontWeight: 600,
            fontSize: 14,
            padding: 0,
            transition: "color 0.2s",
          }}
        >
          <MdComment size={20} />
          {(activity.replyCount || 0) > 0 && activity.replyCount}
        </button>
      </div>

      {/* Replies Section */}
      {showReplies && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: `1px solid rgba(255,255,255,0.06)`,
          }}
        >
          {loadingReplies ? (
            <div style={{ textAlign: "center", padding: 16, opacity: 0.6 }}>
              {t("social.loadingComments")}
            </div>
          ) : (
            <>
              {replies.length === 0 && (
                <div style={{ textAlign: "center", padding: 16, opacity: 0.5, fontSize: 13 }}>
                  {t("social.noComments")}
                </div>
              )}

              {replies.map((reply) => (
                <div
                  key={reply.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <img
                    src={reply.user.avatar?.large || ""}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        {reply.user.name}
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.5 }}>
                        {formatTime(reply.createdAt)}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}
                      dangerouslySetInnerHTML={{ __html: sanitizeAniListHTML(reply.text) }}
                    />
                  </div>
                </div>
              ))}

              {/* Quick Reply */}
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <input
                  type="text"
                  placeholder={t("social.replyPlaceholder")}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid rgba(255,255,255,0.1)`,
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleReply}
                  disabled={posting || !replyText.trim()}
                  style={{
                    padding: "12px 16px",
                    background: tokens.colors.accent,
                    border: "none",
                    borderRadius: 8,
                    cursor: posting || !replyText.trim() ? "not-allowed" : "pointer",
                    opacity: posting || !replyText.trim() ? 0.5 : 1,
                    color: "#000",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <MdSend size={18} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
