import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("shokai", {
  store: {
    get: (keyPath) => ipcRenderer.invoke("store:get", keyPath),
    set: (keyPath, value) => ipcRenderer.invoke("store:set", keyPath, value)
  },
  auth: {
    login: () => ipcRenderer.invoke("auth:login"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    onUpdated: (cb) => {
      const handler = (_e, tokens) => cb(tokens);
      ipcRenderer.on("auth:updated", handler);
      return () => ipcRenderer.off("auth:updated", handler);
    }
  },
  anilist: {
    graphql: (query, variables) => ipcRenderer.invoke("anilist:graphql", query, variables)
  },
  notifications: {
    getConfig: () => ipcRenderer.invoke("notifications:getConfig"),
    updateConfig: (config) => ipcRenderer.invoke("notifications:updateConfig", config),
    checkNow: () => ipcRenderer.invoke("notifications:checkNow"),
    getHistory: () => ipcRenderer.invoke("notifications:getHistory")
  }
});
