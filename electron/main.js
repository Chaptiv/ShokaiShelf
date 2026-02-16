// electron/main.js (ESM, ohne Tag-Scraper)
import { app, BrowserWindow, ipcMain, shell } from "electron";
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Store from "electron-store";
import { ScrobblerEngine } from "./scrobbler.js";
import { DiscordPresence } from "./discord.js";
import { NotificationEngine } from "./notificationEngine.js";
import { MiruBridge } from "./miruBridge.js";
import { devLog, devWarn, logError } from "./utils/logger.js";
// TEMPORARY: Offline mode disabled due to better-sqlite3 compilation issues
// import { OfflineStore } from "./offlineStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
// const offlineStore = new OfflineStore();
const offlineStore = null; // TEMPORARY
let scrobbler = null;
let discord = null;
let notifications = null;
let miruBridge = null;

// Default-Werte – kannst du gerne leeren, wenn du willst
const DEFAULT_CLIENT_ID = process.env.ANILIST_CLIENT_ID || "";
const DEFAULT_CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET || "";
const DEFAULT_REDIRECT_URI =
  process.env.ANILIST_REDIRECT_URI || "http://127.0.0.1:43210/callback";

function cfg() {
  return {
    client_id: store.get("anilist.client_id") || DEFAULT_CLIENT_ID,
    client_secret: store.get("anilist.client_secret") || DEFAULT_CLIENT_SECRET,
    redirect_uri: store.get("anilist.redirect_uri") || DEFAULT_REDIRECT_URI,
  };
}

let mainWindow = null;
let authHttpServer = null;

/* --------------------- WINDOW --------------------- */
async function createWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");

  devLog("Preload path:", preloadPath);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    title: "ShokaiShelf",
    backgroundColor: "#020617",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    try {
      await mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } catch (e) {
      devWarn("Vite dev server not running, falling back to dist...");
      const indexHtml = path.join(__dirname, "..", "dist", "index.html");
      await mainWindow.loadFile(indexHtml);
    }
  } else {
    const indexHtml = path.join(__dirname, "..", "dist", "index.html");
    await mainWindow.loadFile(indexHtml);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* ------------------- AUTH SERVER ------------------- */
function startAuthServer() {
  if (authHttpServer) return;

  const { client_id, client_secret, redirect_uri } = cfg();
  const u = new URL(redirect_uri);
  const host = u.hostname;
  const port = Number(u.port || 80);

  authHttpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith(u.pathname)) {
      const reqUrl = new URL(req.url, `http://${host}:${port}`);
      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        res.end("missing code");
        return;
      }

      try {
        const tokenRes = await fetch("https://anilist.co/api/v2/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id,
            client_secret,
            redirect_uri,
            code,
          }),
        });
        const data = await tokenRes.json();
        if (data.access_token) {
          store.set("anilist.access_token", data.access_token);
          if (data.refresh_token) {
            store.set("anilist.refresh_token", data.refresh_token);
          }

          // Hole User ID und Username und speichere sie
          const viewer = await validateAccessToken(data.access_token);
          if (viewer?.id) {
            store.set("anilist.user_id", viewer.id);
          }
          if (viewer?.name) {
            store.set("anilist.viewer_name", viewer.name);
          }

          // Update Notifications with new auth
          if (notifications) {
            notifications.updateAuth(data.access_token, viewer?.id?.toString() || null);
          }

          // Update Discord with new username
          if (discord && viewer?.name) {
            discord.updateUsername(viewer.name);
          }

          if (mainWindow) {
            mainWindow.webContents.send("auth:updated", { loggedIn: true });
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShokaiShelf - Anmeldung erfolgreich</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: radial-gradient(circle at top, #101624 0%, #060912 55%, #060912 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .container {
      text-align: center;
      max-width: 500px;
      padding: 40px;
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .checkmark-container {
      width: 120px;
      height: 120px;
      margin: 0 auto 32px;
      position: relative;
    }

    .circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: rgba(0, 212, 255, 0.1);
      border: 3px solid #00d4ff;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .checkmark {
      width: 60px;
      height: 60px;
      stroke: #00d4ff;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      animation: drawCheck 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
    }

    .glow {
      position: absolute;
      inset: -20px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 212, 255, 0.3), transparent 70%);
      opacity: 0;
      animation: pulse 2s ease-in-out 0.5s infinite;
    }

    h1 {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #fff 0%, #00d4ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    p {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .info {
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 16px;
      padding: 20px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.5;
    }

    .info strong {
      color: #00d4ff;
      font-weight: 600;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes drawCheck {
      to {
        stroke-dashoffset: 0;
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 0;
        transform: scale(1);
      }
      50% {
        opacity: 1;
        transform: scale(1.1);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark-container">
      <div class="glow"></div>
      <div class="circle">
        <svg class="checkmark" viewBox="0 0 52 52">
          <path d="M14 27l9 9 16-16" />
        </svg>
      </div>
    </div>

    <h1>Anmeldung erfolgreich!</h1>
    <p>Du wurdest erfolgreich mit AniList verbunden.</p>

    <div class="info">
      Du kannst dieses Fenster jetzt <strong>schließen</strong> und zu ShokaiShelf zurückkehren.
    </div>
  </div>
</body>
</html>`);
        } else {
          res.writeHead(500);
          res.end("login failed");
        }
      } catch (err) {
        logError("auth callback failed:", err);
        res.writeHead(500);
        res.end("error");
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  authHttpServer.listen(port, host, () => {
    devLog(`Auth server listening on http://${host}:${port}/callback`);
  });
}

/* ------------------- HELPERS ------------------- */
async function validateAccessToken(accessToken) {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `query Viewer { Viewer { id name avatar { large } } }`,
      }),
    });
    const json = await res.json();
    return json?.data?.Viewer ?? null;
  } catch (e) {
    logError("validateAccessToken failed:", e);
    return null;
  }
}

/* --------------------- IPC: STORE --------------------- */
ipcMain.handle("store:get", (_e, key) => {
  return store.get(key);
});

ipcMain.handle("store:set", (_e, key, val) => {
  store.set(key, val);
  return true;
});

ipcMain.handle("store:delete", (_e, key) => {
  store.delete(key);
  return true;
});

/* --------------------- IPC: AUTH --------------------- */
ipcMain.handle("auth:login", async () => {
  const { client_id, redirect_uri } = cfg();
  if (!client_id) throw new Error("AniList Client ID fehlt. Setup öffnen.");
  const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirect_uri);

  await shell.openExternal(authUrl.toString());
  return true;
});

ipcMain.handle("auth:logout", async () => {
  store.delete("anilist.access_token");
  store.delete("anilist.refresh_token");
  store.delete("anilist.user_id");

  // Update Notifications with cleared auth
  if (notifications) {
    notifications.updateAuth(null, null);
  }

  if (mainWindow) {
    mainWindow.webContents.send("auth:updated", { loggedIn: false });
  }
  return true;
});

/* --------------------- IPC: STATUS (nur 1x!) --------------------- */
ipcMain.handle("app:status", async () => {
  const { client_id, client_secret, redirect_uri } = cfg();
  const hasCreds = !!client_id && !!client_secret;

  const access_token =
    store.get("anilist.access_token") ||
    (store.get("anilist")?.access_token ?? "");

  let loggedIn = false;
  let viewer = null;
  if (access_token) {
    const v = await validateAccessToken(access_token);
    if (v) {
      loggedIn = true;
      viewer = v;
    }
  }

  return {
    hasCreds,
    loggedIn,
    viewerId: viewer?.id ?? null,
    viewerName: viewer?.name ?? null,
    avatar: viewer?.avatar?.large ?? null,
    redirect: redirect_uri,
  };
});

/* --------------------- IPC: AniList GraphQL --------------------- */
ipcMain.handle("anilist:graphql", async (_e, query, variables = {}) => {
  const access_token =
    store.get("anilist.access_token") ||
    (store.get("anilist")?.access_token ?? "");

  const headers = { "Content-Type": "application/json" };
  if (access_token) headers.Authorization = `Bearer ${access_token}`;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return await res.json();
});

/* --------------------- IPC: Rec / Engine --------------------- */
ipcMain.handle("rec:insertEvent", (_e, ev) => {
  const all = store.get("rec.events") || [];
  all.push(ev);
  store.set("rec.events", all.slice(-500));
  return true;
});

ipcMain.handle("rec:loadEvents", (_e, userId, limit = 200) => {
  const all = store.get("rec.events") || [];
  const uid = String(userId);
  const filtered = all.filter((x) => String(x.userId) === uid);
  return filtered.slice(-limit);
});

ipcMain.handle("rec:getModel", (_e, userId) => {
  const models = store.get("rec.models") || {};
  return models[String(userId)] || null;
});

ipcMain.handle("rec:setModel", (_e, userId, model) => {
  const models = store.get("rec.models") || {};
  models[String(userId)] = model;
  store.set("rec.models", models);
  return true;
});

/* --------------------- IPC: APP SETUP --------------------- */
ipcMain.handle("app:needsSetup", async () => {
  const { client_id, client_secret } = cfg();
  return !client_id || !client_secret;
});

ipcMain.handle("setup:save", async (_e, { client_id, client_secret, redirect_uri }) => {
  store.set("anilist.client_id", client_id);
  store.set("anilist.client_secret", client_secret);
  if (redirect_uri) {
    store.set("anilist.redirect_uri", redirect_uri);
  }
  return true;
});

/* --------------------- IPC: SCROBBLER --------------------- */
ipcMain.handle("scrobbler:getStatus", () => {
  if (!scrobbler) return { success: false, error: "Scrobbler not initialized" };
  return { success: true, status: scrobbler.getStatus() };
});

ipcMain.handle("scrobbler:updateConfig", (_e, cfg) => {
  if (!scrobbler) return { success: false, error: "Scrobbler not initialized" };
  return scrobbler.updateConfig(cfg);
});

ipcMain.handle("scrobbler:debugMatch", async () => {
  if (!scrobbler) return { error: "Scrobbler not initialized" };
  return await scrobbler.debugMatch();
});

ipcMain.handle("scrobbler:confirmMatch", (_e, title, mediaId) => {
  if (!scrobbler) return { success: false, error: "Scrobbler not initialized" };
  return scrobbler.confirmMatch(title, mediaId);
});

ipcMain.handle("scrobbler:removeAlias", (_e, alias) => {
  if (!scrobbler) return { success: false, error: "Scrobbler not initialized" };
  return scrobbler.removeAlias(alias);
});

/* --------------------- IPC: DISCORD RPC --------------------- */
ipcMain.handle("discord:getStatus", () => {
  if (!discord) return { error: "Discord not initialized" };
  return discord.getStatus();
});

ipcMain.handle("discord:setEnabled", (_e, enabled) => {
  if (!discord) return { success: false, error: "Discord not initialized" };
  return discord.setEnabled(enabled);
});

ipcMain.handle("discord:setActivity", (_e, activity) => {
  if (!discord) return { success: false, error: "Discord not initialized" };
  return discord.setActivity(activity);
});

ipcMain.handle("discord:clearActivity", () => {
  if (!discord) return { success: false, error: "Discord not initialized" };
  return discord.clearActivity();
});

/* --------------------- IPC: NOTIFICATIONS --------------------- */
ipcMain.handle("system:notify", async (_e, { title, body }) => {
  const { Notification } = await import("electron");
  try {
    if (!Notification.isSupported()) return { success: false };
    new Notification({ title, body, silent: false }).show();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("miru:status", async () => {
  if (!miruBridge) return { running: false, connected: false, port: 9876 };
  return miruBridge.getStatus();
});

ipcMain.handle("miru:start", async () => {
  if (!miruBridge) {
    miruBridge = new MiruBridge();
  }
  const success = miruBridge.start();
  return { success };
});

ipcMain.handle("miru:stop", async () => {
  if (miruBridge) {
    miruBridge.stop();
  }
  return { success: true };
});

ipcMain.handle("notifications:getConfig", () => {
  if (!notifications) return { error: "Notifications not initialized" };
  return notifications.getConfig();
});

ipcMain.handle("notifications:updateConfig", (_e, config) => {
  if (!notifications) return { success: false, error: "Notifications not initialized" };
  return notifications.updateConfig(config);
});

ipcMain.handle("notifications:checkNow", async () => {
  if (!notifications) return { success: false, error: "Notifications not initialized" };
  return await notifications.checkNow();
});

ipcMain.handle("notifications:getHistory", () => {
  if (!notifications) return [];
  return notifications.getHistory();
});

ipcMain.handle("notifications:test", async () => {
  if (!notifications) return { success: false, error: "Notifications not initialized" };
  return await notifications.test();
});

/* --------------------- IPC: OFFLINE MODE --------------------- */
ipcMain.handle("offline:cacheLibrary", async (_e, userId, entries) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    offlineStore.cacheLibrary(userId, entries);
    return { success: true };
  } catch (err) {
    logError("[Main] Cache library failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("offline:getCachedLibrary", async (_e, userId) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available", entries: [] };
  try {
    const entries = offlineStore.getCachedLibrary(userId);
    return { success: true, entries };
  } catch (err) {
    logError("[Main] Get cached library failed:", err);
    return { success: false, error: err.message, entries: [] };
  }
});

ipcMain.handle("offline:getCachedEntry", async (_e, userId, mediaId) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available", entry: null };
  try {
    const entry = offlineStore.getCachedEntryByMediaId(userId, mediaId);
    return { success: true, entry };
  } catch (err) {
    return { success: false, error: err.message, entry: null };
  }
});

ipcMain.handle("offline:updateCachedEntry", async (_e, userId, mediaId, updates) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    offlineStore.updateCachedEntry(userId, mediaId, updates);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("offline:isCacheValid", async (_e, userId) => {
  if (!offlineStore) return { success: false, valid: false, lastCacheTime: 0 };
  try {
    const valid = offlineStore.isCacheValid(userId);
    const lastCacheTime = offlineStore.getLastCacheTime(userId);
    return { success: true, valid, lastCacheTime };
  } catch (err) {
    return { success: false, valid: false, lastCacheTime: 0 };
  }
});

ipcMain.handle("offline:enqueue", async (_e, userId, action, payload) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    const id = offlineStore.enqueue(userId, action, payload);
    return { success: true, id };
  } catch (err) {
    logError("[Main] Enqueue failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("offline:getPendingQueue", async (_e, userId) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available", queue: [] };
  try {
    const queue = offlineStore.getPendingQueue(userId);
    return { success: true, queue };
  } catch (err) {
    return { success: false, error: err.message, queue: [] };
  }
});

ipcMain.handle("offline:getQueueCount", async (_e, userId) => {
  if (!offlineStore) return 0;
  try {
    const count = offlineStore.getQueueCount(userId);
    return count;
  } catch (err) {
    return 0;
  }
});

ipcMain.handle("offline:markSynced", async (_e, id) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    offlineStore.markSynced(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("offline:markFailed", async (_e, id, error) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    offlineStore.markFailed(id, error);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("offline:removeFromQueue", async (_e, id) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    offlineStore.removeFromQueue(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("offline:processQueueItem", async (_e, id, action, payload) => {
  if (!offlineStore) return { success: false, error: "Offline mode not available" };
  try {
    const accessToken = store.get("anilist.access_token") || store.get("anilist")?.access_token;
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    if (action === "save") {
      const mutation = `
        mutation SaveMediaListEntry($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
          SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
            id
            status
            progress
            score
          }
        }
      `;
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: payload,
        }),
      });

      const result = await response.json();
      if (result.errors) {
        throw new Error(result.errors[0]?.message || "GraphQL error");
      }
    } else if (action === "delete") {
      const mutation = `
        mutation DeleteMediaListEntry($id: Int) {
          DeleteMediaListEntry(id: $id) {
            deleted
          }
        }
      `;
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { id: payload.entryId },
        }),
      });

      const result = await response.json();
      if (result.errors) {
        throw new Error(result.errors[0]?.message || "GraphQL error");
      }
    }

    offlineStore.markSynced(id);
    return { success: true };
  } catch (err) {
    logError("[Main] Process queue item failed:", err);
    if (offlineStore) offlineStore.markFailed(id, err.message);
    throw err;
  }
});

/* --------------------- IPC: ACHIEVEMENTS --------------------- */
ipcMain.handle("achievement:notify", async (_e, achievement) => {
  const { Notification } = await import("electron");
  try {
    if (!Notification.isSupported()) {
      devLog("[Main] System notifications not supported");
      return { success: false, error: "Notifications not supported" };
    }

    const notification = new Notification({
      title: "Achievement Unlocked!",
      body: `${achievement.icon} ${achievement.name}\n${achievement.description}`,
      silent: false,
    });

    notification.show();
    devLog("[Main] Achievement notification shown:", achievement.name);
    return { success: true };
  } catch (err) {
    logError("[Main] Achievement notification error:", err);
    return { success: false, error: err.message };
  }
});

/* --------------------- AUTO-UPDATER --------------------- */
function setupAutoUpdater() {
  if (!app.isPackaged) {
    devLog('[Updater] Skipping auto-updater in dev mode');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdaterStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdaterStatus({ status: 'idle' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterStatus({ status: 'downloading', progress: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterStatus({ status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logError('[Updater] Error:', err);
    sendUpdaterStatus({ status: 'error', error: err?.message || 'Unknown error' });
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logError('[Updater] Initial check failed:', err);
    });
  }, 10000);

  // Re-check every 2 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => { });
  }, 2 * 60 * 60 * 1000);
}

function sendUpdaterStatus(info) {
  if (mainWindow) {
    mainWindow.webContents.send('updater:status', info);
  }
}

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { success: false, error: 'Dev mode' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

/* --------------------- APP LIFECYCLE --------------------- */
app.whenReady().then(async () => {
  await createWindow();
  startAuthServer();

  // Initialize Scrobbler
  scrobbler = new ScrobblerEngine(store);
  scrobbler.onDetection((candidate) => {
    if (mainWindow) {
      mainWindow.webContents.send("scrobbler:detected", candidate);
    }
  });

  // Initialize Discord RPC
  discord = new DiscordPresence(store);

  // Initialize Notifications
  notifications = new NotificationEngine(store);

  // Initialize Miru Bridge
  miruBridge = new MiruBridge();
  miruBridge.start();

  // Forward scrobble events to renderer, checking for known matches first
  miruBridge.onScrobble((data) => {
    if (scrobbler) {
      const knownId = scrobbler.findMatch(data.title);
      if (knownId) {
        data.mediaId = knownId;
        devLog(`[Main] Scrobbler match found: ${data.title} -> ${knownId}`);
      }
    }

    if (mainWindow) {
      mainWindow.webContents.send('miru:scrobble', data);
    }
  });

  miruBridge.onConnectionChange((connected) => {
    devLog(`[Main] Miru extension ${connected ? 'connected' : 'disconnected'}`);
    if (mainWindow) {
      mainWindow.webContents.send('miru:connection', { connected });
    }
  });

  // Initialize Auto-Updater
  setupAutoUpdater();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (offlineStore) {
    offlineStore.close();
  }
});
