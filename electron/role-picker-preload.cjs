const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rolePicker", {
  testHost: (host) => ipcRenderer.invoke("picker:testHost", host),
  autoDiscover: () => ipcRenderer.invoke("picker:autoDiscover"),
  save: (cfg) => ipcRenderer.invoke("picker:save", cfg),
});
