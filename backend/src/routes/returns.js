const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, invoiceId: r.invoice_id, customer: r.customer, date: r.date,
  items: r.items || [], totalAmount: Number(r.total_amount), reason: r.reason, notes: r.notes,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM product_returns ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO product_returns (id, invoice_id, customer, date, items, total_amount, reason, notes)
       VALUES ('RET' || LPAD(nextval('returns_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.invoiceId||'', d.customer||'', d.date||'', JSON.stringify(d.items||[]), d.totalAmount||0, d.reason||'', d.notes||'']
    );
    // Restore stock and update invoice
    for (const item of (d.items || [])) {
      await pool.query("UPDATE products SET stock = stock + $1 WHERE name = $2", [item.qty, item.productName]);
    }
    if (d.invoiceId) {
      await pool.query("UPDATE invoices SET paid_total = GREATEST(0, paid_total - $1) WHERE id = $2", [d.totalAmount||0, d.invoiceId]);
    }
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

module.exports = router;
