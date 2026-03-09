const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, type: r.type, email: r.email, userName: r.user_name,
  timestamp: r.timestamp, ip: r.ip, userAgent: r.user_agent,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM security_log ORDER BY timestamp DESC LIMIT 500");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const id = `SEC${Date.now().toString(36)}`;
    await pool.query(
      `INSERT INTO security_log (id, type, email, user_name, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, d.type||'', d.email||'', d.userName||'', d.ip||'', d.userAgent||'']
    );
    res.json({ id, ...d });
  } catch (e) { next(e); }
});

router.delete("/", async (_, res, next) => {
  try {
    await pool.query("DELETE FROM security_log");
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
