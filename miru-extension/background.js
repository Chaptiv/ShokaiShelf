// ShokaiShelf Miru - Background Service Worker
// Connects to ShokaiShelf via WebSocket and relays scrobble events

const SHOKAISHELF_PORT = 9876;
const BASE_RECONNECT_DELAY = 1000; // Start with 1s
const MAX_RECONNECT_DELAY = 60000; // Max 60s
const PING_INTERVAL = 15000; // Send ping every 15s
const PING_TIMEOUT = 5000; // Expect pong within 5s

class MiruBridge {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.currentMedia = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.pingInterval = null;
    this.pingTimeout = null;
    this.lastPongTime = null;

    this.connect();
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(`ws://localhost:${SHOKAISHELF_PORT}`);

      this.ws.onopen = () => {
        console.log('[Miru] Connected to ShokaiShelf');
        this.connected = true;
        this.reconnectAttempts = 0; // Reset reconnect attempts
        this.updateBadge(true);
        this.clearReconnectTimer();
        this.startHeartbeat();
      };

      this.ws.onclose = () => {
        console.log('[Miru] Disconnected from ShokaiShelf');
        this.connected = false;
        this.stopHeartbeat();
        this.updateBadge(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[Miru] WebSocket error:', err);
        this.connected = false;
        this.updateBadge(false);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          console.error('[Miru] Failed to parse message:', e);
        }
      };
    } catch (err) {
      console.error('[Miru] Connection failed:', err);
      this.connected = false;
      this.updateBadge(false);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    console.log(`[Miru] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      console.log('[Miru] Attempting reconnect...');
      this.connect();
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING', timestamp: Date.now() });

        // Set timeout for PONG response
        this.pingTimeout = setTimeout(() => {
          console.warn('[Miru] Ping timeout - no PONG received, reconnecting');
          this.reconnect();
        }, PING_TIMEOUT);
      }
    }, PING_INTERVAL);

    console.log('[Miru] Heartbeat started');
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  reconnect() {
    console.log('[Miru] Forcing reconnect');
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
    this.connected = false;
    this.updateBadge(false);
    this.scheduleReconnect();
  }

  handlePong() {
    // Clear ping timeout when PONG received
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
    this.lastPongTime = Date.now();
  }

  updateBadge(connected) {
    if (connected) {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    } else {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    console.warn('[Miru] Cannot send - not connected');
    return false;
  }

  handleMessage(message) {
    // Handle PONG responses for heartbeat
    if (message.type === 'PONG') {
      this.handlePong();
      return;
    }

    // Handle other messages from ShokaiShelf if needed
    console.log('[Miru] Received from ShokaiShelf:', message);
  }

  // Public API
  onPlay(data) {
    this.currentMedia = data;
    this.send({
      type: 'MIRU_PLAY',
      data: {
        ...data,
        timestamp: Date.now(),
      },
    });
  }

  onPause(data) {
    this.send({
      type: 'MIRU_PAUSE',
      data: {
        ...data,
        timestamp: Date.now(),
      },
    });
  }

  onProgress(data) {
    this.send({
      type: 'MIRU_PROGRESS',
      data: {
        ...data,
        timestamp: Date.now(),
      },
    });
  }

  getStatus() {
    return {
      connected: this.connected,
      currentMedia: this.currentMedia,
    };
  }
}

// ============================================================================
// CUSTOM SITE MANAGER
// ============================================================================

class CustomSiteManager {
  constructor() {
    this.customSites = [];
    this.loadCustomSites();
  }

  async loadCustomSites() {
    try {
      const result = await chrome.storage.sync.get(['customSites']);
      this.customSites = (result.customSites || []).filter(site => site.enabled);
      console.log('[CustomSites] Loaded', this.customSites.length, 'enabled custom sites');
    } catch (e) {
      console.error('[CustomSites] Failed to load:', e);
      this.customSites = [];
    }
  }

  async checkAndInject(tabId, url) {
    for (const site of this.customSites) {
      if (this.matchesDomain(url, site.domain)) {
        console.log('[CustomSites] Injecting detector for:', site.name);

        try {
          // Inject generic detector script
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/generic-detector.js'],
          });

          // Initialize with config
          await chrome.scripting.executeScript({
            target: { tabId },
            func: (config) => {
              if (typeof window.initGenericDetector === 'function') {
                window.initGenericDetector(config);
              }
            },
            args: [site],
          });

          console.log('[CustomSites] Successfully injected for:', site.name);
          break; // Only inject for first matching site
        } catch (e) {
          console.error('[CustomSites] Injection failed:', e);
        }
      }
    }
  }

  matchesDomain(url, pattern) {
    // Convert domain pattern to regex
    // *.example.com -> ^https?://[^/]*\.example\.com
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^/]*');

    const regex = new RegExp(`^https?:\\/\\/${regexPattern}`, 'i');
    return regex.test(url);
  }
}

// Initialize managers
const bridge = new MiruBridge();
const customSiteManager = new CustomSiteManager();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Miru] Received from content script:', message);

  switch (message.type) {
    case 'MIRU_PLAY':
      bridge.onPlay(message.data);
      sendResponse({ success: true });
      break;

    case 'MIRU_PAUSE':
      bridge.onPause(message.data);
      sendResponse({ success: true });
      break;

    case 'MIRU_PROGRESS':
      bridge.onProgress(message.data);
      sendResponse({ success: true });
      break;

    case 'GET_STATUS':
      sendResponse(bridge.getStatus());
      break;

    case 'RELOAD_CUSTOM_SITES':
      customSiteManager.loadCustomSites().then(() => {
        sendResponse({ success: true });
      });
      return true; // Async response

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Listen for tab navigation to inject custom site detectors
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    customSiteManager.checkAndInject(tabId, tab.url);
  }
});

// Periodic connection check using Chrome Alarms (survives service worker suspension)
chrome.alarms.create('keepalive', { periodInMinutes: 0.5 }); // Every 30 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive' && !bridge.connected) {
    console.log('[Miru] Keepalive check - attempting to connect');
    bridge.connect();
  }
});

console.log('[Miru] Background service worker started');
