// Wrapped Page - The "Story" Experience
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { WrappedData, WrappedPeriodType, WrappedAnimeEntry, AvailablePeriods } from '../logic/wrapped/wrapped-types';
import { generateWrapped, getAvailablePeriods } from '../logic/wrapped/wrapped-engine';
import { shareWrapped, copyWrappedToClipboard } from '../logic/wrapped/share-wrapped';
import { viewerCached, userLists } from '../api/anilist';
import './Wrapped.css';

// -----------------------------------------------------------------------------
// Data Helpers
// -----------------------------------------------------------------------------

function convertToWrappedEntries(lists: any[]): WrappedAnimeEntry[] {
  const entries: WrappedAnimeEntry[] = [];
  if (!lists || !Array.isArray(lists)) return entries;

  for (const list of lists) {
    for (const entry of list.entries || []) {
      const media = entry.media;
      if (!media) continue;
      entries.push({
        mediaId: media.id,
        title: media.title?.english || media.title?.romaji || 'Unknown',
        status: entry.status,
        progress: entry.progress || 0,
        score: entry.score || 0,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        updatedAt: entry.updatedAt || 0,
        episodes: media.episodes,
        genres: media.genres || [],
        studios: media.studios?.nodes?.map((s: any) => s.name) || [],
        coverImage: media.coverImage?.large || null,
      });
    }
  }
  return entries;
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const SLIDE_DURATION = 10000; // Auto-advance time (ms) - optional, disabled for now

export default function Wrapped() {
  const { t, i18n } = useTranslation();
  // State
  const [periodType, setPeriodType] = useState<WrappedPeriodType>('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [wrappedData, setWrappedData] = useState<WrappedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [libraryData, setLibraryData] = useState<any[]>([]);
  const [viewerId, setViewerId] = useState<number | null>(null);

  // Data Loading
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const viewer = await viewerCached();
        setViewerId(viewer.id);
        const data = await userLists(viewer.id);
        setLibraryData(data?.lists || []);
      } catch (error) {
        console.error('[Wrapped] Failed to load library:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const entries = useMemo(() => convertToWrappedEntries(libraryData), [libraryData]);
  const availablePeriods = useMemo<AvailablePeriods>(() => getAvailablePeriods(entries), [entries]);

  // Initial Selection
  useEffect(() => {
    const periods = periodType === 'monthly' ? availablePeriods.monthly : availablePeriods.yearly;
    if (periods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(periods[0]);
    }
  }, [periodType, availablePeriods, selectedPeriod]);

  // Generation
  useEffect(() => {
    if (!selectedPeriod || entries.length === 0 || !viewerId) return;
    setIsLoading(true);
    setCurrentSlide(0);
    generateWrapped(String(viewerId), selectedPeriod, periodType, entries)
      .then(data => {
        setWrappedData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('[Wrapped] Generation failed:', err);
        setIsLoading(false);
      });
  }, [selectedPeriod, periodType, entries, viewerId]);

  // Slides Definition
  const slides = useMemo(() => {
    if (!wrappedData) return [];
    return [
      { id: 'intro', component: <IntroSlide data={wrappedData} /> },
      { id: 'stats', component: <StatsSlide data={wrappedData} /> },
      { id: 'genres', component: <GenresSlide data={wrappedData} /> },
      { id: 'persona', component: <PersonaSlide data={wrappedData} /> }, // New!
      { id: 'highlights', component: <HighlightsSlide data={wrappedData} /> },
      { id: 'share', component: <ShareSlide data={wrappedData} isSharing={isSharing} onShare={async () => { setIsSharing(true); await shareWrapped(wrappedData); setIsSharing(false); }} onCopy={copyWrappedToClipboard} /> },
    ];
  }, [wrappedData, isSharing]);

  // Navigation
  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1);
  }, [currentSlide, slides.length]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) setCurrentSlide(c => c - 1);
  }, [currentSlide]);

  // Keyboard Nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const periods = periodType === 'monthly' ? availablePeriods.monthly : availablePeriods.yearly;

  if (isLoading || !wrappedData) {
    return (
      <div className="wrapped-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="wrapped-bg-blobs">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
        </div>
        <div style={{ zIndex: 10, fontSize: 24, fontWeight: 300, letterSpacing: 2 }}>
          {entries.length === 0 ? t('wrapped.loadingLibrary') : t('wrapped.generatingStory')}
        </div>
      </div>
    );
  }

  return (
    <div className="wrapped-container">
      {/* Background Blobs */}
      <div className="wrapped-bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* Progress Bar */}
      <div className="story-progress-container">
        {slides.map((_, i) => (
          <div key={i} className="story-progress-bar">
            <motion.div
              className="story-progress-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i < currentSlide ? 1 : i === currentSlide ? 1 : 0 }} // Simplified for manual nav
              transition={{ duration: 0.3 }}
            />
          </div>
        ))}
      </div>

      {/* Period Selector (Top Right) */}
      <div className="period-selector">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="select-styled"
        >
          {periods.map(p => (
            <option key={p} value={p} style={{ color: 'black' }}>
              {periodType === 'monthly' ? formatMonth(p, i18n.language) : p}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation Areas (Clickable sides) */}
      <div
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', zIndex: 5, cursor: 'w-resize' }}
        onClick={prevSlide}
      />
      <div
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%', zIndex: 5, cursor: 'e-resize' }}
        onClick={nextSlide}
      />

      {/* Navigation Buttons (Desktop Visuals) */}
      {currentSlide > 0 && (
        <button className="nav-btn nav-prev" onClick={prevSlide}>←</button>
      )}
      {currentSlide < slides.length - 1 && (
        <button className="nav-btn nav-next" onClick={nextSlide}>→</button>
      )}

      {/* Main Slide Content */}
      <div className="wrapped-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}
          >
            {slides[currentSlide].component}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Slide Components
// -----------------------------------------------------------------------------

function formatMonth(period: string, locale: string = 'en-US'): string {
  if (!period) return '';
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function IntroSlide({ data }: { data: WrappedData }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="slide-container">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
        style={{ fontSize: '5rem', marginBottom: '20px' }}
      >
        ✨
      </motion.div>
      <h1 className="slide-title">
        {data.type === 'monthly' ? t('wrapped.yourMonth') : t('wrapped.yourYear')} <br /> {t('wrapped.inAnime')}
      </h1>
      <p className="slide-subtitle">
        {data.type === 'monthly' ? formatMonth(data.period, i18n.language) : data.period}
      </p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ marginTop: 40, fontSize: '1.2rem' }}
      >
        {t('wrapped.readyStory')}
      </motion.div>
    </div>
  );
}

function StatsSlide({ data }: { data: WrappedData }) {
  const { t } = useTranslation();
  return (
    <div className="slide-container">
      <h2 className="slide-title" style={{ fontSize: '2.5rem' }}>{t('wrapped.theNumbers')}</h2>
      <div className="stat-grid">
        <motion.div className="stat-item" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <span style={{ fontSize: '2rem' }}>📺</span>
          <span className="stat-value">{data.episodesWatched}</span>
          <span className="stat-label">{t('wrapped.episodes')}</span>
        </motion.div>
        <motion.div className="stat-item" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <span style={{ fontSize: '2rem' }}>⏱️</span>
          <span className="stat-value">{data.hoursWatched}</span>
          <span className="stat-label">{t('wrapped.hours')}</span>
        </motion.div>
        <motion.div className="stat-item" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <span style={{ fontSize: '2rem' }}>✅</span>
          <span className="stat-value">{data.animeCompleted}</span>
          <span className="stat-label">{t('wrapped.completed')}</span>
        </motion.div>
        <motion.div className="stat-item" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <span style={{ fontSize: '2rem' }}>🎬</span>
          <span className="stat-value">{data.animeStarted}</span>
          <span className="stat-label">{t('wrapped.started')}</span>
        </motion.div>
      </div>
    </div>
  );
}

function GenresSlide({ data }: { data: WrappedData }) {
  const { t } = useTranslation();
  return (
    <div className="slide-container">
      <h2 className="slide-title" style={{ fontSize: '2.5rem' }}>{t('wrapped.yourVibe')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        {data.topGenres.slice(0, 4).map((genre, i) => (
          <motion.div
            key={genre.name}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ delay: i * 0.15 + 0.2 }}
            className="glass-card"
            style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}
          >
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{genre.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ opacity: 0.6 }}>{t('wrapped.shows', { count: genre.count })}</span>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                {genre.percentage}%
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PersonaSlide({ data }: { data: WrappedData }) {
  const { t } = useTranslation();
  if (!data.persona) return null; // Safety check

  return (
    <div className="slide-container">
      <motion.div
        className="persona-avatar"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
      >
        🧞
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div style={{ textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, opacity: 0.7 }}>{t('wrapped.youAre')}</div>
        <div className="persona-name">{data.persona.name}</div>
        <div className="persona-desc">{data.persona.description}</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{ marginTop: 32, padding: '8px 16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, display: 'inline-block' }}
      >
        {t('wrapped.trait', { trait: data.persona.trait })}
      </motion.div>
    </div>
  );
}

function HighlightsSlide({ data }: { data: WrappedData }) {
  const { t } = useTranslation();
  const highlight = data.longestBinge || data.fastestCompletion || data.highestRated;

  return (
    <div className="slide-container">
      <h2 className="slide-title" style={{ fontSize: '2.5rem' }}>{t('wrapped.highlights')}</h2>

      {data.longestBinge && (
        <motion.div className="glass-card" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔥</div>
          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', opacity: 0.7 }}>{t('wrapped.longestBinge')}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '4px 0' }}>{data.longestBinge.anime}</div>
          <div>{t('wrapped.episodesInOneGo', { count: data.longestBinge.episodes })}</div>
        </motion.div>
      )}

      {data.highestRated && (
        <motion.div className="glass-card" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⭐</div>
          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', opacity: 0.7 }}>{t('wrapped.topRated')}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '4px 0' }}>{data.highestRated.anime}</div>
          <div>{t('wrapped.score', { score: data.highestRated.score })}</div>
        </motion.div>
      )}
    </div>
  );
}

function ShareSlide({ data, onShare, onCopy, isSharing }: { data: WrappedData; onShare: () => void; onCopy: () => void; isSharing: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="slide-container">
      <div id="wrapped-share-card" className="glass-card" style={{ background: '#000', border: '1px solid #333' }}>
        <div style={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>SHOKAISHELF WRAPPED</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>
          {data.type === 'monthly' ? formatMonth(data.period, i18n.language) : data.period}
        </div>

        {data.persona && (
          <div style={{ background: '#111', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('wrapped.myPersona')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ec4899' }}>{data.persona.name}</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.episodesWatched}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('wrapped.episodes')}</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.hoursWatched}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('wrapped.hours')}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32 }}>
        <button
          onClick={onShare}
          disabled={isSharing}
          style={{
            padding: '12px 24px',
            borderRadius: 99,
            border: 'none',
            background: 'white',
            color: 'black',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isSharing ? 0.7 : 1
          }}
        >
          {isSharing ? t('wrapped.saving') : t('wrapped.saveImage')}
        </button>
      </div>
    </div>
  );
}