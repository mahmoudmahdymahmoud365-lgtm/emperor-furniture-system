const router = require("express").Router();
const pool = require("../db");

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM settings");
    const obj = {};
    rows.forEach(r => {
      try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; }
    });
    res.json(obj);
  } catch (e) { next(e); }
});

router.put("/", async (req, res, next) => {
  try {
    const data = req.body;
    for (const [key, value] of Object.entries(data)) {
      const val = typeof value === 'string' ? value : JSON.stringify(value);
      await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, val]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
