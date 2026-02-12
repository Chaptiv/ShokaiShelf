import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import DreamCard from "./DreamCard";
import InsightCard from "./InsightCard";
import { type Media } from "../api/anilist";
import { type FeedbackReason } from "./FeedbackPopover";

// Types for Grid Items
export type GridItem =
  | { type: "media"; data: Media; matchScore: number; reasons: string[] }
  | { type: "insight"; title: string; icon: React.ReactNode; description: string; category?: "stats" | "suggestion" | "achievement"; action?: { label: string; onClick: () => void } };

interface LiquidGridProps {
  items: GridItem[];
  onFeedback: (id: number, reason: FeedbackReason) => void;
  onLike: (id: number, e: React.MouseEvent) => void;
  onQuickAdd: (id: number, status: string) => void;
  onSnooze: (id: number) => void;
  onClick?: (id: number) => void;
  isLoading?: boolean;
  listInfo?: Record<number, { status?: string | null; progress?: number; score?: number; entryId?: number | null }>;
  likedIds?: Set<number> | number[];
  dislikedIds?: Set<number> | number[];
  onRemoveFromList?: (entryId: number, mediaId: number) => void;
}

// Responsive hook - returns column count and gap
function useResponsiveGrid(containerWidth: number) {
  const config = useMemo(() => {
    if (containerWidth < 640) {
      return { minItemWidth: 150, gap: 12 };
    } else if (containerWidth < 1024) {
      return { minItemWidth: 200, gap: 16 };
    } else if (containerWidth < 1400) {
      return { minItemWidth: 240, gap: 20 };
    } else {
      return { minItemWidth: 280, gap: 24 };
    }
  }, [containerWidth]);

  const columns = useMemo(() => {
    if (containerWidth <= 0) return 4;
    const { minItemWidth, gap } = config;
    const cols = Math.floor((containerWidth + gap) / (minItemWidth + gap));
    return Math.max(1, cols);
  }, [containerWidth, config]);

  return { columns, gap: config.gap, minItemWidth: config.minItemWidth };
}

// Shimmer Loading Card
function ShimmerCard() {
  return (
    <div style={{
      width: "100%",
      aspectRatio: "2/3",
      borderRadius: "16px",
      background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

// Inline CSS for shimmer animation
const shimmerStyles = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// Estimated row height based on card aspect ratio (2/3) + gap
const ESTIMATED_ROW_HEIGHT = 420;

export default function LiquidGrid({
  items,
  onFeedback,
  onLike,
  onQuickAdd,
  onSnooze,
  onClick,
  isLoading = false,
  listInfo,
  likedIds,
  dislikedIds,
  onRemoveFromList,
}: LiquidGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const { columns, gap, minItemWidth } = useResponsiveGrid(containerWidth);

  // Measure container width
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(parent);
    setContainerWidth(parent.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Memoize sets and maps
  const likedSet = useMemo(() => {
    if (!likedIds) return new Set<number>();
    return likedIds instanceof Set ? likedIds : new Set(likedIds);
  }, [likedIds]);

  const dislikedSet = useMemo(() => {
    if (!dislikedIds) return new Set<number>();
    return dislikedIds instanceof Set ? dislikedIds : new Set(dislikedIds);
  }, [dislikedIds]);

  const infoMap = useMemo(() => {
    const map = new Map<number, { status?: string | null; progress?: number; score?: number; entryId?: number | null }>();
    if (!listInfo) return map;
    for (const [id, info] of Object.entries(listInfo)) {
      map.set(Number(id), info);
    }
    return map;
  }, [listInfo]);

  // Group items into rows
  const rows = useMemo(() => {
    const result: GridItem[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      result.push(items.slice(i, i + columns));
    }
    return result;
  }, [items, columns]);

  // Calculate row height dynamically
  const estimateSize = useCallback(() => {
    if (containerWidth <= 0 || columns <= 0) return ESTIMATED_ROW_HEIGHT;
    const itemWidth = (containerWidth - gap * (columns - 1)) / columns;
    // Card aspect ratio is 2/3, so height = width * 1.5
    const cardHeight = itemWidth * 1.5;
    return cardHeight + gap;
  }, [containerWidth, columns, gap]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: isLoading ? 3 : rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 2,
  });

  // Loading shimmer rows
  const shimmerRows = useMemo(() => {
    return Array.from({ length: 3 }).map((_, rowIdx) =>
      Array.from({ length: columns }).map((_, colIdx) => ({ rowIdx, colIdx }))
    );
  }, [columns]);

  return (
    <>
      {/* Inject shimmer keyframes */}
      <style>{shimmerStyles}</style>

      <div
        ref={parentRef}
        style={{
          height: "100%",
          overflow: "auto",
          paddingBottom: "60px",
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                  height: "100%",
                }}
              >
                <AnimatePresence mode="popLayout">
                  {isLoading ? (
                    // Show shimmer loading state
                    shimmerRows[virtualRow.index]?.map((_, colIdx) => (
                      <motion.div
                        key={`shimmer-${virtualRow.index}-${colIdx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: colIdx * 0.05 }}
                      >
                        <ShimmerCard />
                      </motion.div>
                    ))
                  ) : (
                    // Show actual items
                    rows[virtualRow.index]?.map((item, colIdx) => {
                      if (item.type === "insight") {
                        return (
                          <motion.div
                            key={`insight-${virtualRow.index}-${colIdx}`}
                            layout
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <InsightCard
                              title={item.title}
                              description={item.description}
                              icon={item.icon}
                              category={item.category || "stats"}
                              action={item.action}
                            />
                          </motion.div>
                        );
                      }

                      return (
                        <motion.div
                          key={item.data.id}
                          layout
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <DreamCard
                            media={item.data}
                            matchScore={item.matchScore}
                            reasons={item.reasons}
                            onFeedback={onFeedback}
                            onLike={onLike}
                            onQuickAdd={onQuickAdd}
                            onSnooze={onSnooze}
                            onClick={onClick}
                            listStatus={infoMap.get(item.data.id)?.status ?? item.data.mediaListEntry?.status}
                            listProgress={infoMap.get(item.data.id)?.progress ?? item.data.mediaListEntry?.progress}
                            listScore={infoMap.get(item.data.id)?.score ?? item.data.mediaListEntry?.score}
                            listEntryId={infoMap.get(item.data.id)?.entryId ?? item.data.mediaListEntry?.id}
                            liked={likedSet.has(item.data.id)}
                            disliked={dislikedSet.has(item.data.id)}
                            onRemoveFromList={onRemoveFromList}
                          />
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
