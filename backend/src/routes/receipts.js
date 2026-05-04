const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, invoiceId: r.invoice_id, customer: r.customer, amount: Number(r.amount),
  date: r.date, method: r.method, notes: r.notes,
  updatedAt: r.updated_at?.toISOString?.() || r.updated_at || null,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM receipts ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO receipts (id, invoice_id, customer, amount, date, method, notes)
       VALUES ('R' || LPAD(nextval('receipts_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.invoiceId||'', d.customer||'', d.amount||0, d.date || new Date().toISOString().split("T")[0], d.method||'', d.notes||'']
    );
    if (d.invoiceId) {
      await pool.query("UPDATE invoices SET paid_total = paid_total + $1, updated_at=NOW() WHERE id = $2", [d.amount||0, d.invoiceId]);
    }
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    if (d.amount !== undefined) {
      const { rows: old } = await pool.query("SELECT * FROM receipts WHERE id=$1", [req.params.id]);
      if (old[0] && d.amount !== Number(old[0].amount)) {
        const diff = d.amount - Number(old[0].amount);
        await pool.query("UPDATE invoices SET paid_total = GREATEST(0, paid_total + $1), updated_at=NOW() WHERE id = $2", [diff, old[0].invoice_id]);
      }
    }
    const sets = []; const vals = []; let i = 1;
    if (d.invoiceId !== undefined) { sets.push(`invoice_id=$${i++}`); vals.push(d.invoiceId); }
    if (d.customer !== undefined) { sets.push(`customer=$${i++}`); vals.push(d.customer); }
    if (d.amount !== undefined) { sets.push(`amount=$${i++}`); vals.push(d.amount); }
    if (d.date !== undefined) { sets.push(`date=$${i++}`); vals.push(d.date); }
    if (d.method !== undefined) { sets.push(`method=$${i++}`); vals.push(d.method); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });
    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(`UPDATE receipts SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals);
    res.json(rows[0] ? toApi(rows[0]) : { ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM receipts WHERE id=$1", [req.params.id]);
    if (rows[0]) {
      await pool.query("UPDATE invoices SET paid_total = GREATEST(0, paid_total - $1), updated_at=NOW() WHERE id = $2", [Number(rows[0].amount), rows[0].invoice_id]);
    }
    await pool.query("DELETE FROM receipts WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
