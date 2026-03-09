const router = require("express").Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// ==============================
// File/Image Storage API
// Stores files on disk + metadata in PostgreSQL
// ==============================

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  },
});

const toApi = (r) => ({
  id: r.id,
  name: r.name,
  relatedTo: r.related_to,
  relatedId: r.related_id,
  fileName: r.file_name,
  storedName: r.stored_name,
  mimeType: r.mime_type,
  size: Number(r.size),
  createdAt: r.created_at,
});

// GET all files metadata (optional filter by relatedTo & relatedId)
router.get("/", async (req, res, next) => {
  try {
    const { relatedTo, relatedId } = req.query;
    let query = "SELECT * FROM files";
    const params = [];
    const conditions = [];

    if (relatedTo) {
      conditions.push(`related_to = $${params.length + 1}`);
      params.push(relatedTo);
    }
    if (relatedId) {
      conditions.push(`related_id = $${params.length + 1}`);
      params.push(relatedId);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const { rows } = await pool.query(query, params);
    res.json(rows.map(toApi));
  } catch (e) {
    next(e);
  }
});

// POST upload a file
router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { name, relatedTo, relatedId } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO files (id, name, related_to, related_id, file_name, stored_name, mime_type, size)
       VALUES ('FILE-' || LPAD(nextval('files_seq')::TEXT, 5, '0'), $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name || req.file.originalname,
        relatedTo || "",
        relatedId || "",
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
      ]
    );

    res.json(toApi(rows[0]));
  } catch (e) {
    next(e);
  }
});

// GET download/serve a file by id
router.get("/:id/download", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM files WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = rows[0];
    const filePath = path.join(UPLOAD_DIR, file.stored_name);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.file_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    next(e);
  }
});

// GET serve file as image (alias for download)
router.get("/:id/view", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM files WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = rows[0];
    const filePath = path.join(UPLOAD_DIR, file.stored_name);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Cache for 1 hour
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", file.mime_type);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    next(e);
  }
});

// DELETE a file
router.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM files WHERE id = $1", [req.params.id]);
    if (rows.length > 0) {
      const filePath = path.join(UPLOAD_DIR, rows[0].stored_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await pool.query("DELETE FROM files WHERE id = $1", [req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
