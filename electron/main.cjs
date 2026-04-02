// ==============================
// Emperor ERP — Enterprise Electron Main Process
// Fixed port 3001, backend readiness before UI, single instance
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
const API_PORT = 3001; // FIXED — never changes
const VITE_DEV_URL = "http://localhost:5173";
const HEALTH_CHECK_INTERVAL = 5000;
const HEALTH_CHECK_TIMEOUT = 3000;
const MAX_STARTUP_WAIT = 30000;
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
    role: "server",
    apiHost: "localhost",
    apiPort: API_PORT,
    dbUrl: "",
    autoStartBackend: true,
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      // Force port to API_PORT — no random switching
      return { ...defaults, ...saved, apiPort: API_PORT };
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
  return `http://${config.apiHost}:${API_PORT}/api`;
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

function killExistingBackend() {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${API_PORT} | findstr LISTENING`, { encoding: "utf8" });
      const lines = output.trim().split("\n");
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== String(process.pid)) {
          try { execSync(`taskkill /PID ${pid} /F`); log("info", `Killed stale backend on port ${API_PORT}`, { pid }); } catch {}
        }
      }
    } else {
      try {
        const output = execSync(`lsof -ti:${API_PORT}`, { encoding: "utf8" });
        const pids = output.trim().split("\n").filter(Boolean);
        for (const pid of pids) {
          if (pid !== String(process.pid)) {
            try { execSync(`kill -9 ${pid}`); } catch {}
          }
        }
      } catch {}
    }
  } catch {}
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

  // Check if backend already healthy on our fixed port
  const healthy = await checkHealth("localhost", API_PORT);
  if (healthy) {
    log("info", "Backend already running and healthy on port " + API_PORT);
    backendReady = true;
    return;
  }

  // Kill any stale process on our port
  killExistingBackend();
  await new Promise(r => setTimeout(r, 1000));

  const serverPath = IS_DEV
    ? path.join(__dirname, "..", "backend", "src", "server.js")
    : path.join(process.resourcesPath, "backend", "src", "server.js");

  const env = {
    ...process.env,
    PORT: String(API_PORT),
    NODE_ENV: IS_DEV ? "development" : "production",
    CORS_ORIGIN: IS_DEV ? VITE_DEV_URL : "*",
  };

  if (config.dbUrl) {
    env.DATABASE_URL = config.dbUrl;
  }

  log("info", "Starting backend server", { path: serverPath, port: API_PORT });

  backendProcess = spawn(
    process.execPath.includes("electron") ? "node" : process.execPath,
    [serverPath],
    {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: IS_DEV ? path.join(__dirname, "..") : process.resourcesPath,
    }
  );

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

    // Auto-restart in production if crashed
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

  while (Date.now() - start < MAX_STARTUP_WAIT) {
    const healthy = await checkHealth(config.role === "client" ? config.apiHost : "localhost", API_PORT);
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
    const host = config.role === "client" ? config.apiHost : "localhost";
    const healthy = await checkHealth(host, API_PORT);
    if (!healthy && backendReady) {
      log("warn", "Backend health check failed");
      backendReady = false;
      if (mainWindow) {
        mainWindow.webContents.send("backend-status", { connected: false });
      }
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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

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

  // Inject API URL after page loads — single source of truth
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
    apiPort: API_PORT,
    apiUrl: getApiUrl(),
    backendReady,
    isElectron: true,
  }));

  ipcMain.handle("app:setConfig", async (_e, newConfig) => {
    // Never allow port changes
    delete newConfig.apiPort;
    config = { ...config, ...newConfig };
    saveConfig(config);
    log("info", "Config updated via IPC", newConfig);
    return { ok: true };
  });

  ipcMain.handle("app:getBackendStatus", () => ({
    running: !!backendProcess || config.role === "client",
    healthy: backendReady,
    port: API_PORT,
    role: config.role,
  }));

  ipcMain.handle("app:restartBackend", async () => {
    stopBackend();
    await new Promise((r) => setTimeout(r, 1000));
    await startBackend();
    const ok = await waitForBackend();
    return { ok, port: API_PORT };
  });

  ipcMain.handle("app:getLogs", () => {
    try {
      const logFile = path.join(LOG_DIR, `emperor-${new Date().toISOString().slice(0, 10)}.log`);
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, "utf8");
        return content.split("\n").slice(-200);
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
      const healthy = await checkHealth(host, API_PORT);
      if (healthy) {
        config.apiHost = host;
        saveConfig(config);
        return { found: true, host };
      }
    } catch {}
    return { found: false };
  });

  // Auto-discover server on LAN (broadcast-based)
  ipcMain.handle("app:autoDiscover", async () => {
    if (config.role !== "client") return { found: false };

    // Try common LAN patterns
    const localIPs = getLocalIPs();
    for (const ip of localIPs) {
      const subnet = ip.split(".").slice(0, 3).join(".");
      // Check gateway and common server IPs
      const candidates = [
        `${subnet}.1`, `${subnet}.2`, `${subnet}.100`,
        `${subnet}.10`, `${subnet}.50`, `${subnet}.200`,
      ];
      for (const candidate of candidates) {
        if (candidate === ip) continue;
        const healthy = await checkHealth(candidate, API_PORT);
        if (healthy) {
          config.apiHost = candidate;
          saveConfig(config);
          log("info", "Auto-discovered server", { host: candidate });
          return { found: true, host: candidate };
        }
      }
    }
    return { found: false };
  });
}

function getLocalIPs() {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
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
    fixedPort: API_PORT,
  });

  registerIpcHandlers();

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
    const healthy = await checkHealth(config.apiHost, API_PORT);
    if (!healthy) {
      log("warn", "Server not reachable in client mode", { host: config.apiHost, port: API_PORT });
    } else {
      backendReady = true;
    }
  }

  // CRITICAL: Only create window AFTER backend is confirmed ready (or timeout)
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

process.on("SIGINT", () => { stopBackend(); app.quit(); });
process.on("SIGTERM", () => { stopBackend(); app.quit(); });
