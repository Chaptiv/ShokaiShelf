// electron/main.js (ESM, ohne Tag-Scraper)
import { app, BrowserWindow, ipcMain, shell } from "electron";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Store from "electron-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

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
  
  console.log("Preload path:", preloadPath);

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
      console.warn("Vite dev server not running, falling back to dist...");
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
          if (mainWindow) {
            mainWindow.webContents.send("auth:updated", { loggedIn: true });
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>ShokaiShelf: Anmeldung erfolgreich.</h2>");
        } else {
          res.writeHead(500);
          res.end("login failed");
        }
      } catch (err) {
        console.error("auth callback failed:", err);
        res.writeHead(500);
        res.end("error");
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  authHttpServer.listen(port, host, () => {
    console.log(`Auth server listening on http://${host}:${port}/callback`);
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
    console.error("validateAccessToken failed:", e);
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
