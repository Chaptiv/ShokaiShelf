// ShokaiShelf Miru - Crunchyroll Content Script
// Detects anime playback and sends scrobble events

class CrunchyrollDetector {
  constructor() {
    this.currentMedia = null;
    this.video = null;
    this.watchStartTime = null;
    this.lastReportedProgress = 0;
    this.progressInterval = null;
    this.extractionAttempts = 0;
    this.maxExtractionAttempts = 10;

    this.init();
  }

  init() {
    console.log('[Miru/Crunchyroll] Initializing...');
    this.waitForPlayer();
  }

  waitForPlayer() {
    // Watch for video element
    const observer = new MutationObserver((mutations) => {
      const video = document.querySelector('video');
      if (video && video !== this.video) {
        console.log('[Miru/Crunchyroll] Video element found');
        this.attachToVideo(video);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Check if video already exists
    const existingVideo = document.querySelector('video');
    if (existingVideo) {
      this.attachToVideo(existingVideo);
    }
  }

  attachToVideo(video) {
    if (this.video === video) return;

    this.video = video;
    console.log('[Miru/Crunchyroll] Attaching to video');

    video.addEventListener('play', () => this.onPlay());
    video.addEventListener('pause', () => this.onPause());
    video.addEventListener('ended', () => this.onEnded());
    video.addEventListener('timeupdate', () => this.onTimeUpdate());

    // If already playing
    if (!video.paused) {
      this.onPlay();
    }
  }

  extractMediaInfo() {
    // Try to extract anime title and episode from page
    let title = null;
    let episode = null;
    let season = null;

    // ========================================================================
    // STRATEGY 1: JSON-LD Structured Data (Most Reliable)
    // ========================================================================
    const jsonLdData = this.extractFromJSONLD();
    if (jsonLdData.title) {
      title = jsonLdData.title;
      episode = jsonLdData.episode;
      season = jsonLdData.season;
    }

    // ========================================================================
    // STRATEGY 2: Multi-Language Title Patterns
    // ========================================================================
    if (!title || !episode) {
      const pageTitle = document.title;
      const titlePatterns = [
        // English: "Watch TITLE Episode X - Crunchyroll"
        /^Watch\s+(.+?)\s+(?:Episode|Ep\.?)\s*(\d+)/i,

        // German: "TITLE Folge X anschauen - Crunchyroll"
        /^(.+?)\s+Folge\s+(\d+)\s+(?:anschauen|online)/i,

        // French: "Regarder TITLE Épisode X - Crunchyroll"
        /^Regarder\s+(.+?)\s+Épisode\s+(\d+)/i,

        // Spanish: "Ver TITLE Episodio X - Crunchyroll"
        /^Ver\s+(.+?)\s+Episodio\s+(\d+)/i,

        // Portuguese: "Assistir TITLE Episódio X - Crunchyroll"
        /^Assistir\s+(.+?)\s+Episódio\s+(\d+)/i,

        // Italian: "Guarda TITLE Episodio X - Crunchyroll"
        /^Guarda\s+(.+?)\s+Episodio\s+(\d+)/i,

        // Generic fallback: "TITLE - Episode/Folge/Épisode X"
        /^(.+?)\s+[-|]\s+(?:Episode|Folge|Épisode|Episodio|Episódio)\s+(\d+)/i,

        // Compact format: "TITLE Ep X"
        /^(.+?)\s+(?:Ep\.?|E)\s*(\d+)/i,
      ];

      for (const pattern of titlePatterns) {
        const match = pageTitle.match(pattern);
        if (match) {
          title = match[1].trim();
          episode = parseInt(match[2], 10);
          break;
        }
      }
    }

    // ========================================================================
    // STRATEGY 3: Meta Tags (Open Graph)
    // ========================================================================
    if (!title) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        const content = metaTitle.getAttribute('content') || '';
        // Try all patterns on meta title too
        for (const pattern of [
          /(.+?)\s+(?:Episode|Folge|Épisode|Episodio)\s+(\d+)/i,
          /(.+?)\s+Ep\.?\s*(\d+)/i,
        ]) {
          const match = content.match(pattern);
          if (match) {
            title = match[1].trim();
            episode = parseInt(match[2], 10);
            break;
          }
        }
      }
    }

    // ========================================================================
    // STRATEGY 4: Modern DOM Selectors (2024/2025)
    // ========================================================================
    if (!title) {
      const titleSelectors = [
        // New Crunchyroll Beta selectors
        'h1[data-testid="show-title"]',
        'h4[data-testid="series-title"]',
        'a[data-testid="show-title-link"]',
        '.show-title-link',
        'a[itemprop="url"] h4',

        // Old selectors (fallback)
        '[data-t="show-title"]',
        '.show-title',
        'h1.title',
        '.erc-series-title',

        // Generic fallbacks
        'h1[class*="title"]',
        'h1',
      ];

      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) {
          title = el.textContent.trim();
          break;
        }
      }
    }

    // Episode number from DOM if not found yet
    if (!episode) {
      const episodeSelectors = [
        '[data-testid="episode-number"]',
        '.episode-number',
        'span[class*="episode"]',
      ];

      for (const selector of episodeSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const epMatch = el.textContent?.match(/(\d+)/);
          if (epMatch) {
            episode = parseInt(epMatch[1], 10);
            break;
          }
        }
      }
    }

    // ========================================================================
    // STRATEGY 5: URL Parsing (Last Resort)
    // ========================================================================
    if (!episode) {
      // URL formats: /watch/GUID, /de/watch/GUID, /watch/SERIES/EPISODE
      const urlMatch = window.location.pathname.match(/episode[_-]?(\d+)/i);
      if (urlMatch) {
        episode = parseInt(urlMatch[1], 10);
      }
    }

    // Season from URL or page
    if (!season) {
      const seasonMatch = window.location.pathname.match(/season[_-]?(\d+)/i) ||
                          window.location.search.match(/season=(\d+)/i);
      if (seasonMatch) {
        season = parseInt(seasonMatch[1], 10);
      }
    }

    return {
      title: title || 'Unknown',
      episode: episode || null,
      season: season || null,
      site: 'crunchyroll',
      url: window.location.href,
      duration: this.video ? this.video.duration : null,
    };
  }

  extractFromJSONLD() {
    // Crunchyroll often uses JSON-LD for SEO
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');

        // VideoObject or TVEpisode
        if (data['@type'] === 'VideoObject' || data['@type'] === 'TVEpisode') {
          const title = data.partOfSeries?.name || data.name;
          const episode = data.episodeNumber ? parseInt(data.episodeNumber, 10) : null;
          const season = data.partOfSeason?.seasonNumber ? parseInt(data.partOfSeason.seasonNumber, 10) : null;

          if (title) {
            return { title, episode, season };
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    return { title: null, episode: null, season: null };
  }

  retryExtraction() {
    // Retry extraction for SPA-loaded content
    const mediaInfo = this.extractMediaInfo();

    if (mediaInfo.title === 'Unknown' && this.extractionAttempts < this.maxExtractionAttempts) {
      this.extractionAttempts++;
      console.log(`[Miru/Crunchyroll] Retrying extraction (attempt ${this.extractionAttempts}/${this.maxExtractionAttempts})`);
      setTimeout(() => this.retryExtraction(), 1000);
    } else if (mediaInfo.title !== 'Unknown') {
      console.log('[Miru/Crunchyroll] Successfully extracted:', mediaInfo.title);
      this.currentMedia = mediaInfo;
      this.extractionAttempts = 0;
    } else {
      console.warn('[Miru/Crunchyroll] Failed to extract media info after all attempts');
      this.extractionAttempts = 0;
    }
  }

  onPlay() {
    console.log('[Miru/Crunchyroll] Play');
    this.watchStartTime = Date.now();
    this.currentMedia = this.extractMediaInfo();

    // If extraction failed, start retry mechanism
    if (this.currentMedia.title === 'Unknown') {
      console.log('[Miru/Crunchyroll] Initial extraction failed, starting retry...');
      this.retryExtraction();
    } else {
      console.log('[Miru/Crunchyroll] Extracted:', this.currentMedia.title);
    }

    chrome.runtime.sendMessage({
      type: 'MIRU_PLAY',
      data: this.currentMedia,
    });

    // Start progress reporting
    this.startProgressReporting();
  }

  onPause() {
    console.log('[Miru/Crunchyroll] Pause');
    const watchDuration = this.watchStartTime ? Date.now() - this.watchStartTime : 0;

    chrome.runtime.sendMessage({
      type: 'MIRU_PAUSE',
      data: {
        ...this.currentMedia,
        watchDuration,
        currentTime: this.video?.currentTime || 0,
        duration: this.video?.duration || 0,
      },
    });

    this.stopProgressReporting();
  }

  onEnded() {
    console.log('[Miru/Crunchyroll] Ended');
    const watchDuration = this.watchStartTime ? Date.now() - this.watchStartTime : 0;

    chrome.runtime.sendMessage({
      type: 'MIRU_PROGRESS',
      data: {
        ...this.currentMedia,
        watchDuration,
        progress: 100,
        completed: true,
      },
    });

    this.stopProgressReporting();
  }

  onTimeUpdate() {
    if (!this.video) return;

    const progress = (this.video.currentTime / this.video.duration) * 100;

    // Report at significant milestones (25%, 50%, 75%, 90%)
    const milestones = [25, 50, 75, 90];
    for (const milestone of milestones) {
      if (progress >= milestone && this.lastReportedProgress < milestone) {
        this.lastReportedProgress = milestone;
        this.reportProgress(progress);
        break;
      }
    }
  }

  startProgressReporting() {
    this.stopProgressReporting();

    // Report progress every 2 minutes
    this.progressInterval = setInterval(() => {
      if (this.video && !this.video.paused) {
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.reportProgress(progress);
      }
    }, 120000);
  }

  stopProgressReporting() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  reportProgress(progress) {
    console.log('[Miru/Crunchyroll] Progress:', Math.round(progress) + '%');

    chrome.runtime.sendMessage({
      type: 'MIRU_PROGRESS',
      data: {
        ...this.currentMedia,
        progress: Math.round(progress),
        currentTime: this.video?.currentTime || 0,
        duration: this.video?.duration || 0,
      },
    });
  }
}

// Initialize detector
new CrunchyrollDetector();
