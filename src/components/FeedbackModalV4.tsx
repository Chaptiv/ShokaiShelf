/**
 * FeedbackModalV4 - Granular Feedback Collection
 *
 * Collects detailed feedback reasons to improve Dream V4 recommendations.
 * Users can optionally provide reasons or skip for basic feedback.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GranularReason } from '../logic/netrecDream/dream-types';
import { useTranslation } from 'react-i18next';

// =============================================================================
// TYPES
// =============================================================================

interface Media {
  id: number;
  title?: {
    romaji?: string;
    english?: string;
    native?: string;
  } | null;
  coverImage?: {
    large?: string;
    extraLarge?: string;
  } | null;
  genres?: string[] | null;
}

interface FeedbackModalV4Props {
  media: Media;
  feedbackType: 'like' | 'dislike';
  onSubmit: (reasons: GranularReason[]) => Promise<void>;
  onSkip: () => void;
  titleLang?: 'EN' | 'JP' | 'DE';
}

// =============================================================================
// REASON DEFINITIONS
// =============================================================================

interface ReasonOption {
  value: GranularReason;
  label: string;
  icon: string;
}



// =============================================================================
// COMPONENT
// =============================================================================

export default function FeedbackModalV4({
  media,
  feedbackType,
  onSubmit,
  onSkip,
  titleLang = 'EN'
}: FeedbackModalV4Props) {
  const { t } = useTranslation();
  const [selectedReasons, setSelectedReasons] = useState<GranularReason[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const POSITIVE_REASONS: ReasonOption[] = [
    { value: 'plot_amazing', label: t('feedbackV4.positive.plot_amazing'), icon: '📖' },
    { value: 'visual_masterpiece', label: t('feedbackV4.positive.visual_masterpiece'), icon: '✨' },
    { value: 'character_lovable', label: t('feedbackV4.positive.character_lovable'), icon: '💖' },
    { value: 'mood_perfect', label: t('feedbackV4.positive.mood_perfect'), icon: '🎭' },
    { value: 'genre_perfect', label: t('feedbackV4.positive.genre_perfect'), icon: '🎯' },
    { value: 'audio_amazing', label: t('feedbackV4.positive.audio_amazing'), icon: '🎵' },
    { value: 'artstyle_love', label: t('feedbackV4.positive.artstyle_love'), icon: '🎨' },
    { value: 'emotional_impact', label: t('feedbackV4.positive.emotional_impact'), icon: '😢' },
    { value: 'character_development_great', label: t('feedbackV4.positive.character_development_great'), icon: '📈' },
    { value: 'rewatchable', label: t('feedbackV4.positive.rewatchable'), icon: '🔄' },
    { value: 'underrated_gem', label: t('feedbackV4.positive.underrated_gem'), icon: '💎' },
    { value: 'pacing_perfect', label: t('feedbackV4.positive.pacing_perfect'), icon: '⏱️' }
  ];

  const NEGATIVE_REASONS: ReasonOption[] = [
    { value: 'pacing_too_slow', label: t('feedbackV4.negative.pacing_too_slow'), icon: '🐢' },
    { value: 'plot_boring', label: t('feedbackV4.negative.plot_boring'), icon: '😴' },
    { value: 'character_annoying', label: t('feedbackV4.negative.character_annoying'), icon: '😤' },
    { value: 'genre_mismatch', label: t('feedbackV4.negative.genre_mismatch'), icon: '🚫' },
    { value: 'artstyle_dislike', label: t('feedbackV4.negative.artstyle_dislike'), icon: '👎' },
    { value: 'too_dark', label: t('feedbackV4.negative.too_dark'), icon: '🌑' },
    { value: 'animation_poor', label: t('feedbackV4.negative.animation_poor'), icon: '📉' },
    { value: 'plot_predictable', label: t('feedbackV4.negative.plot_predictable'), icon: '🔮' },
    { value: 'too_fanservice', label: t('feedbackV4.negative.too_fanservice'), icon: '🙈' },
    { value: 'pacing_too_fast', label: t('feedbackV4.negative.pacing_too_fast'), icon: '🐇' },
    { value: 'too_slow_start', label: t('feedbackV4.negative.too_slow_start'), icon: '🚀' },
    { value: 'mood_wrong', label: t('feedbackV4.negative.mood_wrong'), icon: '😕' }
  ];

  const reasons = feedbackType === 'like' ? POSITIVE_REASONS : NEGATIVE_REASONS;

  const getTitle = useCallback(() => {
    if (!media.title) return 'Unknown';
    switch (titleLang) {
      case 'JP':
        return media.title.native || media.title.romaji || media.title.english || 'Unknown';
      case 'DE':
        return media.title.english || media.title.romaji || 'Unknown';
      case 'EN':
      default:
        return media.title.english || media.title.romaji || 'Unknown';
    }
  }, [media.title, titleLang]);

  const handleReasonToggle = (reason: GranularReason) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(selectedReasons);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSkip();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          padding: 20
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 32,
            maxWidth: 560,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: 12,
              backgroundImage: media.coverImage?.large
                ? `url(${media.coverImage.large})`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }} />

            <h2 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: 'white',
              marginBottom: 4
            }}>
              {feedbackType === 'like' ? t('feedback.title') : t('feedback.subtitle')}
            </h2>

            <p style={{
              margin: 0,
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: 8
            }}>
              {getTitle()}
            </p>

            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'rgba(255, 255, 255, 0.4)'
            }}>
              {t('feedback.subtitle')}
            </p>
          </div>

          {/* Reason Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 24
          }}>
            {reasons.map(({ value, label, icon }) => {
              const isSelected = selectedReasons.includes(value);

              return (
                <motion.button
                  key={value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleReasonToggle(value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                    background: isSelected
                      ? feedbackType === 'like'
                        ? 'rgba(34, 197, 94, 0.25)'
                        : 'rgba(239, 68, 68, 0.25)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected
                      ? feedbackType === 'like'
                        ? '1px solid rgba(34, 197, 94, 0.6)'
                        : '1px solid rgba(239, 68, 68, 0.6)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: 'white',
                    fontSize: 13,
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Selected Count */}
          {selectedReasons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                textAlign: 'center',
                marginBottom: 16,
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.5)'
              }}
            >
              {selectedReasons.length} {t('feedback.reasonsSelected')}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSkip}
              style={{
                flex: 1,
                padding: 14,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 10,
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              {t('feedback.skip')}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: 14,
                background: feedbackType === 'like'
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                cursor: isSubmitting ? 'wait' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s ease',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? t('feedback.saving') : selectedReasons.length > 0 ? t('feedback.submit') : t('feedback.saveOnly')}
            </motion.button>
          </div>

          {/* Privacy Note */}
          <p style={{
            marginTop: 16,
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.3)',
            textAlign: 'center'
          }}>
            {t('feedback.privacyNote')}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// PROFILE INSIGHTS PANEL
// =============================================================================

interface ProfileInsightsPanelProps {
  insights: {
    bingeProfile: string;
    bingeVelocity: number;
    completionRate: number;
    dropRate: number;
    clusterCount: number;
    topClusters: string[];
    avoidedClusters: string[];
    tolerances: {
      oldAnime: number;
      longSeries: number;
      slowPace: number;
    };
    confidenceLevel: number;
    totalFeedback: number;
    weightInsights: string[];
    preferredStudios: string[];
    whitelistedGenres: string[];
  };
  onClose: () => void;
}

export function ProfileInsightsPanel({ insights, onClose }: ProfileInsightsPanelProps) {
  const { t } = useTranslation();
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        padding: 24,
        overflow: 'auto',
        zIndex: 1000
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'white' }}>{t('profileInsights.title')}</h2>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          {t('common.close')}
        </button>
      </div>

      {/* Confidence Meter */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>{t('profileInsights.confidence')}</span>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{formatPercent(insights.confidenceLevel)}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${insights.confidenceLevel * 100}%` }}
            style={{ height: '100%', background: 'linear-gradient(90deg, #00d4ff 0%, #00ff88 100%)' }}
          />
        </div>
      </div>

      {/* Binge Profile */}
      <div style={{ marginBottom: 20, padding: 16, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 4 }}>{t('profileInsights.watchingStyle')}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{t(`profileInsights.watchingStyles.${insights.bingeProfile}`, insights.bingeProfile)}</div>
        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>{t('profileInsights.episodesPerDay', { value: insights.bingeVelocity.toFixed(1) })}</div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <StatCard label={t('profileInsights.completionRate')} value={`${insights.completionRate}%`} color="#22c55e" />
        <StatCard label={t('profileInsights.dropRate')} value={`${insights.dropRate}%`} color="#ef4444" />
        <StatCard label={t('profileInsights.totalFeedback')} value={insights.totalFeedback.toString()} color="#00d4ff" />
        <StatCard label={t('profileInsights.clustersFound')} value={insights.clusterCount.toString()} color="#a855f7" />
      </div>

      {/* Top Clusters */}
      {insights.topClusters.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 8 }}>{t('profileInsights.preferredVibes')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {insights.topClusters.map(cluster => (
              <span
                key={cluster}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: '#22c55e'
                }}
              >
                {cluster}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Avoided Clusters */}
      {insights.avoidedClusters.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 8 }}>{t('profileInsights.avoidedVibes')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {insights.avoidedClusters.map(cluster => (
              <span
                key={cluster}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: '#ef4444'
                }}
              >
                {cluster}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tolerances */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 12 }}>{t('profileInsights.tolerances')}</div>
        <ToleranceBar label={t('profileInsights.tolerance.oldAnime')} value={insights.tolerances.oldAnime} />
        <ToleranceBar label={t('profileInsights.tolerance.longSeries')} value={insights.tolerances.longSeries} />
        <ToleranceBar label={t('profileInsights.tolerance.slowPace')} value={insights.tolerances.slowPace} />
      </div>

      {/* Weight Insights */}
      {insights.weightInsights.length > 0 && (
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 8 }}>{t('profileInsights.insights')}</div>
          {insights.weightInsights.map((insight, i) => (
            <p key={i} style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 8px 0' }}>
              • {insight}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: 12,
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 10,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function ToleranceBar({ label, value }: { label: string; value: number }) {
  const color = value > 0.6 ? '#22c55e' : value > 0.3 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>{label}</span>
        <span style={{ fontSize: 12, color }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 2 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          style={{ height: '100%', background: color, borderRadius: 2 }}
        />
      </div>
    </div>
  );
}
