// ==============================
// Emperor ERP — Enterprise Preload Script
// Secure bridge between renderer and main process
// ==============================

const { contextBridge, ipcRenderer } = require("electron");

// Allowed IPC channels for security
const ALLOWED_INVOKE = [
  "app:getConfig",
  "app:setConfig",
  "app:getBackendStatus",
  "app:restartBackend",
  "app:getLogs",
  "app:selectRole",
  "app:discoverServer",
];

const ALLOWED_RECEIVE = [
  "backend-status",
];

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

  // ---- Logs ----
  getLogs: () => ipcRenderer.invoke("app:getLogs"),

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
