import { app, BrowserWindow, ipcMain, shell, Menu } from "electron";
import http from "node:http";
import path from "node:path";
import fs from "node:fs"; // <-- RICHTIG IMPORTIEREN
import { fileURLToPath } from "node:url";
import Store from "electron-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
const isDev = !app.isPackaged;

// Menu ausblenden
Menu.setApplicationMenu(null);

// ════════════════════════════════════════════════════════
// FIX: Preload-Pfad für Production (CORRECTED)
// ════════════════════════════════════════════════════════
function getPreloadPath() {
  if (isDev) {
    // Dev: electron/preload.cjs
    return path.join(__dirname, "preload.cjs");
  } else {
    // Production: Mehrere mögliche Pfade
    const possiblePaths = [
      path.join(__dirname, "preload.cjs"),
      path.join(process.resourcesPath, "app.asar.unpacked", "electron", "preload.cjs"),
      path.join(process.resourcesPath, "preload.cjs"),
      path.join(app.getAppPath(), "electron", "preload.cjs")
    ];
    
    // Teste welcher existiert
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          console.log("[Preload] Using path:", p);
          return p;
        }
      } catch (e) {
        // ignore
      }
    }
    
    // Fallback zum ersten
    console.warn("[Preload] No valid path found! Using fallback:", possiblePaths[0]);
    return possiblePaths[0];
  }
}

const DEFAULT_CLIENT_ID = process.env.ANILIST_CLIENT_ID || "";
const DEFAULT_CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET || "";
const DEFAULT_REDIRECT_URI = process.env.ANILIST_REDIRECT_URI || "http://127.0.0.1:43210/callback";

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
  const preloadPath = getPreloadPath(); // <-- USE HELPER

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

  if (isDev) {
    try {
      await mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } catch (e) {
      console.warn("Vite dev server not running, loading from dist...");
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

          // Hole User ID und speichere sie
          const viewer = await validateAccessToken(data.access_token);
          if (viewer?.id) {
            store.set("anilist.user_id", viewer.id);
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
        res.writeHead(500);
        res.end("error");
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  authHttpServer.listen(port, host, () => {
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

/* --------------------- APP LIFECYCLE --------------------- */
app.whenReady().then(async () => {
  await createWindow();
  startAuthServer();

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
