// ==============================
// Emperor ERP — Enterprise Electron Main Process
// Self-contained: manages backend lifecycle, single instance, health checks
// ==============================

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");

// ==============================
// CONFIGURATION
// ==============================
const IS_DEV = process.env.NODE_ENV === "development";
const DEFAULT_API_PORT = 3001;
const VITE_DEV_URL = "http://localhost:5173";
const HEALTH_CHECK_INTERVAL = 5000;
const HEALTH_CHECK_TIMEOUT = 3000;
const MAX_STARTUP_WAIT = 30000; // 30s max wait for backend
const CONFIG_FILE = path.join(app.getPath("userData"), "emperor-config.json");
const LOG_DIR = path.join(app.getPath("userData"), "logs");

// ==============================
// LOGGING
// ==============================
function ensureLogDir() {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  console.log(line);
  try {
    ensureLogDir();
    const logFile = path.join(LOG_DIR, `emperor-${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, line + "\n");
  } catch {}
}

// ==============================
// CONFIGURATION MANAGEMENT
// ==============================
function loadConfig() {
  const defaults = {
    role: "server", // "server" or "client"
    apiHost: "localhost",
    apiPort: DEFAULT_API_PORT,
    dbUrl: "",
    autoStartBackend: true,
    vpnMode: false,
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) };
    }
  } catch (e) {
    log("warn", "Failed to load config, using defaults", { error: e.message });
  }
  return defaults;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    log("info", "Config saved", cfg);
  } catch (e) {
    log("error", "Failed to save config", { error: e.message });
  }
}

let config = loadConfig();

function getApiUrl() {
  return `http://${config.apiHost}:${config.apiPort}/api`;
}

// ==============================
// SINGLE INSTANCE LOCK
// ==============================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log("warn", "Another instance is already running. Quitting.");
  app.quit();
}

// ==============================
// BACKEND LIFECYCLE
// ==============================
let backendProcess = null;
let backendReady = false;
let healthCheckTimer = null;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "0.0.0.0");
  });
}

function checkHealth(host, port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/api/health`, { timeout: HEALTH_CHECK_TIMEOUT }, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === "ok");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function startBackend() {
  if (config.role === "client") {
    log("info", "Client mode — skipping backend startup");
    return;
  }

  // Check if backend already running on this port
  const portUsed = await isPortInUse(config.apiPort);
  if (portUsed) {
    const healthy = await checkHealth(config.apiHost, config.apiPort);
    if (healthy) {
      log("info", "Backend already running and healthy on port " + config.apiPort);
      backendReady = true;
      return;
    }
    log("warn", "Port in use but not healthy. Attempting to kill stale process.");
    try {
      if (process.platform === "win32") {
        execSync(`netstat -ano | findstr :${config.apiPort} | findstr LISTENING`, { encoding: "utf8" });
      }
    } catch {}
  }

  const serverPath = IS_DEV
    ? path.join(__dirname, "..", "backend", "src", "server.js")
    : path.join(process.resourcesPath, "backend", "src", "server.js");

  const env = {
    ...process.env,
    PORT: String(config.apiPort),
    NODE_ENV: IS_DEV ? "development" : "production",
    CORS_ORIGIN: IS_DEV ? VITE_DEV_URL : "*",
  };

  if (config.dbUrl) {
    env.DATABASE_URL = config.dbUrl;
  }

  log("info", "Starting backend server", { path: serverPath, port: config.apiPort });

  backendProcess = spawn(process.execPath.includes("electron") ? "node" : process.execPath, [serverPath], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: IS_DEV ? path.join(__dirname, "..") : process.resourcesPath,
  });

  backendProcess.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) log("info", `[backend] ${msg}`);
  });

  backendProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) log("error", `[backend] ${msg}`);
  });

  backendProcess.on("exit", (code, signal) => {
    log("warn", "Backend process exited", { code, signal });
    backendProcess = null;
    backendReady = false;

    // Auto-restart in production
    if (!IS_DEV && code !== 0 && code !== null) {
      log("info", "Auto-restarting backend in 3s...");
      setTimeout(() => startBackend(), 3000);
    }
  });

  backendProcess.on("error", (err) => {
    log("error", "Failed to start backend", { error: err.message });
    backendProcess = null;
  });
}

async function waitForBackend() {
  const start = Date.now();
  const host = config.apiHost;
  const port = config.apiPort;

  while (Date.now() - start < MAX_STARTUP_WAIT) {
    const healthy = await checkHealth(host, port);
    if (healthy) {
      backendReady = true;
      log("info", "Backend is ready", { elapsed: Date.now() - start });
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  log("error", "Backend failed to start within timeout", { timeout: MAX_STARTUP_WAIT });
  return false;
}

function startHealthMonitor() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(async () => {
    const healthy = await checkHealth(config.apiHost, config.apiPort);
    if (!healthy && backendReady) {
      log("warn", "Backend health check failed");
      backendReady = false;
      if (mainWindow) {
        mainWindow.webContents.send("backend-status", { connected: false });
      }
      // Auto-restart if we're the server
      if (config.role === "server" && !backendProcess) {
        await startBackend();
        const ok = await waitForBackend();
        if (ok && mainWindow) {
          mainWindow.webContents.send("backend-status", { connected: true });
        }
      }
    } else if (healthy && !backendReady) {
      backendReady = true;
      if (mainWindow) {
        mainWindow.webContents.send("backend-status", { connected: true });
      }
    }
  }, HEALTH_CHECK_INTERVAL);
}

function stopBackend() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  if (backendProcess) {
    log("info", "Stopping backend process");
    backendProcess.kill("SIGTERM");
    setTimeout(() => {
      if (backendProcess) {
        backendProcess.kill("SIGKILL");
        backendProcess = null;
      }
    }, 5000);
  }
}

// ==============================
// WINDOW MANAGEMENT
// ==============================
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, "..", "public", "logo.png"),
    show: false, // Show after ready
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show when ready to prevent white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    log("info", "Main window shown");
  });

  if (IS_DEV) {
    mainWindow.loadURL(VITE_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Inject config after page loads
  mainWindow.webContents.on("did-finish-load", () => {
    const apiUrl = getApiUrl();
    mainWindow.webContents.executeJavaScript(`
      window.__API_URL__ = "${apiUrl}";
      window.__APP_MODE__ = "${config.role}";
      window.__IS_ELECTRON__ = true;
    `);
    log("info", "Config injected into renderer", { apiUrl, role: config.role });
  });
}

// ==============================
// IPC HANDLERS
// ==============================
function registerIpcHandlers() {
  ipcMain.handle("app:getConfig", () => ({
    role: config.role,
    apiHost: config.apiHost,
    apiPort: config.apiPort,
    apiUrl: getApiUrl(),
    backendReady,
    isElectron: true,
  }));

  ipcMain.handle("app:setConfig", async (_e, newConfig) => {
    config = { ...config, ...newConfig };
    saveConfig(config);
    log("info", "Config updated via IPC", newConfig);
    return { ok: true };
  });

  ipcMain.handle("app:getBackendStatus", () => ({
    running: !!backendProcess || config.role === "client",
    healthy: backendReady,
    port: config.apiPort,
    role: config.role,
  }));

  ipcMain.handle("app:restartBackend", async () => {
    stopBackend();
    await new Promise((r) => setTimeout(r, 1000));
    await startBackend();
    const ok = await waitForBackend();
    return { ok, port: config.apiPort };
  });

  ipcMain.handle("app:getLogs", () => {
    try {
      const logFile = path.join(LOG_DIR, `emperor-${new Date().toISOString().slice(0, 10)}.log`);
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, "utf8");
        const lines = content.split("\n").slice(-200);
        return lines;
      }
    } catch {}
    return [];
  });

  ipcMain.handle("app:selectRole", async (_e, role) => {
    config.role = role;
    saveConfig(config);
    if (role === "server") {
      await startBackend();
      await waitForBackend();
    }
    return { ok: true, role };
  });

  ipcMain.handle("app:discoverServer", async (_e, host) => {
    try {
      const healthy = await checkHealth(host, config.apiPort);
      if (healthy) {
        config.apiHost = host;
        saveConfig(config);
        return { found: true, host };
      }
    } catch {}
    return { found: false };
  });
}

// ==============================
// APP LIFECYCLE
// ==============================
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  log("info", "Emperor ERP starting", {
    version: app.getVersion(),
    role: config.role,
    isDev: IS_DEV,
  });

  registerIpcHandlers();

  // Start backend if server mode
  if (config.role === "server" && config.autoStartBackend) {
    await startBackend();
    const ready = await waitForBackend();
    if (!ready && !IS_DEV) {
      const response = await dialog.showMessageBox({
        type: "warning",
        title: "تحذير",
        message: "لم يتم تشغيل الخادم بنجاح. هل تريد المتابعة؟",
        buttons: ["متابعة", "إلغاء"],
        defaultId: 0,
      });
      if (response.response === 1) {
        app.quit();
        return;
      }
    }
  } else if (config.role === "client") {
    // Client mode: check if server is reachable
    const healthy = await checkHealth(config.apiHost, config.apiPort);
    if (!healthy) {
      log("warn", "Server not reachable in client mode", { host: config.apiHost, port: config.apiPort });
    }
  }

  createWindow();
  startHealthMonitor();
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Graceful shutdown
process.on("SIGINT", () => { stopBackend(); app.quit(); });
process.on("SIGTERM", () => { stopBackend(); app.quit(); });
