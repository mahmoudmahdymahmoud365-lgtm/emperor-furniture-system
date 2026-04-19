// ==============================
// Emperor ERP — Enterprise Preload Script
// Secure IPC bridge between renderer and main process
// ==============================

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("emperorAPI", {
  // ---- App Configuration ----
  getConfig: () => ipcRenderer.invoke("app:getConfig"),
  setConfig: (cfg) => ipcRenderer.invoke("app:setConfig", cfg),

  // ---- Backend Management ----
  getBackendStatus: () => ipcRenderer.invoke("app:getBackendStatus"),
  restartBackend: () => ipcRenderer.invoke("app:restartBackend"),

  // ---- Role Selection ----
  selectRole: (role) => ipcRenderer.invoke("app:selectRole", role),
  discoverServer: (host) => ipcRenderer.invoke("app:discoverServer", host),
  autoDiscover: () => ipcRenderer.invoke("app:autoDiscover"),

  // ---- Logs ----
  getLogs: () => ipcRenderer.invoke("app:getLogs"),

  // ---- Tailscale ----
  getTailscaleStatus: () => ipcRenderer.invoke("app:getTailscaleStatus"),

  // ---- Event Listeners ----
  onBackendStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("backend-status", handler);
    return () => ipcRenderer.removeListener("backend-status", handler);
  },

  // ---- Platform Info ----
  platform: process.platform,
  isElectron: true,
});
contextBridge.exposeInMainWorld("__API_URL__", "http://127.0.0.1:3001/api");
contextBridge.exposeInMainWorld("__IS_ELECTRON__", true);
