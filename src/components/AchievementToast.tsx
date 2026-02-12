// Achievement Toast Component - Shows when achievement is unlocked
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AchievementDefinition } from '../logic/achievements/achievement-types';

interface AchievementToastProps {
  achievement: AchievementDefinition | null;
  onClose: () => void;
}

export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  return (
    <AnimatePresence>
      {isVisible && achievement && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 24px',
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: 16,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 60px rgba(251, 191, 36, 0.15)',
            }}
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', damping: 12 }}
              style={{
                fontSize: 40,
                lineHeight: 1,
              }}
            >
              {achievement.icon}
            </motion.div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(251, 191, 36, 0.9)',
                }}
              >
                Achievement Unlocked!
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'white',
                }}
              >
                {achievement.name}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                style={{
                  fontSize: 13,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {achievement.description}
              </motion.div>
            </div>

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: 8,
                marginLeft: 8,
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </motion.button>
          </div>

          {/* Sparkle effects */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: 2 }}
            style={{
              position: 'absolute',
              top: -10,
              left: -10,
              right: -10,
              bottom: -10,
              background: 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
              pointerEvents: 'none',
              borderRadius: 20,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Achievement Toast Manager - Handles queue of achievements
interface AchievementToastManagerProps {
  queue: AchievementDefinition[];
  onRemove: (index: number) => void;
}

export function AchievementToastManager({ queue, onRemove }: AchievementToastManagerProps) {
  const currentAchievement = queue[0] ?? null;

  return (
    <AchievementToast
      achievement={currentAchievement}
      onClose={() => onRemove(0)}
    />
  );
}

// Hook for achievement notifications
export function useAchievementToasts() {
  const [queue, setQueue] = useState<AchievementDefinition[]>([]);

  const addToast = (achievement: AchievementDefinition) => {
    setQueue(prev => [...prev, achievement]);
  };

  const removeToast = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  return { queue, addToast, removeToast };
}

export default AchievementToast;
