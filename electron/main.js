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

// Default values - feel free to empty if you want
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
    // Legacy Code Grant Callback OR Implicit Grant (Beta)
    if (req.method === "GET" && req.url.startsWith(u.pathname)) {
      const reqUrl = new URL(req.url, `http://${host}:${port}`);
      const code = reqUrl.searchParams.get("code");

      // No code param → Implicit Grant (Beta flow)
      // The access_token is in the URL fragment (#), which the server cannot see.
      // Serve an HTML page that extracts it client-side and POSTs it back.
      if (!code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ShokaiShelf - Authenticating...</title>
  <style>
    body { font-family: 'Inter', -apple-system, sans-serif; background: #060912; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .container { text-align: center; max-width: 400px; padding: 40px; }
    h2 { font-size: 24px; margin-bottom: 16px; }
    p { color: rgba(255,255,255,0.6); line-height: 1.6; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #00d4ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Completing Login...</h2>
    <p id="msg">Verifying your token...</p>
  </div>
  <script>
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
      fetch('http://${host}:${port}/beta-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      }).then(r => {
        if (r.ok) {
          document.getElementById('msg').textContent = 'Login successful! You can close this window.';
          document.querySelector('.spinner').style.display = 'none';
          document.querySelector('h2').textContent = '✓ Connected!';
        } else {
          document.getElementById('msg').textContent = 'Failed to save token.';
          document.querySelector('.spinner').style.display = 'none';
        }
      }).catch(() => {
        document.getElementById('msg').textContent = 'Connection error.';
        document.querySelector('.spinner').style.display = 'none';
      });
    } else {
      document.getElementById('msg').textContent = 'No token found. Please try again.';
      document.querySelector('.spinner').style.display = 'none';
    }
  </script>
</body>
</html>`);
        return;
      }

      try {
        const { client_id: cid, client_secret: csecret, redirect_uri: ruri } = cfg();
        const tokenRes = await fetch("https://anilist.co/api/v2/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: cid,
            client_secret: csecret,
            redirect_uri: ruri,
            code,
          }),
        });
        const data = await tokenRes.json();
        if (data.access_token) {
          store.set("anilist.access_token", data.access_token);
          if (data.refresh_token) {
            store.set("anilist.refresh_token", data.refresh_token);
          }

          // Fetch User ID and Username and save them
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShokaiShelf - Login successful</title>
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

    <h1>Login successful!</h1>
    <p>You have been successfully connected to AniList.</p>

    <div class="info">
      You can now <strong>close</strong> this window and return to ShokaiShelf.
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

    // Beta Implicit Grant Callback – serves HTML page to capture #access_token from URL fragment
    if (req.method === "GET" && req.url.startsWith("/beta-callback")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ShokaiShelf - Authenticating...</title>
  <style>
    body { font-family: 'Inter', -apple-system, sans-serif; background: #060912; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .container { text-align: center; max-width: 400px; padding: 40px; }
    h2 { font-size: 24px; margin-bottom: 16px; }
    p { color: rgba(255,255,255,0.6); line-height: 1.6; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #00d4ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2 id="title">Completing Login...</h2>
    <p id="msg">Verifying your token...</p>
  </div>
  <script>
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
      fetch('http://127.0.0.1:43210/beta-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      }).then(r => {
        document.querySelector('.spinner').style.display = 'none';
        if (r.ok) {
          document.getElementById('title').textContent = '\u2713 Connected!';
          document.getElementById('msg').textContent = 'Login successful! You can close this window.';
        } else {
          document.getElementById('title').textContent = 'Login Failed';
          document.getElementById('msg').textContent = 'Could not save token.';
        }
      }).catch(() => {
        document.querySelector('.spinner').style.display = 'none';
        document.getElementById('title').textContent = 'Login Failed';
        document.getElementById('msg').textContent = 'Connection error.';
      });
    } else {
      document.querySelector('.spinner').style.display = 'none';
      document.getElementById('title').textContent = 'Login Failed';
      document.getElementById('msg').textContent = 'No access token found. Please try again.';
    }
  </script>
</body>
</html>`);
      return;
    }

    // Endpoint to receive the token from the beta-callback page
    if (req.method === "POST" && req.url === "/beta-token") {
      let body = "";
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { access_token } = JSON.parse(body);
          if (access_token) {
            store.set("anilist.access_token", access_token);

            const viewer = await validateAccessToken(access_token);
            if (viewer?.id) store.set("anilist.user_id", viewer.id);
            if (viewer?.name) store.set("anilist.viewer_name", viewer.name);

            if (notifications) notifications.updateAuth(access_token, viewer?.id?.toString() || null);
            if (discord && viewer?.name) discord.updateUsername(viewer.name);

            if (mainWindow) mainWindow.webContents.send("auth:updated", { loggedIn: true });

            res.writeHead(200);
            res.end("ok");
          } else {
            res.writeHead(400); res.end("No token provided");
          }
        } catch (e) {
          logError("Beta token save error:", e);
          res.writeHead(500); res.end("error");
        }
      });
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

ipcMain.handle("auth:login-beta", async () => {
  // Implicit Grant per AniList docs – only client_id + response_type=token needed
  // AniList redirects to the registered redirect URL with #access_token in the fragment
  const BETA_CLIENT_ID = "36791";

  const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize");
  authUrl.searchParams.set("client_id", BETA_CLIENT_ID);
  authUrl.searchParams.set("response_type", "token");

  // Ensure the auth server is running to handle /beta-callback and /beta-token
  if (!authHttpServer || !authHttpServer.listening) {
    startAuthServer();
  }

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
let updateUrl = null;

function setupAutoUpdater() {
  // Check for updates shortly after startup
  setTimeout(checkForUpdate, 8000);
  // Re-check every 12 hours
  setInterval(checkForUpdate, 12 * 60 * 60 * 1000);
}

function sendUpdaterStatus(info) {
  if (mainWindow) {
    mainWindow.webContents.send('updater:status', info);
  }
}

async function checkForUpdate() {
  try {
    devLog('[Updater] Checking for updates on GitHub...');
    const res = await fetch("https://api.github.com/repos/Chaptiv/ShokaiShelf/releases/latest", {
      headers: {
        "User-Agent": "ShokaiShelf",
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!res.ok) {
      devLog('[Updater] GitHub API failed: ' + res.status);
      return { success: false, error: 'GitHub API failed' };
    }

    const data = await res.json();
    if (!data || !data.tag_name) return { success: false, error: 'Invalid response' };

    const latestVersion = data.tag_name.replace(/^v/, '');
    const currentVersion = app.getVersion();

    // Naive version compare (e.g., 0.2.3 vs 0.2.2)
    const v1parts = latestVersion.split('.').map(Number);
    const v2parts = currentVersion.split('.').map(Number);

    let isNewer = false;
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
        const v1 = v1parts[i] || 0;
        const v2 = v2parts[i] || 0;
        if (v1 > v2) { isNewer = true; break; }
        if (v1 < v2) { break; }
    }

    if (isNewer) {
      devLog(`[Updater] New version available: ${latestVersion} (Current: ${currentVersion})`);
      updateUrl = data.html_url;
      sendUpdaterStatus({
        status: "ready", // Re-use "ready" status so the UI shows the action button
        version: latestVersion,
        releaseNotes: data.body,
      });
      return { success: true, version: latestVersion };
    } else {
      devLog(`[Updater] App is up to date (${currentVersion})`);
      return { success: false, message: 'Up to date' };
    }
  } catch (e) {
    logError('[Updater] Check failed:', e);
    return { success: false, error: e.message };
  }
}

ipcMain.handle('updater:check', async () => {
  return await checkForUpdate();
});

ipcMain.handle('updater:install', async () => {
  if (updateUrl) {
    await shell.openExternal(updateUrl);
  } else {
    await shell.openExternal("https://github.com/Chaptiv/ShokaiShelf/releases/latest");
  }
  return { success: true };
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

  // Forward scrobble events to renderer AND auto-update AniList if appropriate
  miruBridge.onScrobble(async (data) => {
    // Try to find a known AniList mediaId for this title
    if (scrobbler) {
      const knownId = scrobbler.findMatch(data.title);
      if (knownId) {
        data.mediaId = knownId;
        devLog(`[Miru/Scrobble] Scrobbler match found: ${data.title} -> ${knownId}`);
      }
    }

    // Forward to renderer for UI display
    if (mainWindow) {
      mainWindow.webContents.send('miru:scrobble', data);
    }

    // --- AUTO-SCROBBLE: Only proceed if episode is completed and we have episode number ---
    if (!data.completed || !data.episode) {
      devLog(`[Miru/Scrobble] Skipping auto-update (completed=${data.completed}, episode=${data.episode})`);
      return;
    }

    const accessToken = store.get("anilist.access_token");
    if (!accessToken) {
      devLog("[Miru/Scrobble] No access token, skipping auto-update");
      return;
    }

    try {
      const watchedEpisode = data.episode;
      let mediaId = data.mediaId;

      // Step 1: If we don't have a mediaId, search AniList for this title
      if (!mediaId) {
        devLog(`[Miru/Scrobble] Searching AniList for: "${data.title}"`);
        const searchRes = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify({
            query: `query($search:String){
              Page(perPage:5){
                media(search:$search,type:ANIME){
                  id title{romaji english native}
                }
              }
            }`,
            variables: { search: data.title },
          }),
        });
        const searchData = await searchRes.json();
        const results = searchData?.data?.Page?.media;

        if (!results || results.length === 0) {
          devLog(`[Miru/Scrobble] No AniList results for "${data.title}"`);
          return;
        }

        // Use the first result (best match)
        mediaId = results[0].id;
        const matchedTitle = results[0].title.english || results[0].title.romaji;
        devLog(`[Miru/Scrobble] Matched to: ${matchedTitle} (ID: ${mediaId})`);

        // Save the match for future lookups
        if (scrobbler) {
          scrobbler.confirmMatch(data.title, mediaId);
          devLog(`[Miru/Scrobble] Saved alias: "${data.title}" -> ${mediaId}`);
        }
      }

      // Step 2: Check the user's current progress for this anime
      const listRes = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({
          query: `query($mediaId:Int){
            Media(id:$mediaId){
              id episodes
              mediaListEntry{
                id status progress
              }
            }
          }`,
          variables: { mediaId },
        }),
      });
      const listData = await listRes.json();
      const media = listData?.data?.Media;

      if (!media) {
        devLog(`[Miru/Scrobble] Could not fetch media info for ID ${mediaId}`);
        return;
      }

      const entry = media.mediaListEntry;
      const currentProgress = entry?.progress || 0;
      const totalEpisodes = media.episodes; // null if unknown/airing

      devLog(`[Miru/Scrobble] Current progress: ${currentProgress}/${totalEpisodes || '?'}, watched episode: ${watchedEpisode}`);

      // Step 3: Only update if the watched episode is the NEXT expected one
      if (watchedEpisode !== currentProgress + 1) {
        devLog(`[Miru/Scrobble] Episode ${watchedEpisode} is NOT the next expected (${currentProgress + 1}), skipping update`);
        return;
      }

      // Step 4: Determine the new status
      let newStatus = entry?.status || "CURRENT";
      if (!entry) {
        // Not on list yet — add it as CURRENT
        newStatus = "CURRENT";
      }
      // If this is the last episode, mark as COMPLETED
      if (totalEpisodes && watchedEpisode >= totalEpisodes) {
        newStatus = "COMPLETED";
      }

      // Step 5: Update AniList
      devLog(`[Miru/Scrobble] Updating AniList: episode ${watchedEpisode}, status: ${newStatus}`);
      const updateRes = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({
          query: `mutation($mediaId:Int!,$status:MediaListStatus,$progress:Int){
            SaveMediaListEntry(mediaId:$mediaId,status:$status,progress:$progress){
              id progress status
            }
          }`,
          variables: { mediaId, status: newStatus, progress: watchedEpisode },
        }),
      });
      const updateData = await updateRes.json();

      if (updateData?.data?.SaveMediaListEntry) {
        devLog(`[Miru/Scrobble] ✓ Updated "${data.title}" to episode ${watchedEpisode} (${newStatus})`);
        // Notify renderer about the successful update
        if (mainWindow) {
          mainWindow.webContents.send('miru:updated', {
            mediaId,
            title: data.title,
            episode: watchedEpisode,
            status: newStatus,
          });
        }
      } else {
        devLog(`[Miru/Scrobble] ✗ Update failed:`, JSON.stringify(updateData?.errors || updateData));
      }

    } catch (err) {
      logError("[Miru/Scrobble] Auto-update error:", err);
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
