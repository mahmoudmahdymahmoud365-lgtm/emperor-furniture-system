const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, customer: r.customer, branch: r.branch, employee: r.employee,
  date: r.date, deliveryDate: r.delivery_date, items: r.items || [],
  status: r.status, paidTotal: Number(r.paid_total), commissionPercent: Number(r.commission_percent),
  appliedOfferName: r.applied_offer_name || '', appliedDiscount: Number(r.applied_discount || 0),
  notes: r.notes || '',
  updatedAt: r.updated_at?.toISOString?.() || r.updated_at || null,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM invoices ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO invoices (id, customer, branch, employee, date, delivery_date, items, status, paid_total, commission_percent, applied_offer_name, applied_discount, notes)
       VALUES ('INV-' || LPAD(nextval('invoices_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.customer, d.branch||'', d.employee||'', d.date||'', d.deliveryDate||'',
       JSON.stringify(d.items||[]), d.status||'مسودة', d.paidTotal||0, d.commissionPercent||0,
       d.appliedOfferName||'', d.appliedDiscount||0, d.notes||'']
    );
    for (const item of (d.items || [])) {
      await pool.query("UPDATE products SET stock = GREATEST(0, stock - $1) WHERE name = $2", [item.qty, item.productName]);
    }
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.customer !== undefined) { sets.push(`customer=$${i++}`); vals.push(d.customer); }
    if (d.branch !== undefined) { sets.push(`branch=$${i++}`); vals.push(d.branch); }
    if (d.employee !== undefined) { sets.push(`employee=$${i++}`); vals.push(d.employee); }
    if (d.date !== undefined) { sets.push(`date=$${i++}`); vals.push(d.date); }
    if (d.deliveryDate !== undefined) { sets.push(`delivery_date=$${i++}`); vals.push(d.deliveryDate); }
    if (d.items !== undefined) { sets.push(`items=$${i++}`); vals.push(JSON.stringify(d.items)); }
    if (d.status !== undefined) { sets.push(`status=$${i++}`); vals.push(d.status); }
    if (d.paidTotal !== undefined) { sets.push(`paid_total=$${i++}`); vals.push(d.paidTotal); }
    if (d.commissionPercent !== undefined) { sets.push(`commission_percent=$${i++}`); vals.push(d.commissionPercent); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });

    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);

    let query = `UPDATE invoices SET ${sets.join(",")} WHERE id=$${i}`;
    if (d._updatedAt) {
      vals.push(d._updatedAt);
      query += ` AND updated_at=$${i + 1}`;
    }
    query += " RETURNING updated_at";

    const { rowCount, rows } = await pool.query(query, vals);
    if (rowCount === 0 && d._updatedAt) {
      return res.status(409).json({ error: "CONFLICT", message: "تم تعديل هذا السجل من جهاز آخر. يرجى إعادة تحميل البيانات." });
    }
    res.json({ ok: true, updatedAt: rows[0]?.updated_at });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT items FROM invoices WHERE id=$1", [req.params.id]);
    if (rows[0]) {
      for (const item of (rows[0].items || [])) {
        await pool.query("UPDATE products SET stock = stock + $1 WHERE name = $2", [item.qty, item.productName]);
      }
    }
    await pool.query("DELETE FROM receipts WHERE invoice_id=$1", [req.params.id]);
    await pool.query("DELETE FROM invoices WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
