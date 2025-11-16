// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shokai", {
  // Key/Value Store
  store: {
    get: (key) => ipcRenderer.invoke("store:get", key),
    set: (key, val) => ipcRenderer.invoke("store:set", key, val),
    delete: (key) => ipcRenderer.invoke("store:delete", key),
  },

  // App-Status & Setup
  app: {
    needsSetup: () => ipcRenderer.invoke("app:needsSetup"),
  },

  setup: {
    save: (cfg) => ipcRenderer.invoke("setup:save", cfg),
  },

  // Auth
  auth: {
    login: () => ipcRenderer.invoke("auth:login"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    onUpdated: (cb) => {
      const h = (_e, data) => cb(data);
      ipcRenderer.on("auth:updated", h);
      return () => ipcRenderer.off("auth:updated", h);
    },
  },

  // App-Status (mit viewerId!)
  status: () => ipcRenderer.invoke("app:status"),

  // AniList raw
  anilist: {
    graphql: (query, variables) =>
      ipcRenderer.invoke("anilist:graphql", query, variables),
  },

  // Rec / Engine
  rec: {
    insertEvent: (ev) => ipcRenderer.invoke("rec:insertEvent", ev),
    loadEvents: (userId, limit = 200) =>
      ipcRenderer.invoke("rec:loadEvents", userId, limit),
    getModel: (userId) => ipcRenderer.invoke("rec:getModel", userId),
    setModel: (userId, model) =>
      ipcRenderer.invoke("rec:setModel", userId, model),
  },
});