const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, category: r.category, description: r.description, amount: Number(r.amount),
  date: r.date, branch: r.branch, paidBy: r.paid_by, recurring: r.recurring, notes: r.notes,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM expenses ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO expenses (id, category, description, amount, date, branch, paid_by, recurring, notes)
       VALUES ('EXP' || LPAD(nextval('expenses_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.category||'other', d.description||'', d.amount||0, d.date||'', d.branch||'', d.paidBy||'', d.recurring||false, d.notes||'']
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.category !== undefined) { sets.push(`category=$${i++}`); vals.push(d.category); }
    if (d.description !== undefined) { sets.push(`description=$${i++}`); vals.push(d.description); }
    if (d.amount !== undefined) { sets.push(`amount=$${i++}`); vals.push(d.amount); }
    if (d.date !== undefined) { sets.push(`date=$${i++}`); vals.push(d.date); }
    if (d.branch !== undefined) { sets.push(`branch=$${i++}`); vals.push(d.branch); }
    if (d.paidBy !== undefined) { sets.push(`paid_by=$${i++}`); vals.push(d.paidBy); }
    if (d.recurring !== undefined) { sets.push(`recurring=$${i++}`); vals.push(d.recurring); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE expenses SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
