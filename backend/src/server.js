// ==============================
// Emperor ERP — Enterprise Express API Server
// Production-grade with health checks, graceful shutdown, logging
// ==============================
const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ==============================
// LOGGING
// ==============================
function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [API:${level.toUpperCase()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

// ==============================
// MIDDLEWARE
// ==============================
app.use(cors({
  origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging
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
  const status = { status: "ok", timestamp: new Date().toISOString(), uptime: startedAt ? Date.now() - startedAt : 0 };
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ==============================
// SERVER STARTUP WITH PORT CONFLICT DETECTION
// ==============================
const server = http.createServer(app);

function startServer(port, retries = 3) {
  server.listen(port, "0.0.0.0", () => {
    startedAt = Date.now();
    log("info", `Emperor API running on http://0.0.0.0:${port}`, {
      env: process.env.NODE_ENV || "development",
      pid: process.pid,
    });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log("warn", `Port ${port} in use`, { retries });
      if (retries > 0) {
        const nextPort = port + 1;
        log("info", `Trying port ${nextPort}...`);
        startServer(nextPort, retries - 1);
      } else {
        log("error", "All ports exhausted. Cannot start server.");
        process.exit(1);
      }
    } else {
      log("error", "Server error", { error: err.message });
      process.exit(1);
    }
  });
}

startServer(PORT);

// ==============================
// GRACEFUL SHUTDOWN
// ==============================
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log("info", `Received ${signal}. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    log("info", "HTTP server closed");
  });

  // Close database pool
  try {
    await pool.end();
    log("info", "Database pool closed");
  } catch (e) {
    log("error", "Error closing database pool", { error: e.message });
  }

  // Force exit after 10s
  setTimeout(() => {
    log("warn", "Forced shutdown after timeout");
    process.exit(1);
  }, 10000);

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Uncaught error handlers
process.on("uncaughtException", (err) => {
  log("error", "Uncaught exception", { error: err.message, stack: err.stack });
});

process.on("unhandledRejection", (reason) => {
  log("error", "Unhandled rejection", { reason: String(reason) });
});
