// ==============================
// Emperor ERP — Auto-Update Module for Electron
// Supports GitHub Releases or custom update server
// ==============================

const { autoUpdater } = require("electron-updater");
const { dialog, BrowserWindow, ipcMain } = require("electron");

let updateAvailable = false;
let downloadProgress = 0;
let logFn = console.log;

function initAutoUpdater(options = {}) {
  const { logger, feedUrl } = options;
  if (logger) logFn = logger;

  // Configure update source
  if (feedUrl) {
    autoUpdater.setFeedURL(feedUrl);
  }
  // If no feedUrl, electron-updater reads from package.json "build.publish"

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // ==============================
  // Events
  // ==============================
  autoUpdater.on("checking-for-update", () => {
    logFn("info", "Checking for updates...");
    broadcastToRenderer("update-status", { status: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    updateAvailable = true;
    logFn("info", "Update available", { version: info.version });
    broadcastToRenderer("update-status", {
      status: "available",
      version: info.version,
      releaseNotes: info.releaseNotes || "",
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    logFn("info", "No updates available", { version: info.version });
    broadcastToRenderer("update-status", { status: "up-to-date", version: info.version });
  });

  autoUpdater.on("download-progress", (progress) => {
    downloadProgress = Math.round(progress.percent);
    broadcastToRenderer("update-status", {
      status: "downloading",
      progress: downloadProgress,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    logFn("info", "Update downloaded", { version: info.version });
    broadcastToRenderer("update-status", { status: "ready", version: info.version });

    // Show dialog to user
    const win = BrowserWindow.getFocusedWindow();
    dialog.showMessageBox(win, {
      type: "info",
      title: "تحديث جاهز",
      message: `الإصدار ${info.version} جاهز للتثبيت.`,
      detail: "سيتم إعادة تشغيل التطبيق لتطبيق التحديث.",
      buttons: ["تثبيت الآن", "لاحقاً"],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on("error", (err) => {
    logFn("error", "Update error", { error: err.message });
    broadcastToRenderer("update-status", { status: "error", error: err.message });
  });

  // ==============================
  // IPC Handlers
  // ==============================
  ipcMain.handle("updater:check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, version: result?.updateInfo?.version };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle("updater:getStatus", () => ({
    updateAvailable,
    downloadProgress,
  }));
}

function broadcastToRenderer(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send(channel, data); } catch {}
  }
}

/**
 * Check for updates silently on startup (after a delay)
 */
function checkForUpdatesOnStartup(delayMs = 10000) {
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates().catch(() => {});
    } catch {}
  }, delayMs);
}

module.exports = { initAutoUpdater, checkForUpdatesOnStartup };
