// ShokaiShelf Miru - AniWorld Content Script
// Detects anime playback on AniWorld.to (German anime streaming site)

class AniWorldDetector {
  constructor() {
    this.currentMedia = null;
    this.video = null;
    this.watchStartTime = null;
    this.lastReportedProgress = 0;
    this.progressInterval = null;
    this.urlChangeTimer = null;
    this.iframeDetected = false;

    this.init();
  }

  init() {
    console.log('[Miru/AniWorld] Initializing...');
    this.waitForPlayer();
    this.watchForNavigation();
  }

  waitForPlayer() {
    // Check immediately on page load if we're on an episode page
    if (this.isEpisodePage()) {
      // Send detection immediately when on episode page
      setTimeout(() => this.detectAndSend(), 500);
    }

    const observer = new MutationObserver(() => {
      // AniWorld loads player dynamically after clicking "fakePlayer"
      // Look for any iframe that might be a video player
      const iframeSelectors = [
        'iframe.inSiteWebStream',
        'iframe[src*="voe"]',
        'iframe[src*="vidoza"]',
        'iframe[src*="streamtape"]',
        'iframe[src*="dood"]',
        'iframe[src*="filemoon"]',
        'iframe[src*="vidmoly"]',
        '.hosterSiteVideo iframe',
        '#mediaelement iframe',
        '.videoplayer iframe',
        'iframe[allowfullscreen]',
      ];

      for (const selector of iframeSelectors) {
        const iframe = document.querySelector(selector);
        if (iframe && !this.iframeDetected) {
          this.iframeDetected = true;
          console.log('[Miru/AniWorld] Found iframe:', selector);
          this.attachToIframe(iframe);
          break;
        }
      }

      // Direct video element (embedded players)
      const video = document.querySelector('video');
      if (video && video !== this.video) {
        this.attachToVideo(video);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Check if elements already exist
    const existingVideo = document.querySelector('video');
    if (existingVideo) {
      this.attachToVideo(existingVideo);
    }
  }

  isEpisodePage() {
    // Check if we're on an episode page
    return /\/staffel-\d+\/episode-\d+/.test(window.location.pathname) ||
           /\/filme\/film-\d+/.test(window.location.pathname);
  }

  detectAndSend() {
    const mediaInfo = this.extractMediaInfo();
    if (mediaInfo.title !== 'Unknown') {
      this.currentMedia = mediaInfo;
      console.log('[Miru/AniWorld] Detected:', mediaInfo.title, 'S' + mediaInfo.season, 'E' + mediaInfo.episode);

      chrome.runtime.sendMessage({
        type: 'MIRU_PLAY',
        data: this.currentMedia,
      });
    }
  }

  attachToIframe(iframe) {
    // For iframes, we can only detect from the main page
    console.log('[Miru/AniWorld] Detected player iframe:', iframe.src);

    // Extract media info from the main page
    const mediaInfo = this.extractMediaInfo();
    if (mediaInfo.title !== 'Unknown') {
      this.currentMedia = mediaInfo;
      console.log('[Miru/AniWorld] Auto-detected:', mediaInfo.title, 'Folge', mediaInfo.episode);

      chrome.runtime.sendMessage({
        type: 'MIRU_PLAY',
        data: this.currentMedia,
      });
    }
  }

  attachToVideo(video) {
    if (this.video === video) return;

    this.video = video;
    console.log('[Miru/AniWorld] Attaching to video element');

    video.addEventListener('play', () => this.onPlay());
    video.addEventListener('pause', () => this.onPause());
    video.addEventListener('ended', () => this.onEnded());
    video.addEventListener('timeupdate', () => this.onTimeUpdate());

    if (!video.paused) {
      this.onPlay();
    }
  }

  extractMediaInfo() {
    let title = null;
    let episode = null;
    let season = null;

    // ========================================================================
    // STRATEGY 1: Page Title (Most Reliable for AniWorld)
    // ========================================================================
    const pageTitle = document.title;

    // AniWorld page title format:
    // "Episode X Staffel Y von TITLE | AniWorld.to"
    const titlePatterns = [
      // "Episode X Staffel Y von TITLE | AniWorld"
      /^Episode\s+(\d+)\s+Staffel\s+(\d+)\s+von\s+(.+?)\s*\|/i,

      // "Episode X von TITLE | AniWorld"
      /^Episode\s+(\d+)\s+von\s+(.+?)\s*\|/i,

      // Legacy patterns (fallback)
      /^(.+?)\s+Folge\s+(\d+)\s+Ger\s+(?:Sub|Dub)/i,
      /^(.+?)\s+-\s+Folge\s+(\d+)/i,
      /^(.+?)\s+Staffel\s+(\d+)\s+Folge\s+(\d+)/i,
      /^(.+?)\s+Folge\s+(\d+)/i,
    ];

    for (let i = 0; i < titlePatterns.length; i++) {
      const pattern = titlePatterns[i];
      const match = pageTitle.match(pattern);
      if (match) {
        // First two patterns have different capture group order
        if (i === 0) {
          // "Episode X Staffel Y von TITLE"
          episode = parseInt(match[1], 10);
          season = parseInt(match[2], 10);
          title = match[3].trim();
        } else if (i === 1) {
          // "Episode X von TITLE"
          episode = parseInt(match[1], 10);
          title = match[2].trim();
        } else if (match.length === 4) {
          // Legacy: "TITLE Staffel Y Folge X"
          title = match[1].trim();
          season = parseInt(match[2], 10);
          episode = parseInt(match[3], 10);
        } else {
          // Legacy: "TITLE Folge X"
          title = match[1].trim();
          episode = parseInt(match[2], 10);
        }
        console.log('[Miru/AniWorld] Matched pattern', i, ':', title, 'S' + season, 'E' + episode);
        break;
      }
    }

    // ========================================================================
    // STRATEGY 2: DOM Selectors (AniWorld-specific)
    // ========================================================================
    if (!title) {
      const titleSelectors = [
        '.series-title',
        'h1.entry-title',
        'h2.hosterSiteTitle',
        '.movieTitle',
        'h1[itemprop="name"]',
        '.headline',
        'h1',
      ];

      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) {
          title = el.textContent.trim();
          // Remove "Ger Sub" or "Ger Dub" suffixes
          title = title.replace(/\s+Ger\s+(?:Sub|Dub)$/i, '');
          break;
        }
      }
    }

    // Episode from DOM if not found yet
    if (!episode) {
      const episodeSelectors = [
        '.episode-number',
        '.current-episode',
        '[data-episode]',
        'span[class*="folge"]',
      ];

      for (const selector of episodeSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          // Try data attribute first
          const dataEpisode = el.getAttribute('data-episode');
          if (dataEpisode) {
            episode = parseInt(dataEpisode, 10);
            break;
          }

          // Try text content
          const epMatch = el.textContent?.match(/(\d+)/);
          if (epMatch) {
            episode = parseInt(epMatch[1], 10);
            break;
          }
        }
      }
    }

    // ========================================================================
    // STRATEGY 3: URL Parsing (Most reliable for AniWorld)
    // ========================================================================
    // AniWorld URL formats:
    // - /anime/stream/anime-name/staffel-2/episode-5
    // - /anime/stream/anime-name/filme/film-1
    const episodeMatch = window.location.pathname.match(/episode-(\d+)/i);
    if (episodeMatch && !episode) {
      episode = parseInt(episodeMatch[1], 10);
    }

    // Film number as episode
    const filmMatch = window.location.pathname.match(/film-(\d+)/i);
    if (filmMatch && !episode) {
      episode = parseInt(filmMatch[1], 10);
    }

    // Season from URL
    const seasonMatch = window.location.pathname.match(/staffel-(\d+)/i);
    if (seasonMatch && !season) {
      season = parseInt(seasonMatch[1], 10);
    }

    // Extract title from URL if still not found
    if (!title) {
      const pathMatch = window.location.pathname.match(/\/anime\/stream\/([^\/]+)/i);
      if (pathMatch) {
        title = pathMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase()); // Title case
      }
    }

    return {
      title: title || 'Unknown',
      episode: episode || null,
      season: season || null,
      site: 'aniworld',
      url: window.location.href,
      duration: this.video ? this.video.duration : null,
    };
  }

  watchForNavigation() {
    // Watch for URL changes (SPA navigation between episodes)
    let lastUrl = window.location.href;

    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[Miru/AniWorld] URL changed - re-detecting media');
        lastUrl = currentUrl;

        // Reset all state
        this.video = null;
        this.currentMedia = null;
        this.iframeDetected = false;
        this.lastReportedProgress = 0;

        // Wait a bit for DOM to update, then re-init
        clearTimeout(this.urlChangeTimer);
        this.urlChangeTimer = setTimeout(() => {
          this.waitForPlayer();
        }, 1000);
      }
    }, 1000);
  }

  onPlay() {
    console.log('[Miru/AniWorld] Play');
    this.watchStartTime = Date.now();
    this.currentMedia = this.extractMediaInfo();

    console.log('[Miru/AniWorld] Playing:', this.currentMedia.title, 'Folge', this.currentMedia.episode);

    chrome.runtime.sendMessage({
      type: 'MIRU_PLAY',
      data: this.currentMedia,
    });

    this.startProgressReporting();
  }

  onPause() {
    console.log('[Miru/AniWorld] Pause');
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
    console.log('[Miru/AniWorld] Ended');

    chrome.runtime.sendMessage({
      type: 'MIRU_PROGRESS',
      data: {
        ...this.currentMedia,
        progress: 100,
        completed: true,
      },
    });

    this.stopProgressReporting();
  }

  onTimeUpdate() {
    if (!this.video) return;

    const progress = (this.video.currentTime / this.video.duration) * 100;

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

    this.progressInterval = setInterval(() => {
      if (this.video && !this.video.paused) {
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.reportProgress(progress);
      }
    }, 120000); // Every 2 minutes
  }

  stopProgressReporting() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  reportProgress(progress) {
    console.log('[Miru/AniWorld] Progress:', Math.round(progress) + '%');

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
new AniWorldDetector();
