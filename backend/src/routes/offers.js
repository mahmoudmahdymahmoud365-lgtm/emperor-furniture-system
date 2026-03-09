const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, name: r.name, type: r.type, value: Number(r.value),
  productId: r.product_id, productName: r.product_name,
  startDate: r.start_date, endDate: r.end_date, active: r.active, notes: r.notes,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM offers ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO offers (id, name, type, value, product_id, product_name, start_date, end_date, active, notes)
       VALUES ('OF' || LPAD(nextval('offers_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.name, d.type||'percentage', d.value||0, d.productId||'', d.productName||'',
       d.startDate||'', d.endDate||'', d.active!==false, d.notes||'']
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.type !== undefined) { sets.push(`type=$${i++}`); vals.push(d.type); }
    if (d.value !== undefined) { sets.push(`value=$${i++}`); vals.push(d.value); }
    if (d.productId !== undefined) { sets.push(`product_id=$${i++}`); vals.push(d.productId); }
    if (d.productName !== undefined) { sets.push(`product_name=$${i++}`); vals.push(d.productName); }
    if (d.startDate !== undefined) { sets.push(`start_date=$${i++}`); vals.push(d.startDate); }
    if (d.endDate !== undefined) { sets.push(`end_date=$${i++}`); vals.push(d.endDate); }
    if (d.active !== undefined) { sets.push(`active=$${i++}`); vals.push(d.active); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE offers SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM offers WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
