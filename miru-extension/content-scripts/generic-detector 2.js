// ShokaiShelf Miru - Generic Detector for Custom Sites
// This script is dynamically injected and configured for user-defined streaming sites

class GenericDetector {
  constructor(siteConfig) {
    this.config = siteConfig;
    this.currentMedia = null;
    this.video = null;
    this.watchStartTime = null;
    this.lastReportedProgress = 0;
    this.progressInterval = null;
    this.extractionAttempts = 0;

    console.log('[Miru/Generic] Initializing for:', this.config.name);
    this.init();
  }

  async init() {
    // Wait for selectors if specified
    if (this.config.config.waitSelectors && this.config.config.waitSelectors.length > 0) {
      await this.waitForSelectors(this.config.config.waitSelectors);
    }

    this.waitForPlayer();
  }

  // ========================================================================
  // PLAYER DETECTION
  // ========================================================================

  waitForPlayer() {
    const observer = new MutationObserver(() => {
      // Check for iframe player
      if (this.config.config.videoIframe) {
        const iframe = document.querySelector(this.config.config.videoIframe);
        if (iframe) {
          this.attachToIframe(iframe);
        }
      }

      // Check for video element
      const video = document.querySelector(this.config.config.videoSelector || 'video');
      if (video && video !== this.video) {
        this.attachToVideo(video);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Check if elements already exist
    const existingVideo = document.querySelector(this.config.config.videoSelector || 'video');
    if (existingVideo) {
      this.attachToVideo(existingVideo);
    } else if (this.config.config.videoIframe) {
      const existingIframe = document.querySelector(this.config.config.videoIframe);
      if (existingIframe) {
        this.attachToIframe(existingIframe);
      }
    }
  }

  attachToIframe(iframe) {
    console.log('[Miru/Generic] Detected iframe player');

    const mediaInfo = this.extractMediaInfo();
    if (mediaInfo.title !== 'Unknown') {
      this.currentMedia = mediaInfo;
      this.sendPlayEvent();
    } else {
      this.retryExtraction();
    }
  }

  attachToVideo(video) {
    if (this.video === video) return;

    this.video = video;
    console.log('[Miru/Generic] Attaching to video element');

    video.addEventListener('play', () => this.onPlay());
    video.addEventListener('pause', () => this.onPause());
    video.addEventListener('ended', () => this.onEnded());
    video.addEventListener('timeupdate', () => this.onTimeUpdate());

    if (!video.paused) {
      this.onPlay();
    }
  }

  // ========================================================================
  // MEDIA INFO EXTRACTION
  // ========================================================================

  extractMediaInfo() {
    let title = null;
    let episode = null;
    let season = null;

    // Title extraction
    title = this.extractTitle();

    // Episode extraction
    episode = this.extractEpisode();

    // Season extraction
    season = this.extractSeason();

    return {
      title: title || 'Unknown',
      episode: episode || null,
      season: season || null,
      site: this.config.name.toLowerCase().replace(/\s+/g, '-'),
      url: window.location.href,
      duration: this.video ? this.video.duration : null,
    };
  }

  extractTitle() {
    const method = this.config.config.titleMethod;

    switch (method) {
      case 'regex':
        return this.extractByRegex(
          document.title,
          this.config.config.titleRegex,
          this.config.config.titleRegexGroup || 1
        );

      case 'selector':
        return this.extractBySelector(this.config.config.titleSelector);

      case 'meta':
        return this.extractByMeta(this.config.config.titleMetaProperty);

      case 'jsonld':
        return this.extractByJsonLd(this.config.config.titleJsonPath);

      default:
        console.warn('[Miru/Generic] Unknown title extraction method:', method);
        return null;
    }
  }

  extractEpisode() {
    const method = this.config.config.episodeMethod;

    switch (method) {
      case 'regex':
        const ep = this.extractByRegex(
          document.title,
          this.config.config.episodeRegex,
          this.config.config.episodeRegexGroup || 1
        );
        return ep ? parseInt(ep, 10) : null;

      case 'selector':
        const epText = this.extractBySelector(this.config.config.episodeSelector);
        if (epText) {
          const match = epText.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : null;
        }
        return null;

      case 'url':
        const epUrl = this.extractByRegex(
          window.location.pathname,
          this.config.config.episodeUrlPattern,
          1
        );
        return epUrl ? parseInt(epUrl, 10) : null;

      default:
        console.warn('[Miru/Generic] Unknown episode extraction method:', method);
        return null;
    }
  }

  extractSeason() {
    const method = this.config.config.seasonMethod;
    if (!method || method === 'none') return null;

    const pattern = this.config.config.seasonPattern;
    if (!pattern) return null;

    let season = null;

    if (method === 'url') {
      season = this.extractByRegex(window.location.pathname, pattern, 1);
    } else if (method === 'regex') {
      season = this.extractByRegex(document.title, pattern, 1);
    }

    return season ? parseInt(season, 10) : null;
  }

  // ========================================================================
  // EXTRACTION HELPERS
  // ========================================================================

  extractByRegex(text, pattern, group) {
    if (!pattern || !text) return null;

    try {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);
      return match && match[group] ? match[group].trim() : null;
    } catch (e) {
      console.error('[Miru/Generic] Regex error:', e);
      return null;
    }
  }

  extractBySelector(selector) {
    if (!selector) return null;

    try {
      const el = document.querySelector(selector);
      return el ? el.textContent?.trim() : null;
    } catch (e) {
      console.error('[Miru/Generic] Selector error:', e);
      return null;
    }
  }

  extractByMeta(property) {
    if (!property) return null;

    const meta = document.querySelector(`meta[property="${property}"]`) ||
                 document.querySelector(`meta[name="${property}"]`);

    return meta ? meta.getAttribute('content')?.trim() : null;
  }

  extractByJsonLd(path) {
    if (!path) return null;

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const parts = path.split('.');
        let value = data;

        for (const part of parts) {
          value = value?.[part];
          if (!value) break;
        }

        if (value) {
          return value.toString().trim();
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    return null;
  }

  // ========================================================================
  // RETRY MECHANISM
  // ========================================================================

  retryExtraction() {
    const maxAttempts = this.config.config.retryAttempts || 5;

    const attemptExtraction = () => {
      const mediaInfo = this.extractMediaInfo();

      if (mediaInfo.title === 'Unknown' && this.extractionAttempts < maxAttempts) {
        this.extractionAttempts++;
        console.log(`[Miru/Generic] Retrying extraction (${this.extractionAttempts}/${maxAttempts})`);
        setTimeout(attemptExtraction, 1000);
      } else if (mediaInfo.title !== 'Unknown') {
        console.log('[Miru/Generic] Successfully extracted:', mediaInfo.title);
        this.currentMedia = mediaInfo;
        this.extractionAttempts = 0;
      } else {
        console.warn('[Miru/Generic] Failed to extract media info after all attempts');
        this.extractionAttempts = 0;
      }
    };

    attemptExtraction();
  }

  async waitForSelectors(selectors) {
    console.log('[Miru/Generic] Waiting for selectors:', selectors);

    const checkSelectors = () => {
      return selectors.some(selector => {
        try {
          return document.querySelector(selector) !== null;
        } catch (e) {
          return false;
        }
      });
    };

    if (checkSelectors()) {
      return;
    }

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (checkSelectors()) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 10000);
    });
  }

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  onPlay() {
    console.log('[Miru/Generic] Play');
    this.watchStartTime = Date.now();
    this.currentMedia = this.extractMediaInfo();

    if (this.currentMedia.title === 'Unknown') {
      console.log('[Miru/Generic] Initial extraction failed, starting retry...');
      this.retryExtraction();
    } else {
      console.log('[Miru/Generic] Playing:', this.currentMedia.title);
    }

    this.sendPlayEvent();
    this.startProgressReporting();
  }

  onPause() {
    console.log('[Miru/Generic] Pause');
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
    console.log('[Miru/Generic] Ended');

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

  sendPlayEvent() {
    chrome.runtime.sendMessage({
      type: 'MIRU_PLAY',
      data: this.currentMedia,
    });
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
    console.log('[Miru/Generic] Progress:', Math.round(progress) + '%');

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

// Initialize function that will be called with config
window.initGenericDetector = function(siteConfig) {
  if (!window.miruGenericDetector) {
    window.miruGenericDetector = new GenericDetector(siteConfig);
  }
};
