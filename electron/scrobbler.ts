// electron/scrobbler.ts
// Scrobbler Engine - Automatische Anime-Erkennung via Window Title

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface ScrobblerConfig {
  enabled: boolean;
  pollInterval: number;
  whitelist: string[];
  blacklist: string[];
  smartThreshold: number;
}

export interface ScrobblerCandidate {
  cleanTitle: string;
  episode: number | null;
  app: string;
  confidence: number;
}

interface WindowInfo {
  app: string;
  title: string;
}

interface ParsedTitle {
  cleanTitle: string;
  episode: number | null;
  confidence: number;
}

// ============================================================================
// SCROBBLER ENGINE
// ============================================================================

export class ScrobblerEngine {
  private store: any;
  private config: ScrobblerConfig;
  private aliases: Record<string, number> = {};
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastDetected: string | null = null;
  private onDetectionCallback: ((candidate: ScrobblerCandidate) => void) | null = null;

  constructor(store: any) {
    this.store = store;

    // Load config from store
    this.config = (store.get('scrobbler.config') ?? {
      enabled: false,
      pollInterval: 5000,
      whitelist: ['VLC', 'IINA', 'mpv', 'QuickTime Player'],
      blacklist: ['Chrome', 'Safari', 'Firefox'],
      smartThreshold: 0.8,
    }) as ScrobblerConfig;

    // Load aliases
    this.aliases = (store.get('scrobbler.aliases') ?? {}) as Record<string, number>;

    if (this.config.enabled) {
      this.start();
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Scrobbler] Started');
    this.poll();
  }

  stop() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    console.log('[Scrobbler] Stopped');
  }

  getStatus() {
    return {
      config: this.config,
      aliases: this.aliases,
      isRunning: this.isRunning,
    };
  }

  updateConfig(config: Partial<ScrobblerConfig>) {
    this.config = { ...this.config, ...config };
    this.store.set('scrobbler.config', this.config);

    if (this.config.enabled && !this.isRunning) {
      this.start();
    } else if (!this.config.enabled && this.isRunning) {
      this.stop();
    }

    return { success: true, config: this.config };
  }

  async debugMatch(): Promise<any> {
    const window = await this.getActiveWindow();
    if (!window) {
      return { error: 'No active window found' };
    }

    const isBlacklisted = this.config.blacklist.includes(window.app);
    const isWhitelisted = this.config.whitelist.includes(window.app);

    const parsed = this.parseTitle(window.title);
    const result = parsed.confidence >= this.config.smartThreshold ? parsed : null;

    return {
      window,
      status: { isBlacklisted, isWhitelisted },
      result,
    };
  }

  confirmMatch(cleanTitle: string, mediaId: number) {
    this.aliases[cleanTitle] = mediaId;
    this.store.set('scrobbler.aliases', this.aliases);
    console.log(`[Scrobbler] Learned alias: "${cleanTitle}" -> ${mediaId}`);
    return { success: true };
  }

  removeAlias(alias: string) {
    delete this.aliases[alias];
    this.store.set('scrobbler.aliases', this.aliases);
    return { success: true };
  }

  onDetection(callback: (candidate: ScrobblerCandidate) => void) {
    this.onDetectionCallback = callback;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async poll() {
    if (!this.isRunning) return;

    try {
      const window = await this.getActiveWindow();

      if (window) {
        const isBlacklisted = this.config.blacklist.includes(window.app);
        const isWhitelisted = this.config.whitelist.includes(window.app);

        // Skip if blacklisted or not whitelisted
        if (isBlacklisted || (!isWhitelisted && this.config.whitelist.length > 0)) {
          // Reset last detected if we're not on a whitelisted app
          this.lastDetected = null;
        } else {
          // Parse the title
          const parsed = this.parseTitle(window.title);

          if (parsed.confidence >= this.config.smartThreshold) {
            const detectionKey = `${window.app}:${parsed.cleanTitle}:${parsed.episode}`;

            // Only fire detection if this is a new anime/episode
            if (detectionKey !== this.lastDetected) {
              this.lastDetected = detectionKey;

              const candidate: ScrobblerCandidate = {
                cleanTitle: parsed.cleanTitle,
                episode: parsed.episode,
                app: window.app,
                confidence: parsed.confidence,
              };

              console.log('[Scrobbler] Detected:', candidate);

              if (this.onDetectionCallback) {
                this.onDetectionCallback(candidate);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Scrobbler] Poll error:', err);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
  }

  private async getActiveWindow(): Promise<WindowInfo | null> {
    try {
      // macOS: Use AppleScript to get active window
      const script = `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          tell process frontApp
            try
              set windowTitle to name of front window
              return frontApp & "|" & windowTitle
            on error
              return frontApp & "|"
            end try
          end tell
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const parts = stdout.trim().split('|');

      if (parts.length >= 2) {
        return {
          app: parts[0],
          title: parts[1] || '',
        };
      }

      return null;
    } catch (err) {
      console.error('[Scrobbler] getActiveWindow error:', err);
      return null;
    }
  }

  private parseTitle(rawTitle: string): ParsedTitle {
    if (!rawTitle) {
      return { cleanTitle: '', episode: null, confidence: 0 };
    }

    let cleanTitle = rawTitle;
    let episode: number | null = null;
    let confidence = 0.3; // Base confidence

    // Remove file extensions
    cleanTitle = cleanTitle.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, '');

    // Remove quality markers
    cleanTitle = cleanTitle.replace(/\b(1080p|720p|480p|2160p|4K|BD|BluRay|WEB-?DL|WEBRip)\b/gi, '');

    // Remove codec info
    cleanTitle = cleanTitle.replace(/\b(x264|x265|HEVC|H\.264|H\.265|AAC|FLAC|DTS)\b/gi, '');

    // Episode pattern 1: "- 01" or "- Episode 01"
    const epPattern1 = /[-–—]\s*(?:Episode\s*)?(\d{1,3})\b/i;
    const match1 = cleanTitle.match(epPattern1);
    if (match1) {
      episode = parseInt(match1[1], 10);
      cleanTitle = cleanTitle.replace(epPattern1, '');
      confidence += 0.3;
    }

    // Episode pattern 2: "S01E01" or "S1E1"
    const epPattern2 = /\bS(\d{1,2})E(\d{1,3})\b/i;
    const match2 = cleanTitle.match(epPattern2);
    if (match2) {
      episode = parseInt(match2[2], 10);
      cleanTitle = cleanTitle.replace(epPattern2, '');
      confidence += 0.3;
    }

    // Episode pattern 3: "[01]" or "(01)" at end
    const epPattern3 = /[\[\(](\d{1,3})[\]\)]\s*$/;
    const match3 = cleanTitle.match(epPattern3);
    if (match3) {
      episode = parseInt(match3[1], 10);
      cleanTitle = cleanTitle.replace(epPattern3, '');
      confidence += 0.2;
    }

    // Remove sub group tags: [SubGroup] or (SubGroup)
    cleanTitle = cleanTitle.replace(/^\[([^\]]+)\]\s*/, '');
    cleanTitle = cleanTitle.replace(/^\(([^)]+)\)\s*/, '');

    // Remove trailing brackets
    cleanTitle = cleanTitle.replace(/\s*[\[\(][^\]\)]*[\]\)]\s*$/g, '');

    // Clean up whitespace
    cleanTitle = cleanTitle.trim().replace(/\s+/g, ' ');

    // Boost confidence if we found an episode number
    if (episode !== null) {
      confidence += 0.2;
    }

    // Boost confidence if title looks like anime (has Japanese characters or common anime words)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanTitle)) {
      confidence += 0.1;
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    return {
      cleanTitle,
      episode,
      confidence,
    };
  }
}
