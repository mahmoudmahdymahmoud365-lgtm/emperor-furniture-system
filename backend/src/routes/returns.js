const router = require("express").Router();
const pool = require("../db");
const invoicesModule = require("./invoices");
const recomputeInvoiceStatus = invoicesModule.recomputeInvoiceStatus || (async () => {});

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
    const items = (d.items || []).filter(i => Number(i.qty) > 0);
    if (items.length === 0) return res.status(400).json({ error: "لا توجد بنود للمرتجع" });

    // Validate against the invoice: cannot return more than sold minus previously returned
    if (d.invoiceId) {
      const { rows: invRows } = await pool.query("SELECT * FROM invoices WHERE id=$1", [d.invoiceId]);
      if (!invRows[0]) return res.status(404).json({ error: "الفاتورة غير موجودة" });
      const sold = new Map();
      for (const it of (invRows[0].items || [])) {
        sold.set(it.productName, (sold.get(it.productName) || 0) + (Number(it.qty) || 0));
      }
      const { rows: prevRet } = await pool.query("SELECT items FROM product_returns WHERE invoice_id=$1", [d.invoiceId]);
      for (const r of prevRet) for (const it of (r.items || [])) {
        sold.set(it.productName, (sold.get(it.productName) || 0) - (Number(it.qty) || 0));
      }
      for (const it of items) {
        const available = sold.get(it.productName) || 0;
        if (Number(it.qty) > available) {
          return res.status(400).json({ error: `الكمية المرتجعة من "${it.productName}" أكبر من المتاح (${available})` });
        }
      }
    }

    const totalAmount = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);

    const { rows } = await pool.query(
      `INSERT INTO product_returns (id, invoice_id, customer, date, items, total_amount, reason, notes)
       VALUES ('RET' || LPAD(nextval('returns_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.invoiceId||'', d.customer||'', d.date || new Date().toISOString().split("T")[0],
       JSON.stringify(items), totalAmount, d.reason||'', d.notes||'']
    );

    // Restore stock (skip agency products — they were never deducted)
    for (const item of items) {
      const { rows: prows } = await pool.query("SELECT id, is_agency FROM products WHERE name=$1 LIMIT 1", [item.productName]);
      if (prows[0] && !prows[0].is_agency) {
        await pool.query("UPDATE products SET stock = stock + $1, updated_at=NOW() WHERE id=$2", [Number(item.qty) || 0, prows[0].id]);
      }
    }

    // The invoice keeps its paid_total; the net due drops by the returned value,
    // so the status is recomputed against (total - returned).
    if (d.invoiceId) {
      await pool.query("UPDATE invoices SET updated_at=NOW() WHERE id=$1", [d.invoiceId]);
      await recomputeInvoiceStatus(d.invoiceId);
    }

    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM product_returns WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "المرتجع غير موجود" });
    for (const item of (rows[0].items || [])) {
      const { rows: prows } = await pool.query("SELECT id, is_agency FROM products WHERE name=$1 LIMIT 1", [item.productName]);
      if (prows[0] && !prows[0].is_agency) {
        await pool.query("UPDATE products SET stock = GREATEST(0, stock - $1), updated_at=NOW() WHERE id=$2", [Number(item.qty) || 0, prows[0].id]);
      }
    }
    await pool.query("DELETE FROM product_returns WHERE id=$1", [req.params.id]);
    if (rows[0].invoice_id) await recomputeInvoiceStatus(rows[0].invoice_id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
