import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getUnlockedAchievements, getAllAchievements } from '../logic/achievements/achievement-store';
import { ACHIEVEMENTS } from '../logic/achievements/achievement-definitions';
import { syncAchievementsWithHistory } from '../logic/achievements/achievement-engine';
import { viewerCached, userLists } from '../api/anilist';
import type { AchievementDefinition, UnlockedAchievement } from '../logic/achievements/achievement-types';
import { devLog, devWarn, logError } from "@utils/logger";


// Group achievements by category
function getCategories(t: (key: string) => string) {
  return {
    watching: { label: t('achievements.categories.watching'), icon: '📺' },
    genre: { label: t('achievements.categories.genre'), icon: '🎭' },
    streak: { label: t('achievements.categories.streak'), icon: '🔥' },
    special: { label: t('achievements.categories.special'), icon: '✨' },
  };
}

export default function Achievements() {
  const { t } = useTranslation();
  const CATEGORIES = useMemo(() => getCategories(t), [t]);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function load() {
      // In a real app this might be async if stored in a DB
      const unlockedData = getUnlockedAchievements();
      setUnlocked(unlockedData);
      setLoading(false);
    }
    load();
  }, []);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const viewer = await viewerCached();
      if (viewer) {
        const data = await userLists(viewer.id);
        if (data?.lists) {
          // Flatten lists
          const allEntries = [];
          for (const list of data.lists) {
            if (list.entries) {
              allEntries.push(...list.entries);
            }
          }

          const newUnlocks = syncAchievementsWithHistory(allEntries);
          if (newUnlocks.length > 0) {
            // Refresh local state
            setUnlocked(getUnlockedAchievements());
          }
        }
      }
    } catch (e) {
      logError("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const total = ACHIEVEMENTS.length;
    const earned = unlocked.length;
    const percentage = Math.round((earned / total) * 100);

    // Most recent
    const sortedUnlocked = [...unlocked].sort((a, b) => b.unlockedAt - a.unlockedAt);
    const recent = sortedUnlocked.slice(0, 3).map(u => {
      const def = ACHIEVEMENTS.find(a => a.id === u.id);
      return { ...def, ...u };
    }).filter(Boolean);

    return { total, earned, percentage, recent };
  }, [unlocked]);

  if (loading) return null;

  return (
    <div style={{
      padding: '40px 60px',
      color: 'white',
      minHeight: '100vh',
    }}>
      {/* Header Section */}
      <div style={{ marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 900, margin: 0, marginBottom: 8 }}>
            {t('achievements.title')}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            {t('achievements.subtitle')}
          </p>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: 'white',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              opacity: isSyncing ? 0.6 : 1,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isSyncing ? t('achievements.syncing') : t('achievements.syncButton')}
          </button>
        </div>

        {/* Progress Card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '20px 32px',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#00d4ff' }}>{stats.earned}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{t('achievements.unlocked')}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900 }}>{stats.total}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{t('achievements.available')}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#2ed573' }}>{stats.percentage}%</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{t('achievements.completion')}</div>
          </div>
        </div>
      </div>

      {/* Recent Unlocks */}
      {stats.recent.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>🆕</span> {t('achievements.recentlyUnlocked')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {stats.recent.map((achievement: any) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                unlockedAt={achievement.unlockedAt}
                isRecent
              />
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        {Object.entries(CATEGORIES).map(([catKey, catMeta]) => {
          const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === catKey);
          if (categoryAchievements.length === 0) return null;

          return (
            <div key={catKey}>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20 }}>
                  {catMeta.icon}
                </span>
                {catMeta.label}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {categoryAchievements.map(achievement => {
                  const unlockInfo = unlocked.find(u => u.id === achievement.id);
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      unlockedAt={unlockInfo?.unlockedAt}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementCard({
  achievement,
  unlockedAt,
  isRecent
}: {
  achievement: AchievementDefinition;
  unlockedAt?: number;
  isRecent?: boolean;
}) {
  const isUnlocked = !!unlockedAt;
  const { t } = useTranslation();

  return (
    <motion.div
      initial={false}
      whileHover={{ y: -4 }}
      style={{
        background: isUnlocked
          ? 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
          : 'rgba(0,0,0,0.2)',
        border: `1px solid ${isUnlocked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 16,
        padding: 20,
        position: 'relative',
        opacity: isUnlocked ? 1 : 0.5,
        overflow: 'hidden',
      }}
    >
      {/* Glow Effect for Recent/Unlocked */}
      {isRecent && (
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          padding: '4px 12px',
          background: '#00d4ff',
          color: 'black',
          fontSize: 10,
          fontWeight: 800,
          borderBottomLeftRadius: 12,
        }}>
          {t('achievements.new')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Icon Box */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: isUnlocked ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.05)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 28,
          filter: isUnlocked ? 'none' : 'grayscale(100%)',
          border: `1px solid ${isUnlocked ? 'rgba(0, 212, 255, 0.3)' : 'transparent'}`,
        }}>
          {achievement.icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 700,
            fontSize: 16,
            color: isUnlocked ? '#fff' : 'rgba(255,255,255,0.5)',
            marginBottom: 4
          }}>
            {achievement.name}
          </div>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.4
          }}>
            {achievement.hidden && !isUnlocked ? '???' : achievement.description}
          </div>

          {isUnlocked && (
            <div style={{
              marginTop: 12,
              fontSize: 11,
              color: '#00d4ff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {t('achievements.unlockedAt', { date: new Date(unlockedAt!).toLocaleDateString() })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
