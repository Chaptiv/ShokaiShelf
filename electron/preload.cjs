// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shokai", {
  // Key/Value Store
  store: {
    get: (key) => ipcRenderer.invoke("store:get", key),
    set: (key, val) => ipcRenderer.invoke("store:set", key, val),
    delete: (key) => ipcRenderer.invoke("store:delete", key),
  },

  // App-Status
  app: {
    notify: (data) => ipcRenderer.invoke("system:notify", data),
  },

  // Auth
  auth: {
    loginBeta: () => ipcRenderer.invoke("auth:login-beta"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    onUpdated: (cb) => {
      const h = (_e, data) => cb(data);
      ipcRenderer.on("auth:updated", h);
      return () => ipcRenderer.off("auth:updated", h);
    },
  },

  // App status (with viewerId!)
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

  // Discord RPC
  discord: {
    getStatus: () => ipcRenderer.invoke("discord:getStatus"),
    setEnabled: (enabled) => ipcRenderer.invoke("discord:setEnabled", enabled),
    setActivity: (activity) => ipcRenderer.invoke("discord:setActivity", activity),
    clearActivity: () => ipcRenderer.invoke("discord:clearActivity"),
  },

  // Notifications
  notifications: {
    getConfig: () => ipcRenderer.invoke("notifications:getConfig"),
    updateConfig: (config) => ipcRenderer.invoke("notifications:updateConfig", config),
    checkNow: () => ipcRenderer.invoke("notifications:checkNow"),
    getHistory: () => ipcRenderer.invoke("notifications:getHistory"),
    test: () => ipcRenderer.invoke("notifications:test"),
  },

  // Offline Mode
  offline: {
    // Library cache
    cacheLibrary: (userId, entries) =>
      ipcRenderer.invoke("offline:cacheLibrary", userId, entries),
    getCachedLibrary: (userId) =>
      ipcRenderer.invoke("offline:getCachedLibrary", userId),
    getCachedEntry: (userId, mediaId) =>
      ipcRenderer.invoke("offline:getCachedEntry", userId, mediaId),
    updateCachedEntry: (userId, mediaId, updates) =>
      ipcRenderer.invoke("offline:updateCachedEntry", userId, mediaId, updates),
    isCacheValid: (userId) =>
      ipcRenderer.invoke("offline:isCacheValid", userId),

    // Sync queue
    enqueue: (userId, action, payload) =>
      ipcRenderer.invoke("offline:enqueue", userId, action, payload),
    getPendingQueue: (userId) =>
      ipcRenderer.invoke("offline:getPendingQueue", userId),
    getQueueCount: (userId) =>
      ipcRenderer.invoke("offline:getQueueCount", userId),
    markSynced: (id) =>
      ipcRenderer.invoke("offline:markSynced", id),
    markFailed: (id, error) =>
      ipcRenderer.invoke("offline:markFailed", id, error),
    removeFromQueue: (id) =>
      ipcRenderer.invoke("offline:removeFromQueue", id),
    processQueueItem: (id, action, payload) =>
      ipcRenderer.invoke("offline:processQueueItem", id, action, payload),
  },

  // Auto-Updater
  updater: {
    checkForUpdate: () => ipcRenderer.invoke("updater:check"),
    installUpdate: () => ipcRenderer.invoke("updater:install"),
    onStatus: (cb) => {
      const handler = (_e, info) => cb(info);
      ipcRenderer.on("updater:status", handler);
      return () => ipcRenderer.removeListener("updater:status", handler);
    },
  },
});