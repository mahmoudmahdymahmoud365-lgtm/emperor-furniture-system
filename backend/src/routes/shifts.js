const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, name: r.name, startTime: r.start_time, endTime: r.end_time,
  hours: Number(r.hours), branch: r.branch, active: r.active, notes: r.notes,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM shifts ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO shifts (id, name, start_time, end_time, hours, branch, active, notes)
       VALUES ('SH' || LPAD(nextval('shifts_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.name, d.startTime||'', d.endTime||'', d.hours||0, d.branch||'', d.active!==false, d.notes||'']
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.startTime !== undefined) { sets.push(`start_time=$${i++}`); vals.push(d.startTime); }
    if (d.endTime !== undefined) { sets.push(`end_time=$${i++}`); vals.push(d.endTime); }
    if (d.hours !== undefined) { sets.push(`hours=$${i++}`); vals.push(d.hours); }
    if (d.branch !== undefined) { sets.push(`branch=$${i++}`); vals.push(d.branch); }
    if (d.active !== undefined) { sets.push(`active=$${i++}`); vals.push(d.active); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE shifts SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM shifts WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
