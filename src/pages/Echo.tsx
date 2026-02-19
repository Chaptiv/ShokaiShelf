// ShokaiShelf Echo - Das ultimative Anime-Rückblick Erlebnis
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { EchoData, EchoPeriodType, EchoAnimeEntry, EchoAvailablePeriods, EchoUserProfile } from '../logic/wrapped/echo-types';
import { generateEcho, getEchoAvailablePeriods } from '../logic/wrapped/echo-engine';
import { shareEcho } from '../logic/wrapped/share-echo';
import { viewerCached, userLists } from '../api/anilist';
import './Echo.css';
import appLogo from '../assets/logo.png';
import * as Icons from './EchoIcons';
import { devLog, devWarn, logError } from "@utils/logger";


// =============================================================================
// ICON MAPPINGS
// =============================================================================

function getGenreIcon(name: string) {
  const map: Record<string, React.ReactNode> = {
    'Action': <Icons.SwordIcon />,
    'Adventure': <Icons.MapIcon />,
    'Comedy': <Icons.LaughIcon />,
    'Drama': <Icons.DramaIcon />,
    'Fantasy': <Icons.SparklesIcon />,
    'Horror': <Icons.GhostIcon />,
    'Mystery': <Icons.SearchIcon />,
    'Psychological': <Icons.BrainIcon />,
    'Romance': <Icons.HeartIcon />,
    'Sci-Fi': <Icons.RocketIcon />,
    'Slice of Life': <Icons.CoffeeIcon />,
    'Sports': <Icons.TrophyIcon />,
    'Supernatural': <Icons.GhostIcon />,
    'Thriller': <Icons.SkullIcon />,
    'Mecha': <Icons.RobotIcon />,
    'Music': <Icons.MusicIcon />,
    'Ecchi': <Icons.FlameIcon />,
    'Shounen': <Icons.FireIcon />,
    'Shoujo': <Icons.FlowerIcon />,
    'Seinen': <Icons.TargetIcon />,
    'Josei': <Icons.HeartIcon />,
  };
  return map[name] || <Icons.TvIcon />;
}

function getPersonaIcon(name: string) {
  // Map based on persona name or title
  if (name.includes('Binge')) return <Icons.FireIcon />;
  if (name.includes('Curator')) return <Icons.AwardIcon />;
  if (name.includes('Explorer')) return <Icons.MapIcon />;
  if (name.includes('Romantic')) return <Icons.HeartIcon />;
  if (name.includes('Shonen') || name.includes('Hero')) return <Icons.SwordIcon />;
  if (name.includes('Night Owl')) return <Icons.ClockIcon />;
  if (name.includes('Completionist')) return <Icons.CheckIcon />;
  if (name.includes('Cozy')) return <Icons.CoffeeIcon />;
  return <Icons.TvIcon />;
}

// =============================================================================
// DATA HELPERS
// =============================================================================

function convertToEchoEntries(lists: any[]): EchoAnimeEntry[] {
  const entries: EchoAnimeEntry[] = [];
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
        duration: media.duration || 24,
        genres: media.genres || [],
        studios: media.studios?.nodes?.map((s: any) => s.name) || [],
        coverImage: media.coverImage?.large || media.coverImage?.extraLarge || null,
        bannerImage: media.bannerImage || null,
        popularity: media.popularity || null,
        averageScore: media.averageScore || null,
      });
    }
  }
  return entries;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function Echo() {
  const { t } = useTranslation();
  // State
  const [periodType, setPeriodType] = useState<EchoPeriodType>('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [echoData, setEchoData] = useState<EchoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [libraryData, setLibraryData] = useState<any[]>([]);
  const [user, setUser] = useState<EchoUserProfile | null>(null);

  // Load user and library data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const viewer = await viewerCached();
        if (viewer) {
          setUser({
            id: viewer.id,
            username: viewer.name,
            avatar: viewer.avatar?.large || null,
          });
        }
        const data = await userLists(viewer.id);
        setLibraryData(data?.lists || []);
      } catch (error) {
        logError('[Echo] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const entries = useMemo(() => convertToEchoEntries(libraryData), [libraryData]);
  const availablePeriods = useMemo<EchoAvailablePeriods>(() => getEchoAvailablePeriods(entries), [entries]);

  // Initial period selection
  useEffect(() => {
    const periods = periodType === 'monthly' ? availablePeriods.monthly : availablePeriods.yearly;
    if (periods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(periods[0]);
    }
  }, [periodType, availablePeriods, selectedPeriod]);

  // Generate Echo data
  useEffect(() => {
    if (!selectedPeriod || !user) return;
    // Note: We run generation even if no entries in period, to detect "0 stats" case correctly
    setIsLoading(true);
    setCurrentSlide(0);
    generateEcho(user, selectedPeriod, periodType, entries, entries)
      .then(data => {
        setEchoData(data);
        setIsLoading(false);
      })
      .catch(err => {
        logError('[Echo] Generation failed:', err);
        setIsLoading(false);
      });
  }, [selectedPeriod, periodType, entries, user]);

  // Define slides
  const slides = useMemo(() => {
    if (!echoData) return [];
    if (echoData.stats.totalAnime === 0) return []; // Should be handled by EmptyState check

    const slideList = [
      { id: 'intro', component: <IntroSlide data={echoData} /> },
      { id: 'stats', component: <StatsSlide data={echoData} /> },
      { id: 'top-anime', component: <TopAnimeSlide data={echoData} /> },
      { id: 'genres', component: <GenresSlide data={echoData} /> },
      { id: 'vibe', component: <VibeSlide data={echoData} /> },
    ];

    if (echoData.topStudios.length > 0) {
      slideList.push({ id: 'studio', component: <StudioSlide data={echoData} /> });
    }

    slideList.push({ id: 'pattern', component: <PatternSlide data={echoData} /> });

    if (echoData.hiddenGems.length > 0) {
      slideList.push({ id: 'gems', component: <HiddenGemsSlide data={echoData} /> });
    }

    slideList.push({ id: 'persona', component: <PersonaSlide data={echoData} /> });
    slideList.push({ id: 'facts', component: <FunFactsSlide data={echoData} /> });

    if (echoData.animeOfThePeriod) {
      slideList.push({ id: 'anime-of-period', component: <AnimeOfPeriodSlide data={echoData} /> });
    }

    slideList.push({
      id: 'share',
      component: (
        <ShareSlide
          data={echoData}
          isSharing={isSharing}
          onShare={async () => {
            setIsSharing(true);
            await shareEcho(echoData);
            setIsSharing(false);
          }}
        />
      ),
    });

    return slideList;
  }, [echoData, isSharing]);

  // Navigation
  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1);
  }, [currentSlide, slides.length]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) setCurrentSlide(c => c - 1);
  }, [currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const periods = periodType === 'monthly' ? availablePeriods.monthly : availablePeriods.yearly;

  // Loading state
  if (isLoading) {
    return (
      <div className="echo-container echo-loading">
        <div className="echo-gradient-bg" />
        <motion.div
          className="echo-loading-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="echo-loading-icon"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Icons.SparklesIcon />
          </motion.div>
          <div className="echo-loading-text">
            {t('echo.generating')}
          </div>
        </motion.div>
      </div>
    );
  }

  // Handle Empty State (No Data for Period)
  if (!echoData || echoData.stats.totalAnime === 0) {
    return (
      <div className="echo-container">
        <div className="echo-gradient-bg" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #020617 100%)' }} />

        {/* Header with period selection even on empty state */}
        <div className="echo-header">
          <div className="echo-user">
            {user?.avatar && <img src={user.avatar} alt="" className="echo-user-avatar" crossOrigin="anonymous" />}
            <span className="echo-user-name">{user?.username}</span>
          </div>
          <div className="echo-period-select">
            <button className={`echo-period-btn ${periodType === 'monthly' ? 'active' : ''}`} onClick={() => { setPeriodType('monthly'); setSelectedPeriod(''); }}>{t('echo.monthly')}</button>
            <button className={`echo-period-btn ${periodType === 'yearly' ? 'active' : ''}`} onClick={() => { setPeriodType('yearly'); setSelectedPeriod(''); }}>{t('echo.yearly')}</button>
            {periods.length > 0 && (
              <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="echo-period-dropdown">
                {periods.map(p => <option key={p} value={p}>{periodType === 'monthly' ? formatMonth(p) : p}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="echo-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column', padding: 40 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', marginBottom: 24 }}
          >
            <Icons.TvIcon />
          </motion.div>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>{t('echo.noAnimeWatched')}</h2>
          <p style={{ opacity: 0.6, maxWidth: 400, lineHeight: 1.6 }}>
            {t('echo.noAnimeDesc', { period: periodType === 'monthly' ? formatMonth(selectedPeriod) : selectedPeriod })}
            <br /><br />
            {t('echo.startWatching')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="echo-container">
      {/* Dynamic gradient background */}
      <div className="echo-gradient-bg" style={{
        background: `linear-gradient(135deg, ${echoData.persona.color}22 0%, #0a0a0a 50%, ${echoData.genres[0]?.color || '#6366f1'}22 100%)`
      }} />

      {/* Progress bar */}
      <div className="echo-progress">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`echo-progress-bar ${i <= currentSlide ? 'active' : ''}`}
            onClick={() => setCurrentSlide(i)}
          />
        ))}
      </div>

      {/* Header with user and period */}
      <div className="echo-header">
        <div className="echo-user">
          {echoData.user.avatar && (
            <img src={echoData.user.avatar} alt="" className="echo-user-avatar" crossOrigin="anonymous" />
          )}
          <span className="echo-user-name">{echoData.user.username}</span>
        </div>
        <div className="echo-period-select">
          <button
            className={`echo-period-btn ${periodType === 'monthly' ? 'active' : ''}`}
            onClick={() => { setPeriodType('monthly'); setSelectedPeriod(''); }}
          >
            {t('echo.monthly')}
          </button>
          <button
            className={`echo-period-btn ${periodType === 'yearly' ? 'active' : ''}`}
            onClick={() => { setPeriodType('yearly'); setSelectedPeriod(''); }}
          >
            {t('echo.yearly')}
          </button>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="echo-period-dropdown"
          >
            {periods.map(p => (
              <option key={p} value={p}>
                {periodType === 'monthly' ? formatMonth(p) : p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation areas */}
      <div className="echo-nav-area echo-nav-prev" onClick={prevSlide} />
      <div className="echo-nav-area echo-nav-next" onClick={nextSlide} />

      {/* Navigation buttons */}
      {currentSlide > 0 && (
        <button className="echo-nav-btn echo-nav-btn-prev" onClick={prevSlide}>
          <Icons.CheckIcon /> {/* Using Check as arrow placeholder if needed, but better use inline SVG for arrows or reuse icons */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {currentSlide < slides.length - 1 && (
        <button className="echo-nav-btn echo-nav-btn-next" onClick={nextSlide}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Main content */}
      <div className="echo-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="echo-slide-wrapper"
          >
            {slides[currentSlide]?.component}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide counter */}
      <div className="echo-counter">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatMonth(period: string, locale: string = 'en-US'): string {
  if (!period) return '';
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

// =============================================================================
// SLIDE COMPONENTS
// =============================================================================

function IntroSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  return (
    <div className="echo-slide echo-slide-intro">
      <motion.div
        className="echo-intro-badge"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
      >
        ECHO
      </motion.div>

      <motion.div
        className="echo-intro-user"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {data.user.avatar && (
          <img src={data.user.avatar} alt="" className="echo-intro-avatar" />
        )}
        <h1 className="echo-intro-greeting">
          Hey, {data.user.username}!
        </h1>
      </motion.div>

      <motion.div
        className="echo-intro-period"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <span className="echo-intro-label">{t('echo.yourLabel')}</span>
        <span className="echo-intro-time">
          {data.type === 'monthly' ? formatMonth(data.period) : data.period}
        </span>
        <span className="echo-intro-label">{t('echo.inAnime')}</span>
      </motion.div>

      <motion.div
        className="echo-intro-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {t('echo.tapToContinue')}
      </motion.div>
    </div>
  );
}

function StatsSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  const stats = [
    { value: data.stats.episodesWatched, label: t('echo.episodes'), icon: <Icons.TvIcon />, color: '#8b5cf6' },
    { value: data.stats.hoursWatched, label: t('echo.hours'), icon: <Icons.ClockIcon />, color: '#06b6d4' },
    { value: data.stats.animeCompleted, label: t('echo.completed'), icon: <Icons.CheckIcon />, color: '#22c55e' },
    { value: data.stats.animeStarted, label: t('echo.started'), icon: <Icons.PlayIcon />, color: '#f97316' },
    { value: data.stats.animeDropped, label: t('echo.dropped'), icon: <Icons.XIcon />, color: '#ef4444' },
    { value: data.stats.animePaused, label: t('echo.paused'), icon: <Icons.PauseIcon />, color: '#a855f7' },
    { value: `${data.stats.completionRate}%`, label: t('echo.completion'), icon: <Icons.TargetIcon />, color: '#fbbf24', isPercentage: true },
    { value: Math.round(data.stats.minutesWatched / 60 / 24), label: t('echo.days'), icon: <Icons.CalendarIcon />, color: '#14b8a6', suffix: 'd' },
  ];

  return (
    <div className="echo-slide echo-slide-stats">
      <h2 className="echo-slide-title">{t('echo.theNumbers')}</h2>

      <div className="echo-stats-grid">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="echo-stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 + 0.2 }}
            style={{ borderColor: stat.color + '44' }}
          >
            <span className="echo-stat-emoji" style={{ color: stat.color, fontSize: 24 }}>{stat.icon}</span>
            <motion.span
              className="echo-stat-value"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.08 + 0.35, type: 'spring' }}
            >
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </motion.span>
            <span className="echo-stat-label">{stat.label}</span>
          </motion.div>
        ))}
      </div>

      {data.comparison && (
        <motion.div
          className="echo-comparison"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span className={`echo-comparison-trend ${data.comparison.trend}`}>
            {data.comparison.trend === 'up' ? '↑' : data.comparison.trend === 'down' ? '↓' : '→'}
          </span>
          {data.comparison.message}
        </motion.div>
      )}
    </div>
  );
}

function TopAnimeSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  if (data.topAnime.length === 0) {
    return (
      <div className="echo-slide">
        <h2 className="echo-slide-title">{t('echo.topAnime')}</h2>
        <p>{t('echo.noCompleted')}</p>
      </div>
    );
  }

  return (
    <div className="echo-slide echo-slide-top-anime">
      <h2 className="echo-slide-title">{t('echo.yourTopAnime')}</h2>

      <div className="echo-top-anime-list">
        {data.topAnime.slice(0, 3).map((anime, i) => (
          <motion.div
            key={anime.mediaId}
            className="echo-top-anime-item"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 + 0.2 }}
          >
            <div className="echo-top-anime-rank">#{i + 1}</div>
            {anime.coverImage && (
              <img src={anime.coverImage} alt="" className="echo-top-anime-cover" />
            )}
            <div className="echo-top-anime-info">
              <div className="echo-top-anime-title">{anime.title}</div>
              <div className="echo-top-anime-meta">
                <span className="echo-top-anime-score">★ {anime.score}/10</span>
                <span className="echo-top-anime-eps">{anime.episodes} {t('echo.eps')}</span>
              </div>
              <div className="echo-top-anime-genres">
                {anime.genres.slice(0, 2).join(' • ')}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function GenresSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  return (
    <div className="echo-slide echo-slide-genres">
      <h2 className="echo-slide-title">{t('echo.yourGenreMix')}</h2>

      <div className="echo-genres-list">
        {data.genres.slice(0, 5).map((genre, i) => (
          <motion.div
            key={genre.name}
            className="echo-genre-item"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: '100%' }}
            transition={{ delay: i * 0.1 + 0.2 }}
          >
            <div className="echo-genre-header">
              <span className="echo-genre-emoji" style={{ color: genre.color, fontSize: 18 }}>
                {getGenreIcon(genre.name)}
              </span>
              <span className="echo-genre-name">{genre.name}</span>
              <span className="echo-genre-count">{genre.count}</span>
            </div>
            <div className="echo-genre-bar-bg">
              <motion.div
                className="echo-genre-bar"
                initial={{ width: 0 }}
                animate={{ width: `${genre.percentage}%` }}
                transition={{ delay: i * 0.1 + 0.4, duration: 0.5 }}
                style={{ backgroundColor: genre.color }}
              />
            </div>
            <span className="echo-genre-percent">{genre.percentage}%</span>
          </motion.div>
        ))}
      </div>

      {data.newGenres.length > 0 && (
        <motion.div
          className="echo-new-genres"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className="echo-new-label">{t('echo.newThisPeriod')}</span>
          {data.newGenres.slice(0, 3).map(g => (
            <span key={g} className="echo-new-tag">{g}</span>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function VibeSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  return (
    <div className="echo-slide echo-slide-vibe">
      <motion.div
        className="echo-vibe-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {t('echo.yourDominantMood')}
      </motion.div>

      <motion.div
        className="echo-vibe-mood"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring' }}
        style={{ color: data.genres[0]?.color || '#8b5cf6' }}
      >
        {data.dominantMood}
      </motion.div>

      <motion.div
        className="echo-vibe-variety"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="echo-vibe-variety-label">{t('echo.genreVariety')}</div>
        <div className="echo-vibe-variety-meter">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className={`echo-vibe-variety-dot ${i < data.genreVariety ? 'active' : ''}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7 + i * 0.05 }}
            />
          ))}
        </div>
        <div className="echo-vibe-variety-text">
          {data.genreVariety <= 3 ? t('echo.specialist') : data.genreVariety <= 6 ? t('echo.balanced') : t('echo.explorer')}
        </div>
      </motion.div>
    </div>
  );
}

function StudioSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  const topStudio = data.topStudios[0];
  if (!topStudio) return null;

  return (
    <div className="echo-slide echo-slide-studio">
      <h2 className="echo-slide-title">{t('echo.favoriteStudio')}</h2>

      <motion.div
        className="echo-studio-name"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {topStudio.name}
      </motion.div>

      <motion.div
        className="echo-studio-count"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {t('echo.animeWatched', { count: topStudio.count })}
      </motion.div>

      <div className="echo-studio-anime-grid">
        {topStudio.topAnime.slice(0, 3).map((anime, i) => (
          <motion.div
            key={i}
            className="echo-studio-anime-item"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 + 0.5 }}
          >
            {anime.coverImage ? (
              <img src={anime.coverImage} alt="" className="echo-studio-anime-cover" />
            ) : (
              <div className="echo-studio-anime-placeholder" />
            )}
            <div className="echo-studio-anime-title">{anime.title}</div>
          </motion.div>
        ))}
      </div>

      {data.studioLoyalty > 30 && (
        <motion.div
          className="echo-studio-loyalty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          {t('echo.studioLoyalty', { percent: data.studioLoyalty })}
        </motion.div>
      )}
    </div>
  );
}

function PatternSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  return (
    <div className="echo-slide echo-slide-pattern">
      <h2 className="echo-slide-title">{t('echo.whenYouWatch')}</h2>

      <div className="echo-pattern-stats">
        <motion.div
          className="echo-pattern-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="echo-pattern-emoji" style={{ fontSize: 24 }}><Icons.ClockIcon /></span>
          <span className="echo-pattern-label">{t('echo.peakHour')}</span>
          <span className="echo-pattern-value">{formatHour(data.watchPattern.peakHour)}</span>
        </motion.div>

        <motion.div
          className="echo-pattern-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className="echo-pattern-emoji" style={{ fontSize: 24 }}><Icons.CalendarIcon /></span>
          <span className="echo-pattern-label">{t('echo.peakDay')}</span>
          <span className="echo-pattern-value">{data.watchPattern.peakDay}</span>
        </motion.div>

        <motion.div
          className="echo-pattern-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <span className="echo-pattern-emoji" style={{ fontSize: 24 }}><Icons.FireIcon /></span>
          <span className="echo-pattern-label">{t('echo.longestStreak')}</span>
          <span className="echo-pattern-value">{t('echo.streakDays', { count: data.watchPattern.bingeStreak })}</span>
        </motion.div>
      </div>

      {data.watchPattern.nightOwlScore > 40 && (
        <motion.div
          className="echo-pattern-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
        >
          <Icons.ClockIcon /> {t('echo.nightOwlScore', { percent: data.watchPattern.nightOwlScore })}
        </motion.div>
      )}

      {data.watchPattern.weekendWarrior && (
        <motion.div
          className="echo-pattern-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: 'spring' }}
        >
          <Icons.TargetIcon /> {t('echo.weekendWarrior')}
        </motion.div>
      )}
    </div>
  );
}

function HiddenGemsSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  if (data.hiddenGems.length === 0) return null;

  return (
    <div className="echo-slide echo-slide-gems">
      <h2 className="echo-slide-title">{t('echo.hiddenGems')}</h2>
      <p className="echo-slide-subtitle">{t('echo.underratedLoved')}</p>

      <div className="echo-gems-list">
        {data.hiddenGems.map((gem, i) => (
          <motion.div
            key={gem.mediaId}
            className="echo-gem-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 + 0.2 }}
          >
            {gem.coverImage && (
              <img src={gem.coverImage} alt="" className="echo-gem-cover" />
            )}
            <div className="echo-gem-info">
              <div className="echo-gem-title">{gem.title}</div>
              <div className="echo-gem-scores">
                <span className="echo-gem-your-score">{t('echo.yourScore', { score: gem.yourScore })}</span>
                <span className="echo-gem-avg-score">{t('echo.avgScore', { score: (gem.averageScore / 10).toFixed(1) })}</span>
              </div>
              <div className="echo-gem-popularity">
                {t('echo.topPopularity', { percent: Math.round((gem.popularity / 100000) * 100) })}
              </div>
            </div>
            <div className="echo-gem-badge">💎</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PersonaSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  return (
    <div className="echo-slide echo-slide-persona">
      <motion.div
        className="echo-persona-emoji"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        style={{ backgroundColor: data.persona.color + '33', color: data.persona.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}
      >
        {getPersonaIcon(data.persona.name)}
      </motion.div>

      <motion.div
        className="echo-persona-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {t('echo.youAre')}
      </motion.div>

      <motion.h2
        className="echo-persona-name"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ color: data.persona.color }}
      >
        {data.persona.name}
      </motion.h2>

      <motion.div
        className="echo-persona-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {data.persona.title}
      </motion.div>

      <motion.p
        className="echo-persona-desc"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {data.persona.description}
      </motion.p>

      <motion.div
        className="echo-persona-traits"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {data.persona.traits.map((trait, i) => (
          <span
            key={trait}
            className="echo-persona-trait"
            style={{ borderColor: data.persona.color }}
          >
            {trait}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function FunFactsSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  return (
    <div className="echo-slide echo-slide-facts">
      <h2 className="echo-slide-title">{t('echo.funFacts')}</h2>

      <div className="echo-facts-list">
        {data.funFacts.slice(0, 4).map((fact, i) => (
          <motion.div
            key={i}
            className="echo-fact-item"
            initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 + 0.2 }}
          >
            <span className="echo-fact-bullet">→</span>
            {fact}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AnimeOfPeriodSlide({ data }: { data: EchoData }) {
  const { t } = useTranslation();
  const anime = data.animeOfThePeriod;
  if (!anime) return null;

  return (
    <div className="echo-slide echo-slide-aotm">
      <motion.div
        className="echo-aotm-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {data.type === 'monthly' ? t('echo.animeOfMonth') : t('echo.animeOfYear')}
      </motion.div>

      <motion.div
        className="echo-aotm-cover-wrapper"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring' }}
      >
        {anime.coverImage && (
          <img src={anime.coverImage} alt="" className="echo-aotm-cover" />
        )}        <div className="echo-aotm-score">★ {anime.score}</div>
      </motion.div>

      <motion.h2
        className="echo-aotm-title"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {anime.title}
      </motion.h2>

      <motion.p
        className="echo-aotm-reason"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {anime.reason}
      </motion.p>
    </div>
  );
}

function ShareSlide({ data, isSharing, onShare }: { data: EchoData; isSharing: boolean; onShare: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="echo-slide echo-slide-share">
      {/* The shareable card */}
      <div id="echo-share-card" className="echo-share-card">
        <div className="echo-share-header">
          <div className="echo-share-brand">
            <img src={appLogo} alt="Logo" className="echo-share-logo-img" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span className="echo-share-brand-text">ShokaiShelf Echo</span>
          </div>
          <div className="echo-share-period">
            {data.type === 'monthly' ? formatMonth(data.period, i18n.language) : data.period}
          </div>
        </div>

        <div className="echo-share-user">
          {data.user.avatar && (
            <img
              src={data.user.avatar}
              alt=""
              className="echo-share-avatar"
            />
          )}
          <div className="echo-share-username">{data.user.username}</div>
        </div>

        <div className="echo-share-persona">
          <span className="echo-share-persona-emoji" style={{ color: data.persona.color, fontSize: 32, display: 'flex' }}>
            {getPersonaIcon(data.persona.name)}
          </span>
          <span className="echo-share-persona-name">{data.persona.name}</span>
        </div>

        <div className="echo-share-stats">
          <div className="echo-share-stat">
            <div className="echo-share-stat-value">{data.stats.episodesWatched}</div>
            <div className="echo-share-stat-label">{t('echo.episodes')}</div>
          </div>
          <div className="echo-share-stat">
            <div className="echo-share-stat-value">{data.stats.hoursWatched}h</div>
            <div className="echo-share-stat-label">{t('echo.hours')}</div>
          </div>
          <div className="echo-share-stat">
            <div className="echo-share-stat-value">{data.stats.animeCompleted}</div>
            <div className="echo-share-stat-label">{t('echo.completed')}</div>
          </div>
        </div>

        {data.topAnime.length > 0 && (
          <div className="echo-share-top">
            <div className="echo-share-top-label">{t('echo.topAnime')}</div>
            <div className="echo-share-top-covers">
              {data.topAnime.slice(0, 3).map((anime, i) => (
                anime.coverImage && (
                  <img
                    key={anime.mediaId}
                    src={anime.coverImage}
                    alt=""
                    className="echo-share-top-cover"
                    style={{ zIndex: 3 - i }}
                  />
                )
              ))}
            </div>
          </div>
        )}

        <div className="echo-share-genres">
          {data.genres.slice(0, 3).map(g => (
            <span key={g.name} className="echo-share-genre" style={{ backgroundColor: g.color + '44', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: g.color, fontSize: 14, display: 'flex' }}>{getGenreIcon(g.name)}</span> {g.name}
            </span>
          ))}
        </div>

        {data.longestBinge && (
          <div className="echo-share-extra">
            🔥 {t('echo.longestStreak')}: {data.longestBinge.anime} ({data.longestBinge.episodes} {t('echo.eps')})
          </div>
        )}

        {/* Removed Footer URL */}
      </div>

      {/* Share button */}
      <motion.button
        className="echo-share-btn"
        onClick={onShare}
        disabled={isSharing}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isSharing ? t('echo.saving') : t('echo.saveShare')}
      </motion.button>

      <p className="echo-share-hint">
        {t('echo.saveImage')}
      </p>
    </div>
  );
}