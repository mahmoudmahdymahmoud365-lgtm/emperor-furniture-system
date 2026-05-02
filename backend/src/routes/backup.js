// ==============================
// Backup & Restore Routes
// - Local backups to user-configurable directory (settings.backup_local_path)
// - Automatic OneDrive upload after each backup (when connected & enabled)
// - Safety snapshot before any restore
// - Versioned JSON format with meta
// ==============================
const router = require("express").Router();
const pool = require("../db");
const fs = require("fs");
const path = require("path");
const onedrive = require("../services/onedriveService");

const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

const ALL_TABLES = [
  "customers", "products", "invoices", "employees", "branches",
  "receipts", "offers", "stock_movements", "product_returns",
  "shifts", "attendance", "expenses", "user_accounts", "settings",
  "audit_log", "security_log",
];

// ---------- Settings helpers ----------
async function getSetting(key, fallback = "") {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key=$1", [key]);
  return rows[0] ? rows[0].value : fallback;
}
async function setSetting(key, value) {
  await pool.query(
    "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
    [key, String(value)]
  );
}

async function getBackupConfig() {
  return {
    localPath: (await getSetting("backup_local_path", "")) || DEFAULT_BACKUP_DIR,
    autoEnabled: (await getSetting("backup_auto_enabled", "true")) === "true",
    intervalHours: parseInt(await getSetting("backup_interval_hours", "24"), 10) || 24,
    onedriveUpload: (await getSetting("backup_onedrive_upload", "false")) === "true",
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------- Core backup logic ----------
async function exportAllTables() {
  const data = {};
  for (const table of ALL_TABLES) {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${table}`);
      data[table] = rows;
    } catch {
      data[table] = [];
    }
  }
  return data;
}

async function saveBackupToDir(dir, type, label, data) {
  ensureDir(dir);
  const now = new Date();
  const backup = {
    meta: {
      version: 1,
      type,
      label: label || "",
      createdAt: now.toISOString(),
      tableCount: Object.keys(data).length,
      totalRows: Object.values(data).reduce((s, arr) => s + arr.length, 0),
    },
    data,
  };
  const filename = `${type}_${Date.now()}.json`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
  const stat = fs.statSync(filepath);
  return {
    id: filename.replace(".json", ""),
    filename,
    filepath,
    size: stat.size,
    createdAt: backup.meta.createdAt,
    type,
    label: label || "",
  };
}

function cleanupOldBackups(dir, keep = MAX_BACKUPS) {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (const f of files.slice(keep)) {
      try { fs.unlinkSync(path.join(dir, f.name)); } catch {}
    }
  } catch {}
}

// Public helper used by scheduler in server.js
async function performBackup(type, label) {
  const cfg = await getBackupConfig();
  const data = await exportAllTables();
  const meta = await saveBackupToDir(cfg.localPath, type, label, data);
  cleanupOldBackups(cfg.localPath);

  // Upload to OneDrive if connected + enabled
  let cloudResult = null;
  if (cfg.onedriveUpload) {
    try {
      const status = await onedrive.getStatus();
      if (status.connected) {
        const upl = await onedrive.uploadFile(meta.filepath, meta.filename);
        await onedrive.recordSync(true, null);
        cloudResult = { ok: true, ...upl };
      } else {
        cloudResult = { ok: false, error: "OneDrive not connected" };
      }
    } catch (e) {
      try { await onedrive.recordSync(false, e.message); } catch {}
      cloudResult = { ok: false, error: e.message };
    }
  }

  return { ...meta, cloud: cloudResult };
}

// ==============================
// ROUTES
// ==============================

// GET /api/backup/config
router.get("/config", async (_req, res) => {
  try {
    const cfg = await getBackupConfig();
    res.json({
      ...cfg,
      defaultPath: DEFAULT_BACKUP_DIR,
      pathExists: fs.existsSync(cfg.localPath),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup/config
router.post("/config", async (req, res) => {
  try {
    const { localPath, autoEnabled, intervalHours, onedriveUpload } = req.body || {};
    if (typeof localPath === "string") {
      const trimmed = localPath.trim();
      if (trimmed) {
        try { ensureDir(trimmed); } catch (e) {
          return res.status(400).json({ error: `Cannot create/access path: ${e.message}` });
        }
        // Write test
        try {
          const probe = path.join(trimmed, ".emperor_write_test");
          fs.writeFileSync(probe, "ok");
          fs.unlinkSync(probe);
        } catch (e) {
          return res.status(400).json({ error: `Path not writable: ${e.message}` });
        }
      }
      await setSetting("backup_local_path", trimmed);
    }
    if (typeof autoEnabled === "boolean") await setSetting("backup_auto_enabled", autoEnabled ? "true" : "false");
    if (Number.isFinite(intervalHours) && intervalHours > 0) await setSetting("backup_interval_hours", String(Math.floor(intervalHours)));
    if (typeof onedriveUpload === "boolean") await setSetting("backup_onedrive_upload", onedriveUpload ? "true" : "false");

    const cfg = await getBackupConfig();
    res.json({ ok: true, config: cfg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/backup/list
router.get("/list", async (_req, res) => {
  try {
    const cfg = await getBackupConfig();
    ensureDir(cfg.localPath);
    const files = fs.readdirSync(cfg.localPath)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const stat = fs.statSync(path.join(cfg.localPath, f));
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(path.join(cfg.localPath, f), "utf8")).meta || {}; } catch {}
        return {
          id: f.replace(".json", ""),
          filename: f,
          size: stat.size,
          createdAt: meta.createdAt || stat.birthtime.toISOString(),
          type: meta.type || (f.startsWith("auto_") ? "auto" : f.startsWith("safety_") ? "safety" : "manual"),
          label: meta.label || "",
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup/export
router.post("/export", async (req, res) => {
  try {
    const label = req.body?.label || "";
    const type = req.body?.type || "manual";
    const result = await performBackup(type, label);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/backup/download/:id
router.get("/download/:id", async (req, res) => {
  try {
    const cfg = await getBackupConfig();
    const filepath = path.join(cfg.localPath, `${req.params.id}.json`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup not found" });
    res.download(filepath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup/restore/:id
router.post("/restore/:id", async (req, res) => {
  try {
    const cfg = await getBackupConfig();
    const filepath = path.join(cfg.localPath, `${req.params.id}.json`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup not found" });

    // Safety snapshot
    const currentData = await exportAllTables();
    const safety = await saveBackupToDir(cfg.localPath, "safety", "نسخة أمان تلقائية قبل الاستعادة", currentData);

    const backup = JSON.parse(fs.readFileSync(filepath, "utf8"));
    await restoreData(backup.data);
    res.json({ ok: true, message: "Restore completed", safetyBackup: safety });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup/restore-upload
router.post("/restore-upload", async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.data) return res.status(400).json({ error: "Invalid backup format" });
    const cfg = await getBackupConfig();
    const currentData = await exportAllTables();
    const safety = await saveBackupToDir(cfg.localPath, "safety", "نسخة أمان تلقائية قبل الاستعادة", currentData);
    await restoreData(backup.data);
    res.json({ ok: true, message: "Restore completed", safetyBackup: safety });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/backup/:id
router.delete("/:id", async (req, res) => {
  try {
    const cfg = await getBackupConfig();
    const filepath = path.join(cfg.localPath, `${req.params.id}.json`);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==============================
// Restore logic — DELETE + INSERT in transaction
// ==============================
async function restoreData(data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = [
      "settings", "user_accounts", "branches", "customers", "employees",
      "products", "invoices", "receipts", "offers", "stock_movements",
      "product_returns", "shifts", "attendance", "expenses",
      "audit_log", "security_log",
    ];
    for (const table of order) {
      if (!data[table] || !Array.isArray(data[table]) || data[table].length === 0) continue;
      if (table === "settings") {
        for (const row of data[table]) {
          await client.query(
            "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
            [row.key, row.value]
          );
        }
        continue;
      }
      await client.query(`DELETE FROM ${table}`);
      const cols = Object.keys(data[table][0]);
      for (const row of data[table]) {
        const vals = cols.map(c => {
          const v = row[c];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        });
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
        await client.query(
          `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          vals
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Export the router AND helpers (for scheduler)
module.exports = router;
module.exports.performBackup = performBackup;
module.exports.getBackupConfig = getBackupConfig;
