// ==============================
// Emperor ERP — Enterprise Electron Main Process
// Fixed port 3001, backend readiness before UI, single instance
// ==============================

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");

// ==============================
// CONFIGURATION
// ==============================
const IS_DEV = process.env.NODE_ENV === "development";
const API_PORT = 3001; // FIXED — never changes
const VITE_DEV_URL = "http://localhost:5173";
const HEALTH_CHECK_INTERVAL = 5000;
const HEALTH_CHECK_TIMEOUT = 3000;
const MAX_STARTUP_WAIT = 60000;
const CONFIG_FILE = path.join(app.getPath("userData"), "emperor-config.json");
const LOG_DIR = path.join(app.getPath("userData"), "logs");

// ==============================
// LOGGING — File-based with rotation & cleanup
// ==============================
const MAX_LOG_AGE_DAYS = 14;
const MAX_LOG_SIZE_MB = 10;

function ensureLogDir() {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

function cleanOldLogs() {
  try {
    ensureLogDir();
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith("emperor-") && f.endsWith(".log"));
    const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const filePath = path.join(LOG_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff || stat.size > MAX_LOG_SIZE_MB * 1024 * 1024) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  } catch {}
}

function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [ELECTRON:${level.toUpperCase()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  console.log(line);
  try {
    ensureLogDir();
    const logFile = path.join(LOG_DIR, `emperor-${ts.slice(0, 10)}.log`);
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
      return { ...defaults, ...saved, apiPort: API_PORT }; // Force port
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
// SINGLE INSTANCE LOCK — prevents duplicate launches
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
let backendPid = null; // Track OUR backend PID for safe port management

function checkHealth(host, port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/api/health`, { timeout: HEALTH_CHECK_TIMEOUT }, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === "ok" ? json : false);
        } catch { resolve(false); }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

/**
 * SAFE port cleanup:
 * Only kills a process on port 3001 if it's verified to be
 * a stale Emperor backend (responds to /api/health with our format)
 * or if it matches our tracked PID.
 */
async function safeKillStaleBackend() {
  const health = await checkHealth("localhost", API_PORT);
  if (!health) {
    // Port might be held by a dead process — try to kill by PID
    if (backendPid) {
      try {
        process.kill(backendPid, "SIGKILL");
        log("info", "Killed tracked backend PID", { pid: backendPid });
      } catch {}
      backendPid = null;
    }
    return;
  }
  // If healthy but it's a stale instance (different PID than what we spawned)
  if (health.pid && health.pid !== backendPid) {
    log("info", "Stale Emperor backend detected", { stalePid: health.pid });
    try {
      process.kill(health.pid, "SIGKILL");
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function startBackend() {
  if (config.role === "client") {
    log("info", "Client mode — skipping backend startup");
    return;
  }

  // Check if backend already healthy
  const health = await checkHealth("localhost", API_PORT);
  if (health) {
    log("info", "Backend already running and healthy on port " + API_PORT, { pid: health.pid });
    backendReady = true;
    backendPid = health.pid || null;
    return;
  }

  // Safe cleanup of stale processes
  await safeKillStaleBackend();
  await new Promise(r => setTimeout(r, 500));

  // const serverPath = IS_DEV
  //   ? path.join(__dirname, "..", "backend", "src", "server.js")
  //   : path.join(process.resourcesPath, "backend", "src", "server.js");

  // const env = {
  //   ...process.env,
  //   PORT: String(API_PORT),
  //   NODE_ENV: IS_DEV ? "development" : "production",
  //   // CORS is now handled by corsConfig.js — no need for env override
  // };

  // if (config.dbUrl) {
  //   env.DATABASE_URL = config.dbUrl;
  // }

  // log("info", "Starting backend server", { path: serverPath, port: API_PORT });

  // backendProcess = spawn(
  //   process.execPath.includes("electron") ? "node" : process.execPath,
  //   [serverPath],
  //   {
  //     env,
  //     stdio: ["pipe", "pipe", "pipe"],
  //     cwd: IS_DEV ? path.join(__dirname, "..") : process.resourcesPath,
  //   }
  // );
  const isDev = !app.isPackaged;

// 🔥 المسار الصح للسيرفر
const serverPath = isDev
  ? path.join(app.getAppPath(), "backend", "src", "server.js")
  : path.join(process.resourcesPath, "app.asar.unpacked", "backend", "src", "server.js");

// 🔥 البيئة
const env = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: "1", // مهم جدًا
  NODE_ENV: isDev ? "development" : "production",
  PORT: "3001",
};

// 🔥 تشغيل السيرفر بطريقة صحيحة
backendProcess = spawn(process.execPath, [serverPath], {
  env,
  stdio: ["pipe", "pipe", "pipe"],

  // 🔥 مهم جدًا عشان .env يتقرأ صح
  cwd: isDev
    ? path.join(app.getAppPath(), "backend")
    : path.join(process.resourcesPath, "app.asar.unpacked", "backend"),
});

  backendPid = backendProcess.pid;
  log("info", "Backend spawned", { pid: backendPid });

  backendProcess.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) log("info", `[backend] ${msg}`);
  });

  backendProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) log("error", `[backend] ${msg}`);
  });

  backendProcess.on("exit", (code, signal) => {
    log("warn", "Backend process exited", { code, signal, pid: backendPid });
    backendProcess = null;
    backendReady = false;

    // Auto-restart in production if crashed (not intentional shutdown)
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
// async function startBackend() {
//   if (config.role === "client") {
//     log("info", "Client mode — skipping backend startup");
//     return;
//   }

//   // لو السيرفر شغال بالفعل
//   const health = await checkHealth("localhost", API_PORT);
//   if (health) {
//     log("info", "Backend already running", { pid: health.pid });
//     backendReady = true;
//     backendPid = health.pid || null;
//     return;
//   }

//   await safeKillStaleBackend();
//   await new Promise(r => setTimeout(r, 500));

//   const serverPath = IS_DEV
//     ? path.join(__dirname, "..", "backend", "src", "server.js")
//     : path.join(process.resourcesPath, "backend", "src", "server.js");

//   // 🔥 أهم سطر — node path مضمون
//   const nodePath = IS_DEV
//     ? "node"
//     : process.execPath.replace("electron.exe", "node.exe");

//   log("info", "Starting backend", {
//     serverPath,
//     nodePath
//   });

//   backendProcess = spawn(nodePath, [serverPath], {
//     env: {
//       ...process.env,
//       PORT: String(API_PORT),
//       NODE_ENV: IS_DEV ? "development" : "production",
//       DATABASE_URL: config.dbUrl || process.env.DATABASE_URL || "",
//     },
//     stdio: "pipe",
//     cwd: IS_DEV ? path.join(__dirname, "..") : process.resourcesPath,
//     windowsHide: true,
//   });

//   backendPid = backendProcess.pid;

//   backendProcess.stdout.on("data", (data) => {
//     log("info", "[backend] " + data.toString());
//   });

//   backendProcess.stderr.on("data", (data) => {
//     log("error", "[backend] " + data.toString());
//   });

//   backendProcess.on("exit", (code) => {
//     log("warn", "Backend exited", { code });
//     backendProcess = null;
//     backendReady = false;

//     if (!IS_DEV) {
//       log("info", "Restarting backend...");
//       setTimeout(() => startBackend(), 3000);
//     }
//   });
// }
async function waitForBackend() {
  const start = Date.now();
  while (Date.now() - start < MAX_STARTUP_WAIT) {
    const host = config.role === "client" ? config.apiHost : "localhost";
    const health = await checkHealth(host, API_PORT);
    if (health) {
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
    const health = await checkHealth(host, API_PORT);
    if (!health && backendReady) {
      log("warn", "Backend health check failed");
      backendReady = false;
      if (mainWindow) {
        mainWindow.webContents.send("backend-status", { connected: false });
      }
      // Auto-recover: restart backend if we're the server
      if (config.role === "server" && !backendProcess) {
        await startBackend();
        const ok = await waitForBackend();
        if (ok && mainWindow) {
          mainWindow.webContents.send("backend-status", { connected: true });
        }
      }
    } else if (health && !backendReady) {
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
    log("info", "Stopping backend process", { pid: backendPid });
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

  mainWindow.on("closed", () => { mainWindow = null; });

  // Inject API URL — single source of truth for renderer
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
// SERVER AUTO-DISCOVERY — Cache-first, minimal scanning
// ==============================

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push({ address: iface.address, name, netmask: iface.netmask });
      }
    }
  }
  return ips;
}

/**
 * Detect Tailscale: installed, connected, self IPs, peer IPs
 */
function getTailscaleStatus() {
  const result = { installed: false, connected: false, ips: [], peers: [] };
  try {
    execSync("tailscale version", { encoding: "utf8", timeout: 3000 });
    result.installed = true;
  } catch {
    return result;
  }
  try {
    const output = execSync("tailscale status --json", { encoding: "utf8", timeout: 5000 });
    const status = JSON.parse(output);
    if (status.Self && status.Self.TailscaleIPs) {
      result.ips = status.Self.TailscaleIPs.filter(ip => ip.includes("."));
    }
    result.connected = !!(status.Self && status.Self.Online !== false);
    if (status.Peer) {
      for (const peer of Object.values(status.Peer)) {
        if (peer.TailscaleIPs) {
          for (const ip of peer.TailscaleIPs) {
            if (ip.includes(".")) result.peers.push(ip);
          }
        }
      }
    }
  } catch {}
  return result;
}

function fastHealthCheck(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/api/health`, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === "ok" ? host : null);
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * CACHE-FIRST discovery strategy:
 * 1. Cached host from config (instant)
 * 2. Tailscale peers (precise, no scan)
 * 3. Common gateway/server IPs (.1, .100, .200)
 * 4. Full /24 subnet scan (last resort only)
 */
async function autoDiscoverServer() {
  // 1. Try cached host first
  if (config.apiHost && config.apiHost !== "localhost") {
    const cached = await fastHealthCheck(config.apiHost, API_PORT, 2000);
    if (cached) {
      log("info", "Server found at cached host", { host: cached });
      return cached;
    }
    log("info", "Cached host unreachable, trying alternatives...");
  }

  // 2. Tailscale peers — precise, no scanning
  const tailscale = getTailscaleStatus();
  if (tailscale.connected && tailscale.peers.length > 0) {
    log("info", `Checking ${tailscale.peers.length} Tailscale peers`);
    const results = await Promise.all(tailscale.peers.map(ip => fastHealthCheck(ip, API_PORT, 2000)));
    const found = results.find(r => r !== null);
    if (found) {
      log("info", "Server found via Tailscale", { host: found });
      return found;
    }
  }

  // 3. Common gateway/server IPs (fast — max ~10 checks)
  const localIPs = getLocalIPs().filter(ip => !ip.address.startsWith("100."));
  const gatewayCandidates = new Set();
  for (const ip of localIPs) {
    const subnet = ip.address.split(".").slice(0, 3).join(".");
    for (const suffix of [1, 2, 10, 50, 100, 150, 200, 254]) {
      gatewayCandidates.add(`${subnet}.${suffix}`);
    }
  }
  if (gatewayCandidates.size > 0) {
    const results = await Promise.all([...gatewayCandidates].map(ip => fastHealthCheck(ip, API_PORT, 1500)));
    const found = results.find(r => r !== null);
    if (found) {
      log("info", "Server found at common IP", { host: found });
      return found;
    }
  }

  // 4. Full /24 scan — last resort
  log("info", "Falling back to full subnet scan...");
  for (const ip of localIPs) {
    const subnet = ip.address.split(".").slice(0, 3).join(".");
    const batch = [];
    for (let i = 1; i <= 254; i++) {
      const addr = `${subnet}.${i}`;
      if (addr !== ip.address && !gatewayCandidates.has(addr)) batch.push(addr);
    }
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const results = await Promise.all(chunk.map(a => fastHealthCheck(a, API_PORT)));
      const found = results.find(r => r !== null);
      if (found) {
        log("info", "Server discovered via subnet scan", { host: found });
        return found;
      }
    }
  }

  return null;
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
    delete newConfig.apiPort; // Never allow port changes
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
    pid: backendPid,
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
      const health = await checkHealth(host, API_PORT);
      if (health) {
        config.apiHost = host;
        saveConfig(config);
        return { found: true, host };
      }
    } catch {}
    return { found: false };
  });

  ipcMain.handle("app:autoDiscover", async () => {
    if (config.role !== "client") return { found: false };
    const host = await autoDiscoverServer();
    if (host) {
      config.apiHost = host;
      saveConfig(config);
      return { found: true, host };
    }
    return { found: false };
  });

  // Tailscale status for UI guidance
  ipcMain.handle("app:getTailscaleStatus", () => {
    return getTailscaleStatus();
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
  // Clean old logs on startup
  cleanOldLogs();

  log("info", "Emperor ERP starting", {
    version: app.getVersion(),
    role: config.role,
    isDev: IS_DEV,
    fixedPort: API_PORT,
  });

  registerIpcHandlers();

  // Initialize auto-updater (production only)
  if (!IS_DEV) {
    try {
      const { initAutoUpdater, checkForUpdatesOnStartup } = require("./autoUpdater.cjs");
      initAutoUpdater({
        logger: log,
        // feedUrl: "https://your-update-server.com" // Optional: custom server
      });
      checkForUpdatesOnStartup(15000); // Check 15s after startup
    } catch (e) {
      log("warn", "Auto-updater not available", { error: e.message });
    }
  }

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
    // if (!ready) {
    //    log("warn", "Backend not ready — continuing, auto-retry enabled");
    // }
  } else if (config.role === "client") {
    let health = await checkHealth(config.apiHost, API_PORT);
    if (!health) {
      log("info", "Server not reachable, attempting auto-discovery...");
      const discovered = await autoDiscoverServer();
      if (discovered) {
        config.apiHost = discovered;
        saveConfig(config);
        health = true;
      }
    }
    if (health) {
      backendReady = true;
    } else {
      log("warn", "Server not reachable in client mode", { host: config.apiHost });
    }
  }

  createWindow();
  startHealthMonitor();
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { stopBackend(); });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on("SIGINT", () => { stopBackend(); app.quit(); });
process.on("SIGTERM", () => { stopBackend(); app.quit(); });
