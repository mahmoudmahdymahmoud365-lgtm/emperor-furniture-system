const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, timestamp: r.timestamp, user: r.user, action: r.action,
  entity: r.entity, entityId: r.entity_id, entityName: r.entity_name, details: r.details,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 1000');
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const id = `AL${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    await pool.query(
      `INSERT INTO audit_log (id, "user", action, entity, entity_id, entity_name, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, d.user||'', d.action||'', d.entity||'', d.entityId||'', d.entityName||'', d.details||'']
    );
    res.json({ id, ...d });
  } catch (e) { next(e); }
});

router.delete("/", async (_, res, next) => {
  try {
    await pool.query("DELETE FROM audit_log");
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
