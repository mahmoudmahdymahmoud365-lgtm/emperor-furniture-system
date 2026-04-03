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
const MAX_STARTUP_WAIT = 30000;
const CONFIG_FILE = path.join(app.getPath("userData"), "emperor-config.json");
const LOG_DIR = path.join(app.getPath("userData"), "logs");

// ==============================
// LOGGING — File-based, daily rotation
// ==============================
function ensureLogDir() {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
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
// SERVER AUTO-DISCOVERY
// ==============================

/**
 * Get all local IPv4 addresses including Tailscale interfaces
 */
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
 * Detect Tailscale IP (100.x.x.x range)
 */
function getTailscaleIPs() {
  return getLocalIPs().filter(ip => ip.address.startsWith("100."));
}

/**
 * Fast parallel health check with timeout
 */
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
 * Full subnet scan — checks all 254 IPs in each local subnet in parallel batches
 * Also checks Tailscale peers
 */
async function autoDiscoverServer() {
  const localIPs = getLocalIPs();
  const candidates = new Set();

  // 1. Tailscale IPs — check the Tailscale subnet (100.x.x.x)
  const tailscaleIPs = getTailscaleIPs();
  if (tailscaleIPs.length > 0) {
    log("info", "Tailscale detected", { ips: tailscaleIPs.map(i => i.address) });
    // Try to get Tailscale peers via CLI
    try {
      const output = execSync("tailscale status --json", { encoding: "utf8", timeout: 5000 });
      const status = JSON.parse(output);
      if (status.Peer) {
        for (const peer of Object.values(status.Peer)) {
          if (peer.TailscaleIPs) {
            for (const ip of peer.TailscaleIPs) {
              if (ip.includes(".")) candidates.add(ip); // IPv4 only
            }
          }
        }
      }
    } catch {
      // Tailscale CLI not available — scan 100.x.x.0/24 subnet
      for (const ts of tailscaleIPs) {
        const subnet = ts.address.split(".").slice(0, 3).join(".");
        for (let i = 1; i <= 254; i++) {
          candidates.add(`${subnet}.${i}`);
        }
      }
    }
  }

  // 2. LAN subnets — full /24 scan
  for (const ip of localIPs) {
    if (ip.address.startsWith("100.")) continue; // Already handled
    const subnet = ip.address.split(".").slice(0, 3).join(".");
    for (let i = 1; i <= 254; i++) {
      const addr = `${subnet}.${i}`;
      if (addr !== ip.address) candidates.add(addr);
    }
  }

  // 3. Scan in parallel batches of 50
  const candidateList = [...candidates];
  log("info", `Auto-discovery: scanning ${candidateList.length} candidates`);

  const BATCH_SIZE = 50;
  for (let i = 0; i < candidateList.length; i += BATCH_SIZE) {
    const batch = candidateList.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(ip => fastHealthCheck(ip, API_PORT)));
    const found = results.find(r => r !== null);
    if (found) {
      log("info", "Server discovered!", { host: found });
      return found;
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
    // Try configured host first
    let health = await checkHealth(config.apiHost, API_PORT);
    if (!health) {
      // Auto-discover
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

  // CRITICAL: Window created AFTER backend confirmed ready (or timeout)
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
