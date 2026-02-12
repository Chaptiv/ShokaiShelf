// Offline Indicator - Shows offline status and pending sync count
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { syncManager } from '../logic/offline/sync-manager';

interface OfflineIndicatorProps {
  position?: 'top-right' | 'bottom-right' | 'bottom-left';
}

export function OfflineIndicator({ position = 'bottom-right' }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Set up listeners
    syncManager.setOnOnlineStatusChange(setIsOnline);
    syncManager.setOnQueueUpdate(setPendingCount);

    // Get initial state
    const state = syncManager.getState();
    setIsOnline(state.isOnline);
    setPendingCount(state.pendingCount);

    // Start auto-sync
    syncManager.startAutoSync();

    return () => {
      syncManager.stopAutoSync();
    };
  }, []);

  // Don't show if online and no pending items
  if (isOnline && pendingCount === 0) return null;

  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: 16, right: 16 },
    'bottom-right': { bottom: 80, right: 16 },
    'bottom-left': { bottom: 80, left: 16 },
  };

  const handleForceSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    await syncManager.forceSync();
    setIsSyncing(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{
          position: 'fixed',
          zIndex: 1000,
          ...positionStyles[position],
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(24, 24, 27, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 12,
            border: `1px solid ${isOnline ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Status dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isOnline ? '#eab308' : '#ef4444',
              animation: isSyncing ? 'pulse 1s infinite' : undefined,
            }}
          />

          {/* Status text */}
          <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' }}>
            {!isOnline && 'Offline'}
            {isOnline && pendingCount > 0 && (
              <>
                {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
              </>
            )}
          </span>

          {/* Sync button */}
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button
              onClick={handleForceSync}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Sync
            </button>
          )}
        </div>

        {/* Pulse animation */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}

export default OfflineIndicator;
