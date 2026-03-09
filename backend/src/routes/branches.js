const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({ id: r.id, name: r.name, address: r.address, rent: Number(r.rent), active: r.active });

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM branches ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO branches (id, name, address, rent, active)
       VALUES ('B' || LPAD(nextval('branches_seq')::TEXT, 3, '0'), $1,$2,$3,$4) RETURNING *`,
      [d.name, d.address||'', d.rent||0, d.active!==false]
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.address !== undefined) { sets.push(`address=$${i++}`); vals.push(d.address); }
    if (d.rent !== undefined) { sets.push(`rent=$${i++}`); vals.push(d.rent); }
    if (d.active !== undefined) { sets.push(`active=$${i++}`); vals.push(d.active); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE branches SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM branches WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
