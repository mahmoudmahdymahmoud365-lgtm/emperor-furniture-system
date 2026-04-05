// ==============================
// Emperor ERP — Enterprise Express API Server
// Fixed port 3001 — NEVER changes
// ==============================
const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ==============================
// LOGGING — with file output and rotation
// ==============================
const fsNode = require("fs");
const pathNode = require("path");

const LOG_DIR = process.env.LOG_DIR || pathNode.join(process.cwd(), "logs");
const MAX_LOG_AGE_DAYS = 14;

function ensureLogDir() {
  try { if (!fsNode.existsSync(LOG_DIR)) fsNode.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

function cleanOldLogs() {
  try {
    ensureLogDir();
    const files = fsNode.readdirSync(LOG_DIR).filter(f => f.startsWith("api-") && f.endsWith(".log"));
    const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    for (const file of files) {
      try {
        const stat = fsNode.statSync(pathNode.join(LOG_DIR, file));
        if (stat.mtimeMs < cutoff) fsNode.unlinkSync(pathNode.join(LOG_DIR, file));
      } catch {}
    }
  } catch {}
}

function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [API:${level.toUpperCase()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "error") console.error(line);
  else console.log(line);
  try {
    ensureLogDir();
    fsNode.appendFileSync(pathNode.join(LOG_DIR, `api-${ts.slice(0, 10)}.log`), line + "\n");
  } catch {}
}

// Clean old logs on startup
cleanOldLogs();

// ==============================
// MIDDLEWARE
// ==============================
app.use(cors({
  origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, _res, next) => {
  if (req.path !== "/api/health") {
    log("info", `${req.method} ${req.path}`);
  }
  next();
});

// ==============================
// HEALTH CHECK
// ==============================
let startedAt = null;
const pool = require("./db");

app.get("/api/health", async (_req, res) => {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: startedAt ? Date.now() - startedAt : 0,
    port: PORT,
    pid: process.pid,
  };
  try {
    await pool.query("SELECT 1");
    status.database = "connected";
  } catch (e) {
    status.database = "disconnected";
    status.dbError = e.message;
  }
  res.json(status);
});

// ==============================
// DATABASE MIGRATIONS — versioned schema management
// ==============================
async function ensureSchema() {
  try {
    const runMigrations = require("./migrations");
    await runMigrations(log);
  } catch (e) {
    log("error", "Database migration failed", { error: e.message });
    // Fatal on first run — schema is required
    throw e;
  }
}

// ==============================
// ROUTES
// ==============================
const routeModules = [
  ["/api/customers", "./routes/customers"],
  ["/api/products", "./routes/products"],
  ["/api/invoices", "./routes/invoices"],
  ["/api/employees", "./routes/employees"],
  ["/api/branches", "./routes/branches"],
  ["/api/receipts", "./routes/receipts"],
  ["/api/offers", "./routes/offers"],
  ["/api/stock-movements", "./routes/stockMovements"],
  ["/api/returns", "./routes/returns"],
  ["/api/shifts", "./routes/shifts"],
  ["/api/attendance", "./routes/attendance"],
  ["/api/expenses", "./routes/expenses"],
  ["/api/users", "./routes/users"],
  ["/api/settings", "./routes/settings"],
  ["/api/audit-log", "./routes/auditLog"],
  ["/api/security-log", "./routes/securityLog"],
  ["/api/files", "./routes/files"],
  ["/api/backup", "./routes/backup"],
];

for (const [path, mod] of routeModules) {
  try {
    app.use(path, require(mod));
    log("info", `Route mounted: ${path}`);
  } catch (e) {
    log("error", `Failed to mount route: ${path}`, { error: e.message });
  }
}

// ==============================
// SERVE STATIC FRONTEND (Web mode — no Electron needed)
// Serves dist/ folder for browser access via LAN/VPN
// ==============================
const distPath = pathNode.join(__dirname, "../../dist");
if (fsNode.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — serve index.html for all non-API routes
  app.get(/^(?!\/api).*/, (_req, res, next) => {
    const indexPath = pathNode.join(distPath, "index.html");
    if (fsNode.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
  log("info", "Static frontend served from dist/");
}

// ==============================
// AUTO-BACKUP SCHEDULER — daily backup at server level
// ==============================
const BACKUP_INTERVAL_HOURS = parseInt(process.env.BACKUP_INTERVAL_HOURS, 10) || 24;

async function runAutoBackup() {
  try {
    const backupRoute = require("./routes/backup");
    const backupDir = process.env.BACKUP_DIR || pathNode.join(process.cwd(), "backups");
    if (!fsNode.existsSync(backupDir)) fsNode.mkdirSync(backupDir, { recursive: true });

    const tables = [
      "customers", "products", "invoices", "employees", "branches",
      "receipts", "offers", "stock_movements", "product_returns",
      "shifts", "attendance", "expenses", "user_accounts", "settings",
      "audit_log", "security_log",
    ];
    const data = {};
    for (const table of tables) {
      try { const { rows } = await pool.query(`SELECT * FROM ${table}`); data[table] = rows; } catch { data[table] = []; }
    }
    const backup = {
      meta: { version: 1, type: "auto", label: "نسخة تلقائية", createdAt: new Date().toISOString(),
        tableCount: Object.keys(data).length, totalRows: Object.values(data).reduce((s, arr) => s + arr.length, 0) },
      data,
    };
    const filename = `auto_${Date.now()}.json`;
    fsNode.writeFileSync(pathNode.join(backupDir, filename), JSON.stringify(backup));

    // Clean old auto backups (keep last 7)
    const autoFiles = fsNode.readdirSync(backupDir).filter(f => f.startsWith("auto_")).sort().reverse();
    for (const f of autoFiles.slice(7)) {
      try { fsNode.unlinkSync(pathNode.join(backupDir, f)); } catch {}
    }
    log("info", "Auto backup created: " + filename);
  } catch (e) {
    log("error", "Auto backup failed", { error: e.message });
  }
}

setInterval(() => runAutoBackup(), BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
// Run first auto backup 1 minute after startup
setTimeout(() => runAutoBackup(), 60 * 1000);

// ==============================
// ERROR HANDLING
// ==============================
app.use((err, req, res, _next) => {
  log("error", "Unhandled API error", {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ==============================
// SERVER STARTUP — SAFE PORT MANAGEMENT
// No blind kill. Check health first, only kill OUR stale processes.
// ==============================
const server = http.createServer(app);

async function isOurProcessOnPort(port) {
  // Check if the process on our port responds to OUR health endpoint
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: 2000 }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          // It's our Emperor API if it has status:"ok" and the port field
          resolve(json.status === "ok" && json.port === port);
        } catch { resolve(false); }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function killProcessOnPort(port) {
  try {
    const { execSync } = require("child_process");
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf8" });
      const lines = output.trim().split("\n");
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== String(process.pid)) {
          try { execSync(`taskkill /PID ${pid} /F`); log("info", `Killed stale Emperor process on port ${port}`, { pid }); } catch {}
        }
      }
    } else {
      try {
        const output = execSync(`lsof -ti:${port}`, { encoding: "utf8" });
        const pids = output.trim().split("\n").filter(Boolean);
        for (const pid of pids) {
          if (pid !== String(process.pid)) {
            try { execSync(`kill -9 ${pid}`); log("info", `Killed stale Emperor process on port ${port}`, { pid }); } catch {}
          }
        }
      } catch {}
    }
  } catch {}
}

async function startServer() {
  // First: ensure DB schema exists
  await ensureSchema();

  // Check if port is in use by our own stale process
  const isOurs = await isOurProcessOnPort(PORT);
  if (isOurs) {
    log("info", "Stale Emperor instance detected on port " + PORT + " — killing it");
    killProcessOnPort(PORT);
    await new Promise(r => setTimeout(r, 1500));
  }

  server.listen(PORT, "0.0.0.0", () => {
    startedAt = Date.now();
    log("info", `Emperor API running on http://0.0.0.0:${PORT}`, {
      env: process.env.NODE_ENV || "development",
      pid: process.pid,
    });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log("warn", `Port ${PORT} in use. Attempting cleanup...`);
      killProcessOnPort(PORT);
      setTimeout(() => {
        server.listen(PORT, "0.0.0.0");
      }, 2000);
    } else {
      log("error", "Server error", { error: err.message });
      process.exit(1);
    }
  });
}

startServer();

// ==============================
// GRACEFUL SHUTDOWN
// ==============================
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log("info", `Received ${signal}. Shutting down gracefully...`);

  server.close(() => {
    log("info", "HTTP server closed");
  });

  try {
    await pool.end();
    log("info", "Database pool closed");
  } catch (e) {
    log("error", "Error closing database pool", { error: e.message });
  }

  setTimeout(() => {
    log("warn", "Forced shutdown after timeout");
    process.exit(1);
  }, 10000);

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  log("error", "Uncaught exception", { error: err.message, stack: err.stack });
});

process.on("unhandledRejection", (reason) => {
  log("error", "Unhandled rejection", { reason: String(reason) });
});
