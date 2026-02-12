import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlinePlus, AiOutlineCheck } from "react-icons/ai";
import { FeedbackPopover, type FeedbackReason } from "./FeedbackPopover";
import { type Media } from "../api/anilist";
import { HeartIcon, ThumbDownIcon } from "./icons/StatusIcons";

// CSS Keyframes for spinner
const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject styles once
if (typeof document !== "undefined" && !document.getElementById("dreamcard-styles")) {
  const style = document.createElement("style");
  style.id = "dreamcard-styles";
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

interface DreamCardProps {
  media: Media;
  reasons?: string[];
  matchScore?: number;
  tags?: string[];
  onFeedback: (id: number, reason: FeedbackReason) => void;
  onQuickAdd: (id: number, status: string) => void;
  onLike: (id: number, e: React.MouseEvent) => void;
  onSnooze: (id: number) => void;
  onClick?: (id: number) => void;
  listStatus?: string | null;
  listProgress?: number;
  listScore?: number;
  listEntryId?: number | null;
  liked?: boolean;
  disliked?: boolean;
  onRemoveFromList?: (entryId: number, mediaId: number) => Promise<void> | void;
}

// Circular Progress Component for Match Score
function CircularProgress({ value, size = 44 }: { value: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#00d4ff" : value >= 60 ? "#fbbf24" : "#94a3b8";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "11px",
        fontWeight: 800,
        color: color,
      }}>
        {value}
      </div>
    </div>
  );
}

// Tooltip Component
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "8px 12px",
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(8px)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "white",
              whiteSpace: "nowrap",
              zIndex: 1000,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {content}
            <div style={{
              position: "absolute",
              bottom: "-4px",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: "8px",
              height: "8px",
              background: "rgba(15, 23, 42, 0.95)",
              borderRight: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  CURRENT: "#22c55e",
  PLANNING: "#3b82f6",
  COMPLETED: "#a855f7",
  PAUSED: "#f59e0b",
  DROPPED: "#ef4444",
  REPEATING: "#22d3ee",
};

function statusLabel(status: string | null | undefined, t: (key: string) => string): string {
  if (!status) return "";
  const map: Record<string, string> = {
    CURRENT: t('media.listStatus.current'),
    PLANNING: t('media.listStatus.planning'),
    COMPLETED: t('media.listStatus.completed'),
    PAUSED: t('media.listStatus.paused'),
    DROPPED: t('media.listStatus.dropped'),
    REPEATING: t('media.listStatus.repeating'),
  };
  return map[String(status).toUpperCase()] || status;
}

export default function DreamCard({
  media,
  reasons = [],
  matchScore = 80,
  onFeedback,
  onQuickAdd,
  onLike,
  onClick,
  listStatus,
  listProgress,
  listScore,
  listEntryId,
  liked = false,
  disliked = false,
  onRemoveFromList,
}: DreamCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [listState, setListState] = useState(() => ({
    status: listStatus ?? media.mediaListEntry?.status ?? null,
    entryId: listEntryId ?? media.mediaListEntry?.id ?? null,
    progress: typeof listProgress === "number" ? listProgress : media.mediaListEntry?.progress ?? 0,
    score: typeof listScore === "number"
      ? listScore
      : (typeof media.mediaListEntry?.score === "number" ? media.mediaListEntry.score : undefined),
  }));
  const [isLiked, setIsLiked] = useState(Boolean(liked));
  const [isDisliked, setIsDisliked] = useState(Boolean(disliked));
  const [isProcessingList, setIsProcessingList] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setListState({
      status: listStatus ?? media.mediaListEntry?.status ?? null,
      entryId: listEntryId ?? media.mediaListEntry?.id ?? null,
      progress: typeof listProgress === "number" ? listProgress : media.mediaListEntry?.progress ?? 0,
      score: typeof listScore === "number"
        ? listScore
        : (typeof media.mediaListEntry?.score === "number" ? media.mediaListEntry.score : undefined),
    });
  }, [listStatus, listProgress, listScore, listEntryId, media.mediaListEntry?.status, media.mediaListEntry?.progress, media.mediaListEntry?.score]);

  useEffect(() => setIsLiked(Boolean(liked)), [liked]);
  useEffect(() => setIsDisliked(Boolean(disliked)), [disliked]);

  // Titel-Fallback
  const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown";
  const cover = media.coverImage?.extraLarge || media.coverImage?.large;
  const statusColor = listState.status ? STATUS_COLORS[listState.status.toUpperCase()] || "#00d4ff" : null;
  const canRemoveFromList = listState.status === "PLANNING" && !!onRemoveFromList && !!(listState.entryId || media.mediaListEntry?.id);
  const isOnList = Boolean(listState.status);

  // Handle dislike with animation
  const handleDislike = async (reason: FeedbackReason) => {
    setIsRemoving(true);
    setIsDisliked(true);
    setIsLiked(false);
    // Short delay for animation then call callback
    setTimeout(() => {
      onFeedback(media.id, reason);
    }, 400);
  };

  const handleQuickAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessingList) return;

    if (isOnList) {
      if (!canRemoveFromList) return;
      setIsProcessingList(true);
      try {
        const entryId = listState.entryId ?? media.mediaListEntry?.id;
        if (entryId) await onRemoveFromList?.(entryId, media.id);
        setListState({ status: null, entryId: null, progress: 0, score: undefined });
      } finally {
        setIsProcessingList(false);
      }
    } else {
      setIsProcessingList(true);
      try {
        await onQuickAdd(media.id, "PLANNING");
        setListState((prev) => ({ ...prev, status: "PLANNING" }));
      } finally {
        setIsProcessingList(false);
      }
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiked) return;
    onLike(media.id, e);
    setIsLiked(true);
    setIsDisliked(false);
  };

  const likedChip = isLiked || isDisliked;

  return (
    <motion.div
      className="dream-card-container"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "2/3",
        borderRadius: "16px",
        zIndex: isHovered || showPopover ? 100 : 1,
      }}
      initial={{ opacity: 1, scale: 1 }}
      animate={isRemoving ? { scale: 0, opacity: 0, rotateZ: -10 } : { opacity: 1, scale: 1 }}
      whileHover={!isRemoving ? { scale: 1.05, y: -8 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onHoverStart={() => !isRemoving && setIsHovered(true)}
      onHoverEnd={() => {
        setIsHovered(false);
        setShowPopover(false);
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "16px",
          overflow: "hidden",
          position: "relative",
          background: "#1e293b",
          boxShadow: isHovered
            ? "0 20px 50px rgba(0,0,0,0.5)"
            : "0 4px 10px rgba(0,0,0,0.2)",
        }}
      >
        {cover && (
          <img
            src={cover}
            alt={title}
            loading="eager"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "filter 0.3s ease, opacity 0.3s ease",
              filter: isHovered ? "brightness(0.3) blur(2px)" : "brightness(0.9)",
              opacity: imageLoaded ? 1 : 0,
            }}
          />
        )}
        {/* Placeholder while loading */}
        {!imageLoaded && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid rgba(0, 212, 255, 0.2)",
              borderTopColor: "#00d4ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
          </div>
        )}

        {/* Overlay unten (Normal State) */}
        <motion.div
          animate={{ opacity: isHovered ? 0 : 1 }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px",
            background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}>
            {/* Circular Match Score */}
            {matchScore > 0 && (
              <CircularProgress value={matchScore} size={40} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                margin: 0, fontSize: "15px", color: "white",
                lineHeight: 1.3, fontWeight: 700,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>
                {title}
              </h3>
              {/* Tags / Reasons with Tooltips */}
              <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                {reasons.slice(0, 2).map((r, i) => (
                  <Tooltip key={i} content={r}>
                    <span style={{
                      fontSize: "10px", padding: "3px 10px", borderRadius: "99px",
                      background: "rgba(0, 212, 255, 0.15)",
                      border: "1px solid rgba(0, 212, 255, 0.3)",
                      backdropFilter: "blur(4px)",
                      color: "rgba(255,255,255,0.9)",
                      cursor: "default",
                    }}>
                      {r.length > 18 ? r.slice(0, 18) + "..." : r}
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Hover Controls */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: "12px"
              }}
            >
              {/* Details Button - Primary Action */}
              {onClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(media.id);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "14px 28px", borderRadius: "99px",
                    background: "#00d4ff",
                    border: "none", color: "#000", fontWeight: 700,
                    cursor: "pointer", fontSize: "15px",
                    boxShadow: "0 4px 20px rgba(0, 212, 255, 0.4)",
                  }}
                >
                  Details
                </button>
              )}

              {/* Secondary Actions Row */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {/* Quick Add Button */}
                <button
                  onClick={handleQuickAction}
                  style={{
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: isOnList ? (canRemoveFromList ? "rgba(46, 204, 113, 0.2)" : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.1)",
                    border: isOnList
                      ? `1px solid ${statusColor ? `${statusColor}80` : "rgba(46, 204, 113, 0.6)"}`
                      : "1px solid rgba(255,255,255,0.2)",
                    color: isOnList ? (canRemoveFromList ? statusColor || "#2ecc71" : "rgba(255,255,255,0.7)") : "white",
                    cursor: isProcessingList || (isOnList && !canRemoveFromList) ? "not-allowed" : "pointer",
                    fontSize: "18px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}
                  title={isOnList ? `${statusLabel(listState.status, t)}${canRemoveFromList ? ` (${t('common.clickToRemove')})` : ""}` : t('common.addToWatchlist')}
                  disabled={isProcessingList || (isOnList && !canRemoveFromList)}
                >
                  {isProcessingList ? (
                    <div style={{
                      width: 18, height: 18,
                      border: "3px solid rgba(255,255,255,0.2)",
                      borderTopColor: "#00d4ff",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }} />
                  ) : isOnList ? <AiOutlineCheck /> : <AiOutlinePlus />}
                </button>

                {/* Like */}

                <button
                  onClick={handleLikeClick}
                  style={{
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: isLiked ? "rgba(255, 107, 107, 0.3)" : "rgba(255, 107, 107, 0.2)", border: "1px solid rgba(255, 107, 107, 0.4)",
                    color: isLiked ? "#fff" : "#ff6b6b", cursor: isLiked ? "not-allowed" : "pointer", fontSize: "18px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isLiked ? "0 0 0 1px rgba(255,107,107,0.5)" : "none"
                  }}
                  title={isLiked ? t('media.alreadyLiked') : t('media.likeThis')}
                  disabled={isLiked}
                >
                  <HeartIcon />
                </button>

                {/* Dislike / Popover Trigger */}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPopover(!showPopover);
                  }}
                  style={{
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: isDisliked ? "rgba(148, 163, 184, 0.25)" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                    color: isDisliked ? "#e2e8f0" : "white", cursor: isDisliked ? "not-allowed" : "pointer", fontSize: "18px",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                  title={isDisliked ? t('media.alreadyDisliked') : t('media.notForMe')}
                  disabled={isDisliked}
                >
                  <ThumbDownIcon />
                </button>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Popover ausserhalb des overflow:hidden divs */}
      <AnimatePresence>
        {showPopover && (
          <FeedbackPopover
            onSelect={(reason) => {
              setShowPopover(false);
              handleDislike(reason);
            }}
            onClose={() => setShowPopover(false)}
          />
        )}
      </AnimatePresence>
    </motion.div >
  );
}
