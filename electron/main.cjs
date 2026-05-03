// ==============================
// Emperor ERP — Electron Main Process (Production-grade)
// - Strict Server vs Client separation
// - Backend spawned as Node via ELECTRON_RUN_AS_NODE
// - Works inside packaged app (asarUnpack)
// - First-run role picker (no React dependency)
// ==============================

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");

// ==============================
// CONSTANTS
// ==============================
const IS_DEV = !app.isPackaged;
const API_PORT = 3001;
const VITE_DEV_URL = "http://localhost:5173";
const HEALTH_CHECK_INTERVAL = 5000;
const HEALTH_CHECK_TIMEOUT = 3000;
const MAX_STARTUP_WAIT = 60000;
const CONFIG_FILE = path.join(app.getPath("userData"), "emperor-config.json");
const LOG_DIR = path.join(app.getPath("userData"), "logs");

// ==============================
// LOGGING
// ==============================
const MAX_LOG_AGE_DAYS = 14;
function ensureLogDir() {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}
function cleanOldLogs() {
  try {
    ensureLogDir();
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith("emperor-") && f.endsWith(".log"));
    const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const fp = path.join(LOG_DIR, file);
      try { if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp); } catch {}
    }
  } catch {}
}
function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [ELECTRON:${level.toUpperCase()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(path.join(LOG_DIR, `emperor-${ts.slice(0, 10)}.log`), line + "\n");
  } catch {}
}

// ==============================
// CONFIG (persisted to userData/emperor-config.json)
// ==============================
function loadConfig() {
  const defaults = {
    role: null,                  // null = first-run (force picker)
    apiHost: "localhost",
    apiPort: API_PORT,
    autoStartBackend: true,
    firstRunComplete: false,
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      return { ...defaults, ...saved, apiPort: API_PORT };
    }
  } catch (e) {
    log("warn", "Failed to load config, using defaults", { error: e.message });
  }
  return defaults;
}
function saveConfig(cfg) {
  try {
    ensureLogDir();
    if (!fs.existsSync(path.dirname(CONFIG_FILE))) fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    log("info", "Config saved", { role: cfg.role, apiHost: cfg.apiHost });
  } catch (e) {
    log("error", "Failed to save config", { error: e.message });
  }
}
let config = loadConfig();
function getApiUrl() { return `http://${config.apiHost}:${API_PORT}/api`; }

// ==============================
// SINGLE INSTANCE
// ==============================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { log("warn", "Another instance running. Quitting."); app.quit(); }

// ==============================
// HEALTH CHECK
// ==============================
function checkHealth(host, port, timeoutMs = HEALTH_CHECK_TIMEOUT) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/api/health`, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { const j = JSON.parse(data); resolve(j.status === "ok" ? j : false); }
        catch { resolve(false); }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// ==============================
// BACKEND LIFECYCLE — SERVER MODE ONLY
// ==============================
let backendProcess = null;
let backendReady = false;
let backendPid = null;
let healthCheckTimer = null;

/**
 * Resolve backend server.js path:
 * - Dev: <repo>/backend/src/server.js
 * - Packaged: process.resourcesPath/app.asar.unpacked/backend/src/server.js
 */
function getBackendPaths() {
  if (IS_DEV) {
    const repoRoot = path.join(__dirname, "..");
    return {
      serverJs: path.join(repoRoot, "backend", "src", "server.js"),
      cwd: path.join(repoRoot, "backend"),
    };
  }
  const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", "backend");
  return {
    serverJs: path.join(unpacked, "src", "server.js"),
    cwd: unpacked,
  };
}

async function startBackend() {
  if (config.role !== "server") {
    log("info", "Not in server mode — skipping backend startup", { role: config.role });
    return;
  }

  // If backend is already healthy on this port, attach to it
  const existing = await checkHealth("localhost", API_PORT);
  if (existing) {
    log("info", "Backend already healthy on port " + API_PORT, { pid: existing.pid });
    backendReady = true;
    backendPid = existing.pid || null;
    return;
  }

  const { serverJs, cwd } = getBackendPaths();
  if (!fs.existsSync(serverJs)) {
    log("error", "Backend server.js NOT FOUND", { serverJs });
    return;
  }

  // Spawn Electron itself in Node mode — no external Node required.
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: IS_DEV ? "development" : "production",
    PORT: String(API_PORT),
    LOG_DIR: path.join(LOG_DIR, "backend"),
  };

  log("info", "Spawning backend", { serverJs, cwd, execPath: process.execPath });

  try {
    backendProcess = spawn(process.execPath, [serverJs], {
      env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (e) {
    log("error", "spawn() threw", { error: e.message });
    return;
  }

  backendPid = backendProcess.pid;
  log("info", "Backend spawned", { pid: backendPid });

  backendProcess.stdout?.on("data", (d) => {
    const s = d.toString().trim(); if (s) log("info", `[backend] ${s}`);
  });
  backendProcess.stderr?.on("data", (d) => {
    const s = d.toString().trim(); if (s) log("error", `[backend] ${s}`);
  });
  backendProcess.on("exit", (code, signal) => {
    log("warn", "Backend exited", { code, signal, pid: backendPid });
    backendProcess = null;
    backendReady = false;
    // Auto-restart in production for unexpected exits
    if (!IS_DEV && code !== 0 && config.role === "server") {
      log("info", "Auto-restarting backend in 3s...");
      setTimeout(() => startBackend(), 3000);
    }
  });
  backendProcess.on("error", (err) => {
    log("error", "Backend spawn error", { error: err.message });
    backendProcess = null;
  });
}

async function waitForBackend(host, timeoutMs = MAX_STARTUP_WAIT) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const h = await checkHealth(host, API_PORT, 2000);
    if (h) {
      backendReady = true;
      log("info", "Backend ready", { host, elapsed: Date.now() - start });
      return true;
    }
    await new Promise(r => setTimeout(r, 700));
  }
  log("error", "Backend did not respond within timeout", { host, timeoutMs });
  return false;
}

function stopBackend() {
  if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null; }
  if (backendProcess) {
    log("info", "Stopping backend", { pid: backendPid });
    try { backendProcess.kill("SIGTERM"); } catch {}
    setTimeout(() => {
      if (backendProcess) { try { backendProcess.kill("SIGKILL"); } catch {} backendProcess = null; }
    }, 5000);
  }
}

function startHealthMonitor() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(async () => {
    const host = config.role === "client" ? config.apiHost : "localhost";
    const h = await checkHealth(host, API_PORT, 2000);
    if (!h && backendReady) {
      backendReady = false;
      mainWindow?.webContents.send("backend-status", { connected: false, role: config.role, host });
      // Only re-spawn if WE own the backend
      if (config.role === "server" && !backendProcess) {
        await startBackend();
      }
    } else if (h && !backendReady) {
      backendReady = true;
      mainWindow?.webContents.send("backend-status", { connected: true, role: config.role, host });
    }
  }, HEALTH_CHECK_INTERVAL);
}

// ==============================
// NETWORK / DISCOVERY
// ==============================
function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === "IPv4" && !i.internal) out.push({ address: i.address, name, netmask: i.netmask });
    }
  }
  return out;
}
function getTailscaleStatus() {
  const r = { installed: false, connected: false, ips: [], peers: [] };
  try { execSync("tailscale version", { encoding: "utf8", timeout: 3000 }); r.installed = true; }
  catch { return r; }
  try {
    const out = execSync("tailscale status --json", { encoding: "utf8", timeout: 5000 });
    const s = JSON.parse(out);
    if (s.Self?.TailscaleIPs) r.ips = s.Self.TailscaleIPs.filter(ip => ip.includes("."));
    r.connected = !!(s.Self && s.Self.Online !== false);
    if (s.Peer) {
      for (const p of Object.values(s.Peer)) {
        if (p.TailscaleIPs) for (const ip of p.TailscaleIPs) if (ip.includes(".")) r.peers.push(ip);
      }
    }
  } catch {}
  return r;
}
function fastHealthCheck(host, timeoutMs = 1500) {
  return checkHealth(host, API_PORT, timeoutMs).then(h => h ? host : null);
}
async function autoDiscoverServer() {
  // 1. Tailscale peers
  const ts = getTailscaleStatus();
  if (ts.connected && ts.peers.length) {
    const r = await Promise.all(ts.peers.map(ip => fastHealthCheck(ip)));
    const f = r.find(x => x); if (f) return f;
  }
  // 2. Common LAN IPs
  const ips = getLocalIPs().filter(i => !i.address.startsWith("100."));
  const cands = new Set();
  for (const ip of ips) {
    const sub = ip.address.split(".").slice(0, 3).join(".");
    for (const s of [1, 2, 10, 50, 100, 150, 200, 254]) cands.add(`${sub}.${s}`);
  }
  if (cands.size) {
    const r = await Promise.all([...cands].map(ip => fastHealthCheck(ip)));
    const f = r.find(x => x); if (f) return f;
  }
  // 3. Full /24 (chunks of 50)
  for (const ip of ips) {
    const sub = ip.address.split(".").slice(0, 3).join(".");
    const batch = [];
    for (let i = 1; i <= 254; i++) {
      const a = `${sub}.${i}`;
      if (a !== ip.address && !cands.has(a)) batch.push(a);
    }
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const r = await Promise.all(chunk.map(a => fastHealthCheck(a, 1200)));
      const f = r.find(x => x); if (f) return f;
    }
  }
  return null;
}

// ==============================
// ROLE PICKER WINDOW (first-run)
// ==============================
let pickerWindow = null;
function showRolePicker() {
  return new Promise((resolve) => {
    pickerWindow = new BrowserWindow({
      width: 560, height: 620, resizable: false, minimizable: false, maximizable: false,
      title: "الإعداد الأولي",
      icon: path.join(__dirname, "..", "public", "logo.png"),
      webPreferences: {
        preload: path.join(__dirname, "role-picker-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    pickerWindow.removeMenu();
    pickerWindow.loadFile(path.join(__dirname, "role-picker.html"));

    const testHandler = async (_e, host) => {
      try { const h = await checkHealth(host, API_PORT, 3000); return { ok: !!h }; }
      catch (e) { return { ok: false, error: e.message }; }
    };
    const discoverHandler = async () => {
      const host = await autoDiscoverServer();
      return { found: !!host, host };
    };
    const saveHandler = async (_e, payload) => {
      config.role = payload.role;
      config.apiHost = payload.role === "server" ? "localhost" : (payload.apiHost || "localhost");
      config.firstRunComplete = true;
      saveConfig(config);
      ipcMain.removeHandler("picker:testHost");
      ipcMain.removeHandler("picker:autoDiscover");
      ipcMain.removeHandler("picker:save");
      const win = pickerWindow; pickerWindow = null;
      try { win?.close(); } catch {}
      resolve();
      return { ok: true };
    };
    ipcMain.handle("picker:testHost", testHandler);
    ipcMain.handle("picker:autoDiscover", discoverHandler);
    ipcMain.handle("picker:save", saveHandler);

    pickerWindow.on("closed", () => {
      // If user closed without saving, quit the app
      if (!config.firstRunComplete) { log("warn", "Role picker closed without selection — quitting"); app.quit(); }
    });
  });
}

// ==============================
// MAIN WINDOW
// ==============================
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700,
    icon: path.join(__dirname, "..", "public", "logo.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.once("ready-to-show", () => { mainWindow.show(); log("info", "Main window shown"); });

  if (IS_DEV) {
    mainWindow.loadURL(VITE_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.on("did-finish-load", () => {
    const apiUrl = getApiUrl();
    mainWindow.webContents.executeJavaScript(`
      window.__API_URL__ = "${apiUrl}";
      window.__APP_MODE__ = "${config.role}";
      window.__IS_ELECTRON__ = true;
    `).catch(() => {});
    log("info", "Renderer config injected", { apiUrl, role: config.role });
  });
}

// ==============================
// IPC (renderer ↔ main)
// ==============================
function registerIpcHandlers() {
  ipcMain.handle("app:getConfig", () => ({
    role: config.role, apiHost: config.apiHost, apiPort: API_PORT,
    apiUrl: getApiUrl(), backendReady, isElectron: true,
  }));
  ipcMain.handle("app:setConfig", async (_e, newCfg) => {
    delete newCfg.apiPort;
    const prevRole = config.role;
    config = { ...config, ...newCfg };
    saveConfig(config);
    // Role transitions
    if (prevRole !== config.role) {
      if (config.role === "server") { await startBackend(); await waitForBackend("localhost", 15000); }
      else { stopBackend(); }
    }
    return { ok: true };
  });
  ipcMain.handle("app:getBackendStatus", () => ({
    running: !!backendProcess || config.role === "client",
    healthy: backendReady, port: API_PORT, role: config.role, pid: backendPid,
  }));
  ipcMain.handle("app:restartBackend", async () => {
    if (config.role !== "server") return { ok: false, error: "client mode" };
    stopBackend(); await new Promise(r => setTimeout(r, 1000));
    await startBackend();
    const ok = await waitForBackend("localhost", 15000);
    return { ok, port: API_PORT };
  });
  ipcMain.handle("app:getLogs", () => {
    try {
      const f = path.join(LOG_DIR, `emperor-${new Date().toISOString().slice(0, 10)}.log`);
      if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").split("\n").slice(-200);
    } catch {}
    return [];
  });
  ipcMain.handle("app:selectRole", async (_e, role) => {
    config.role = role; saveConfig(config);
    if (role === "server") { await startBackend(); await waitForBackend("localhost", 15000); }
    return { ok: true, role };
  });
  ipcMain.handle("app:discoverServer", async (_e, host) => {
    const h = await checkHealth(host, API_PORT, 3000);
    if (h) { config.apiHost = host; saveConfig(config); return { found: true, host }; }
    return { found: false };
  });
  ipcMain.handle("app:autoDiscover", async () => {
    if (config.role !== "client") return { found: false };
    const h = await autoDiscoverServer();
    if (h) { config.apiHost = h; saveConfig(config); return { found: true, host: h }; }
    return { found: false };
  });
  ipcMain.handle("app:getTailscaleStatus", () => getTailscaleStatus());
}

// ==============================
// APP LIFECYCLE
// ==============================
app.on("second-instance", () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

app.whenReady().then(async () => {
  cleanOldLogs();
  log("info", "Emperor ERP starting", {
    version: app.getVersion(), role: config.role, isDev: IS_DEV, port: API_PORT,
    firstRun: !config.firstRunComplete,
  });

  registerIpcHandlers();

  // Auto-updater (production only)
  if (!IS_DEV) {
    try {
      const { initAutoUpdater, checkForUpdatesOnStartup } = require("./autoUpdater.cjs");
      initAutoUpdater({ logger: log });
      checkForUpdatesOnStartup(15000);
    } catch (e) { log("warn", "Auto-updater unavailable", { error: e.message }); }
  }

  // FIRST-RUN: show role picker
  if (!config.firstRunComplete || !config.role) {
    log("info", "First run — showing role picker");
    await showRolePicker();
  }

  // ===== SERVER MODE =====
  if (config.role === "server") {
    if (config.autoStartBackend) {
      await startBackend();
      const ready = await waitForBackend("localhost", 30000);
      if (!ready) {
        const r = await dialog.showMessageBox({
          type: "warning", title: "تحذير",
          message: "لم يتم تشغيل الخادم بنجاح على هذا الجهاز.",
          detail: "يمكنك المتابعة وستحاول الواجهة الاتصال تلقائياً، أو الإغلاق ومراجعة السجلات.",
          buttons: ["متابعة", "إغلاق"], defaultId: 0,
        });
        if (r.response === 1) { app.quit(); return; }
      }
    }
  }
  // ===== CLIENT MODE =====
  else if (config.role === "client") {
    log("info", "Client mode — backend will NOT be started locally", { apiHost: config.apiHost });
    let h = await checkHealth(config.apiHost, API_PORT, 5000);
    if (!h) {
      log("info", "Configured server unreachable, attempting auto-discovery");
      const found = await autoDiscoverServer();
      if (found) { config.apiHost = found; saveConfig(config); h = true; }
    }
    if (!h) {
      // CLIENT-specific message — never says "the server failed to start"
      await dialog.showMessageBox({
        type: "warning", title: "تعذر الاتصال",
        message: "تعذر الاتصال بسيرفر الإمبراطور.",
        detail: `العنوان المُهيّأ: ${config.apiHost}:${API_PORT}\nسيتم فتح التطبيق وستُعاد المحاولة تلقائياً. يمكنك تغيير العنوان من الإعدادات.`,
        buttons: ["موافق"],
      });
    } else {
      backendReady = true;
    }
  }

  createWindow();
  startHealthMonitor();
});

app.on("window-all-closed", () => { stopBackend(); if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { stopBackend(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
process.on("SIGINT", () => { stopBackend(); app.quit(); });
process.on("SIGTERM", () => { stopBackend(); app.quit(); });
process.on("uncaughtException", (err) => log("error", "uncaughtException", { error: err.message, stack: err.stack }));
process.on("unhandledRejection", (r) => log("error", "unhandledRejection", { reason: String(r) }));
