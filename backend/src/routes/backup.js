// ==============================
// Backup & Restore Routes — with safety snapshot before restore
// ==============================
const router = require("express").Router();
const pool = require("../db");
const fs = require("fs");
const path = require("path");

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30; // Keep max 30 backups total

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ==============================
// Shared: export all tables as JSON
// ==============================
const ALL_TABLES = [
  "customers", "products", "invoices", "employees", "branches",
  "receipts", "offers", "stock_movements", "product_returns",
  "shifts", "attendance", "expenses", "user_accounts", "settings",
  "audit_log", "security_log",
];

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

async function saveBackup(type, label, data) {
  ensureBackupDir();
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
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
  const stat = fs.statSync(filepath);
  return {
    id: filename.replace(".json", ""),
    filename,
    size: stat.size,
    createdAt: backup.meta.createdAt,
    type,
    label: label || "",
  };
}

function cleanupOldBackups(keepCount = MAX_BACKUPS) {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (const f of files.slice(keepCount)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f.name)); } catch {}
    }
  } catch {}
}

// GET /backup/list
router.get("/list", async (_req, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), "utf8")).meta || {}; } catch {}
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

// POST /backup/export — create a full JSON backup
router.post("/export", async (req, res) => {
  try {
    const label = req.body.label || "";
    const type = req.body.type || "manual";
    const data = await exportAllTables();
    const meta = await saveBackup(type, label, data);
    cleanupOldBackups();
    res.json(meta);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /backup/download/:id
router.get("/download/:id", (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup not found" });
    res.download(filepath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /backup/restore/:id — restore from server backup (with safety snapshot)
router.post("/restore/:id", async (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup not found" });

    // SAFETY: create snapshot of current data BEFORE restoring
    const currentData = await exportAllTables();
    const safetyMeta = await saveBackup("safety", "نسخة أمان تلقائية قبل الاستعادة", currentData);

    const backup = JSON.parse(fs.readFileSync(filepath, "utf8"));
    await restoreData(backup.data);
    res.json({ ok: true, message: "Restore completed", safetyBackup: safetyMeta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /backup/restore-upload — restore from uploaded JSON (with safety snapshot)
router.post("/restore-upload", async (req, res) => {
  try {
    const backup = req.body;
    if (!backup.data) return res.status(400).json({ error: "Invalid backup format" });

    // SAFETY: create snapshot of current data BEFORE restoring
    const currentData = await exportAllTables();
    const safetyMeta = await saveBackup("safety", "نسخة أمان تلقائية قبل الاستعادة", currentData);

    await restoreData(backup.data);
    res.json({ ok: true, message: "Restore completed", safetyBackup: safetyMeta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /backup/:id
router.delete("/:id", (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, `${req.params.id}.json`);
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

    const restoreOrder = [
      "settings", "user_accounts", "branches", "customers", "employees",
      "products", "invoices", "receipts", "offers", "stock_movements",
      "product_returns", "shifts", "attendance", "expenses",
      "audit_log", "security_log",
    ];

    for (const table of restoreOrder) {
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

module.exports = router;
