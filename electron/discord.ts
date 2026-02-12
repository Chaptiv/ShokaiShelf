// electron/discord.ts
// Discord Rich Presence Integration

import * as DiscordRPC from 'discord-rpc';
import type Store from 'electron-store';

const CLIENT_ID = '1405638389667074069';

// ============================================================================
// TYPES
// ============================================================================

interface DiscordActivity {
  title: string;
  episode?: number;
  cover?: string;
  status?: 'watching' | 'planning' | 'completed';
  state?: string;
}

// ============================================================================
// DISCORD PRESENCE ENGINE
// ============================================================================

export class DiscordPresence {
  private rpc: DiscordRPC.Client | null = null;
  private store: any;
  private enabled: boolean = false;
  private connected: boolean = false;
  private currentActivity: DiscordActivity | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private anilistUsername: string | null = null;

  constructor(store: any) {
    this.store = store;

    // Load enabled state from store
    this.enabled = (store.get('discord.enabled') ?? false) as boolean;

    // Load AniList username (using flat keys as stored by main.js)
    const viewerName = store.get('anilist.viewer_name');
    if (viewerName) {
      this.anilistUsername = viewerName as string;
    }

    if (this.enabled) {
      this.connect();
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  async connect() {
    if (this.connected || this.rpc) return;

    try {
      this.rpc = new DiscordRPC.Client({ transport: 'ipc' });

      this.rpc.on('ready', () => {
        console.log('[Discord] Connected to Discord RPC');
        this.connected = true;

        // Set default activity with username
        if (this.enabled) {
          if (this.currentActivity) {
            // Restore activity if there was one
            this.setActivity(this.currentActivity);
          } else if (this.anilistUsername) {
            // Set default activity with username
            this.setActivity({
              title: 'ShokaiShelf',
              status: 'watching'
            });
            console.log('[Discord] Set default activity for user:', this.anilistUsername);
          } else {
            // Set basic activity
            this.setActivity({
              title: 'ShokaiShelf',
              status: 'watching'
            });
          }
        }
      });

      this.rpc.on('disconnected', () => {
        console.log('[Discord] Disconnected from Discord RPC');
        this.connected = false;
        this.rpc = null;

        // Try to reconnect if still enabled
        if (this.enabled) {
          this.scheduleReconnect();
        }
      });

      await this.rpc.login({ clientId: CLIENT_ID });
    } catch (err) {
      console.error('[Discord] Connection failed:', err);
      this.connected = false;
      this.rpc = null;

      // Retry connection if enabled
      if (this.enabled) {
        this.scheduleReconnect();
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.rpc) {
      this.rpc.destroy();
      this.rpc = null;
    }

    this.connected = false;
    console.log('[Discord] Disconnected');
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.store.set('discord.enabled', enabled);

    if (enabled && !this.connected) {
      this.connect();
    } else if (!enabled && this.connected) {
      this.clearActivity();
      this.disconnect();
    }

    return { success: true, enabled: this.enabled };
  }

  setActivity(activity: DiscordActivity) {
    this.currentActivity = activity;

    if (!this.enabled || !this.connected || !this.rpc) {
      console.log('[Discord] Not setting activity - not enabled or connected');
      return { success: false, error: 'Not connected' };
    }

    try {
      const details = activity.title;
      let state = 'Browsing anime';

      if (activity.state) {
        state = activity.state;
      } else if (activity.episode) {
        state = `Episode ${activity.episode}`;
      } else if (activity.status) {
        state = activity.status === 'watching' ? 'Watching anime'
             : activity.status === 'planning' ? 'Planning to watch'
             : 'Completed';
      }

      // Add username to state if available
      if (this.anilistUsername && !activity.episode && !activity.state) {
        state = `${this.anilistUsername} • ${state}`;
      }

      this.rpc.setActivity({
        details,
        state,
        largeImageKey: 'logo',
        largeImageText: 'ShokaiShelf',
        startTimestamp: Date.now(),
        instance: false,
      });

      console.log('[Discord] Activity set:', { details, state, user: this.anilistUsername });
      return { success: true };
    } catch (err) {
      console.error('[Discord] Failed to set activity:', err);
      return { success: false, error: String(err) };
    }
  }

  clearActivity() {
    this.currentActivity = null;

    if (!this.rpc || !this.connected) {
      return { success: true };
    }

    try {
      this.rpc.clearActivity();
      console.log('[Discord] Activity cleared');
      return { success: true };
    } catch (err) {
      console.error('[Discord] Failed to clear activity:', err);
      return { success: false, error: String(err) };
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      connected: this.connected,
      currentActivity: this.currentActivity,
      username: this.anilistUsername,
    };
  }

  updateUsername(username: string | null) {
    this.anilistUsername = username;
    if (username) {
      this.store.set('anilist.viewer_name', username);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    console.log('[Discord] Scheduling reconnect in 10 seconds...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.enabled && !this.connected) {
        console.log('[Discord] Attempting reconnect...');
        this.connect();
      }
    }, 10000);
  }
}
