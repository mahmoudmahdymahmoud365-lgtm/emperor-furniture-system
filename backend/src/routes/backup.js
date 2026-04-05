// ==============================
// Backup & Restore Routes — Real pg_dump/pg_restore implementation
// ==============================
const router = require("express").Router();
const pool = require("../db");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET /backup/list — list all backup files
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
          createdAt: stat.birthtime.toISOString(),
          type: meta.type || (f.startsWith("auto_") ? "auto" : "manual"),
          label: meta.label || "",
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /backup/export — create a full JSON backup of all tables
router.post("/export", async (req, res) => {
  try {
    ensureBackupDir();
    const label = req.body.label || "";
    const type = req.body.type || "manual";

    // Export all tables as JSON
    const tables = [
      "customers", "products", "invoices", "employees", "branches",
      "receipts", "offers", "stock_movements", "product_returns",
      "shifts", "attendance", "expenses", "user_accounts", "settings",
      "audit_log", "security_log",
    ];

    const data = {};
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        data[table] = rows;
      } catch {
        data[table] = [];
      }
    }

    const backup = {
      meta: {
        version: 1,
        type,
        label,
        createdAt: new Date().toISOString(),
        tableCount: Object.keys(data).length,
        totalRows: Object.values(data).reduce((s, arr) => s + arr.length, 0),
      },
      data,
    };

    const filename = `${type}_${Date.now()}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    const stat = fs.statSync(filepath);
    res.json({
      id: filename.replace(".json", ""),
      filename,
      size: stat.size,
      createdAt: backup.meta.createdAt,
      type,
      label,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /backup/download/:id — download a backup file
router.get("/download/:id", (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup not found" });
    res.download(filepath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /backup/restore/:id — restore from a server-stored backup
router.post("/restore/:id", async (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Backup not found" });

    const backup = JSON.parse(fs.readFileSync(filepath, "utf8"));
    await restoreData(backup.data);
    res.json({ ok: true, message: "Restore completed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /backup/restore-upload — restore from uploaded JSON
router.post("/restore-upload", async (req, res) => {
  try {
    const backup = req.body;
    if (!backup.data) return res.status(400).json({ error: "Invalid backup format" });
    await restoreData(backup.data);
    res.json({ ok: true, message: "Restore completed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /backup/:id — delete a backup file
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
// Restore logic — TRUNCATE + INSERT in transaction
// ==============================
async function restoreData(data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Order matters for foreign key safety
    const restoreOrder = [
      "settings", "user_accounts", "branches", "customers", "employees",
      "products", "invoices", "receipts", "offers", "stock_movements",
      "product_returns", "shifts", "attendance", "expenses",
      "audit_log", "security_log",
    ];

    for (const table of restoreOrder) {
      if (!data[table] || !Array.isArray(data[table]) || data[table].length === 0) continue;
      
      // Settings uses UPSERT
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
