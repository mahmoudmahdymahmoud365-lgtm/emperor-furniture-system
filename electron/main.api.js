// ==============================
// Electron Main Process (API Server Mode)
// Connects to Express backend instead of SQLite
// ==============================

const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, "../public/logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Inject API URL into renderer
  const apiUrl = process.env.API_URL || "http://localhost:3001/api";
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.executeJavaScript(`window.__API_URL__ = "${apiUrl}";`);
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
