// electron/miruBridge.ts
// WebSocket server for Miru Chrome Extension communication

import { WebSocketServer, WebSocket } from 'ws';

const DEFAULT_PORT = 9876;

// ============================================================================
// TYPES
// ============================================================================

interface MiruMessage {
  type: 'MIRU_PLAY' | 'MIRU_PAUSE' | 'MIRU_PROGRESS' | 'PING' | 'PONG';
  data?: MiruMediaData;
  timestamp?: number;
}

interface MiruMediaData {
  title: string;
  episode: number | null;
  season: number | null;
  site: string;
  url: string;
  duration: number | null;
  progress?: number;
  currentTime?: number;
  watchDuration?: number;
  completed?: boolean;
  timestamp: number;
}

export interface MiruScrobbleData {
  source: 'miru';
  title: string;
  episode: number | null;
  season: number | null;
  site: string;
  url: string;
  progress: number;
  completed: boolean;
  confidence: number;
  timestamp: number;
}

// ============================================================================
// MIRU BRIDGE
// ============================================================================

export class MiruBridge {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private connected: boolean = false;
  private onScrobbleCallback: ((data: MiruScrobbleData) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;
  private port: number = DEFAULT_PORT;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  start(): boolean {
    if (this.wss) {
      console.log('[MiruBridge] Already running');
      return true;
    }

    try {
      this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' });

      this.wss.on('listening', () => {
        console.log(`[MiruBridge] WebSocket server running on ws://127.0.0.1:${this.port}`);
      });

      this.wss.on('connection', (ws: WebSocket) => {
        console.log('[MiruBridge] Extension connected');
        this.client = ws;
        this.connected = true;
        this.onConnectionChangeCallback?.(true);

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as MiruMessage;
            this.handleMessage(message);
          } catch (e) {
            console.error('[MiruBridge] Parse error:', e);
          }
        });

        ws.on('close', () => {
          console.log('[MiruBridge] Extension disconnected');
          this.client = null;
          this.connected = false;
          this.onConnectionChangeCallback?.(false);
        });

        ws.on('error', (err) => {
          console.error('[MiruBridge] WebSocket error:', err);
        });
      });

      this.wss.on('error', (err) => {
        console.error('[MiruBridge] Server error:', err);
      });

      console.log(`[MiruBridge] WebSocket server running on port ${this.port}`);
      return true;
    } catch (err) {
      console.error('[MiruBridge] Failed to start:', err);
      return false;
    }
  }

  stop(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.connected = false;
    console.log('[MiruBridge] Stopped');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): { running: boolean; connected: boolean; port: number } {
    return {
      running: this.wss !== null,
      connected: this.connected,
      port: this.port,
    };
  }

  onScrobble(callback: (data: MiruScrobbleData) => void): void {
    this.onScrobbleCallback = callback;
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  // Send message to extension
  send(message: object): boolean {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.client.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error('[MiruBridge] Send error:', e);
      return false;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private handleMessage(message: MiruMessage): void {
    // Handle PING/PONG heartbeat
    if (message.type === 'PING') {
      this.send({ type: 'PONG', timestamp: Date.now() });
      return;
    }

    if (message.type === 'PONG') {
      // Client acknowledged our ping
      return;
    }

    console.log('[MiruBridge] Received:', message.type);

    switch (message.type) {
      case 'MIRU_PLAY':
        this.handlePlay(message.data!);
        break;

      case 'MIRU_PAUSE':
        this.handlePause(message.data!);
        break;

      case 'MIRU_PROGRESS':
        this.handleProgress(message.data!);
        break;

      default:
        console.warn('[MiruBridge] Unknown message type:', message.type);
    }
  }

  private handlePlay(data: MiruMediaData): void {
    console.log('[MiruBridge] Play:', data.title, 'Episode:', data.episode);

    // Emit scrobble event
    if (this.onScrobbleCallback) {
      this.onScrobbleCallback({
        source: 'miru',
        title: data.title,
        episode: data.episode,
        season: data.season,
        site: data.site,
        url: data.url,
        progress: 0,
        completed: false,
        confidence: 0.99, // Miru has high confidence
        timestamp: data.timestamp,
      });
    }
  }

  private handlePause(data: MiruMediaData): void {
    const progress = data.duration && data.currentTime
      ? Math.round((data.currentTime / data.duration) * 100)
      : 0;

    console.log('[MiruBridge] Pause:', data.title, 'Progress:', progress + '%');
  }

  private handleProgress(data: MiruMediaData): void {
    console.log('[MiruBridge] Progress:', data.title, data.progress + '%');

    // Check if completed (>90% watched)
    if (data.completed || (data.progress && data.progress >= 90)) {
      if (this.onScrobbleCallback) {
        this.onScrobbleCallback({
          source: 'miru',
          title: data.title,
          episode: data.episode,
          season: data.season,
          site: data.site,
          url: data.url,
          progress: data.progress || 100,
          completed: true,
          confidence: 0.99,
          timestamp: data.timestamp,
        });
      }
    }
  }
}

export default MiruBridge;
