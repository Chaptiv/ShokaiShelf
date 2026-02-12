// ShokaiShelf Miru - AniWatch/Zoro Content Script
// Detects anime playback on AniWatch.to and Zoro.to

class AniWatchDetector {
  constructor() {
    this.currentMedia = null;
    this.video = null;
    this.watchStartTime = null;
    this.lastReportedProgress = 0;
    this.progressInterval = null;

    this.init();
  }

  init() {
    console.log('[Miru/AniWatch] Initializing...');
    this.waitForPlayer();
  }

  waitForPlayer() {
    const observer = new MutationObserver(() => {
      // AniWatch uses iframe for video player
      const iframe = document.querySelector('iframe[src*="player"]');
      if (iframe) {
        this.attachToIframe(iframe);
      }

      // Direct video element
      const video = document.querySelector('video');
      if (video && video !== this.video) {
        this.attachToVideo(video);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Check if elements already exist
    const existingVideo = document.querySelector('video');
    if (existingVideo) {
      this.attachToVideo(existingVideo);
    }
  }

  attachToIframe(iframe) {
    // For iframes, we can only detect navigation changes
    // The actual video events need to be handled by the iframe's content
    console.log('[Miru/AniWatch] Detected player iframe');

    // Extract media info from the main page
    const mediaInfo = this.extractMediaInfo();
    if (mediaInfo.title !== 'Unknown') {
      this.currentMedia = mediaInfo;
      chrome.runtime.sendMessage({
        type: 'MIRU_PLAY',
        data: this.currentMedia,
      });
    }
  }

  attachToVideo(video) {
    if (this.video === video) return;

    this.video = video;
    console.log('[Miru/AniWatch] Attaching to video');

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

    // Try from page title
    // Pattern: "Watch ANIME TITLE Episode X English Sub/Dub online"
    const pageTitle = document.title;
    const titleMatch = pageTitle.match(/^(?:Watch\s+)?(.+?)\s+(?:Episode|Ep\.?)\s*(\d+)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      episode = parseInt(titleMatch[2], 10);
    }

    // Try from URL
    // Pattern: /watch/anime-name-episode-5
    const urlMatch = window.location.pathname.match(/\/watch\/(.+?)-episode-(\d+)/i);
    if (urlMatch) {
      if (!title) {
        title = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      if (!episode) {
        episode = parseInt(urlMatch[2], 10);
      }
    }

    // Try from DOM elements
    if (!title) {
      const titleEl = document.querySelector('.anime-name') ||
                      document.querySelector('.film-name') ||
                      document.querySelector('h2.title');
      if (titleEl) {
        title = titleEl.textContent?.trim();
      }
    }

    // Episode from DOM
    if (!episode) {
      const episodeEl = document.querySelector('.episode-number') ||
                        document.querySelector('.current-episode');
      if (episodeEl) {
        const epMatch = episodeEl.textContent?.match(/(\d+)/);
        if (epMatch) {
          episode = parseInt(epMatch[1], 10);
        }
      }
    }

    return {
      title: title || 'Unknown',
      episode: episode || null,
      season: null,
      site: window.location.hostname.includes('zoro') ? 'zoro' : 'aniwatch',
      url: window.location.href,
      duration: this.video ? this.video.duration : null,
    };
  }

  onPlay() {
    console.log('[Miru/AniWatch] Play');
    this.watchStartTime = Date.now();
    this.currentMedia = this.extractMediaInfo();

    chrome.runtime.sendMessage({
      type: 'MIRU_PLAY',
      data: this.currentMedia,
    });

    this.startProgressReporting();
  }

  onPause() {
    console.log('[Miru/AniWatch] Pause');
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
    console.log('[Miru/AniWatch] Ended');

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
    }, 120000);
  }

  stopProgressReporting() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  reportProgress(progress) {
    console.log('[Miru/AniWatch] Progress:', Math.round(progress) + '%');

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
new AniWatchDetector();
