// electron/miruBridge.js
// WebSocket server for Miru Chrome Extension communication

import { WebSocketServer, WebSocket } from 'ws';

const DEFAULT_PORT = 9876;

// ============================================================================
// MIRU BRIDGE
// ============================================================================

export class MiruBridge {
  constructor(port = DEFAULT_PORT) {
    this.wss = null;
    this.client = null;
    this.connected = false;
    this.onScrobbleCallback = null;
    this.onConnectionChangeCallback = null;
    this.port = port;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  start() {
    if (this.wss) {
      console.log('[MiruBridge] Already running');
      return true;
    }

    try {
      // Explicitly bind to IPv4 loopback
      this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' });

      this.wss.on('listening', () => {
        console.log(`[MiruBridge] WebSocket server running on ws://127.0.0.1:${this.port}`);
      });

      this.wss.on('connection', (ws) => {
        console.log('[MiruBridge] Extension connected');
        this.client = ws;
        this.connected = true;
        if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(true);
        }

        ws.on('message', (data) => {
          try {
            const msgString = data.toString();
            
            // Handle Heartbeat
            if (msgString === 'PING') {
              ws.send('PONG');
              return;
            }

            const message = JSON.parse(msgString);
            this.handleMessage(message);
          } catch (e) {
            console.error('[MiruBridge] Parse error:', e);
          }
        });

        ws.on('close', () => {
          console.log('[MiruBridge] Extension disconnected');
          this.client = null;
          this.connected = false;
          if (this.onConnectionChangeCallback) {
              this.onConnectionChangeCallback(false);
          }
        });

        ws.on('error', (err) => {
          console.error('[MiruBridge] WebSocket error:', err);
        });
      });

      this.wss.on('error', (err) => {
        console.error('[MiruBridge] Server error:', err);
      });

      console.log(`[MiruBridge] WebSocket server init on port ${this.port}`);
      return true;
    } catch (err) {
      console.error('[MiruBridge] Failed to start:', err);
      return false;
    }
  }

  stop() {
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

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      running: this.wss !== null,
      connected: this.connected,
      port: this.port,
    };
  }

  onScrobble(callback) {
    this.onScrobbleCallback = callback;
  }

  onConnectionChange(callback) {
    this.onConnectionChangeCallback = callback;
  }

  // Send message to extension
  send(message) {
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

  handleMessage(message) {
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
        this.handlePlay(message.data);
        break;

      case 'MIRU_PAUSE':
        this.handlePause(message.data);
        break;

      case 'MIRU_PROGRESS':
        this.handleProgress(message.data);
        break;

      default:
        console.warn('[MiruBridge] Unknown message type:', message.type);
    }
  }

  handlePlay(data) {
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

  handlePause(data) {
    const progress = data.duration && data.currentTime
      ? Math.round((data.currentTime / data.duration) * 100)
      : 0;

    console.log('[MiruBridge] Pause:', data.title, 'Progress:', progress + '%');
  }

  handleProgress(data) {
    // console.log('[MiruBridge] Progress:', data.title, data.progress + '%');

    // Check if completed (>75% watched)
    if (data.completed || (data.progress && data.progress >= 75)) {
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
