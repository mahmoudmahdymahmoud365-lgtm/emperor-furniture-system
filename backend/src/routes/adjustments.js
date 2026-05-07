// ==============================
// Customer Balance Adjustments — financial settlements
// Every change is also written to audit_log for full traceability.
// ==============================
const router = require("express").Router();
const pool = require("../db");

const ALLOWED_TYPES = new Set(["discount", "debt_settlement", "interest", "manual"]);

const toApi = r => ({
  id: r.id,
  customerId: r.customer_id || "",
  customerName: r.customer_name || "",
  invoiceId: r.invoice_id || "",
  adjustmentType: r.adjustment_type,
  amount: Number(r.amount),
  reason: r.reason || "",
  notes: r.notes || "",
  createdBy: r.created_by || "",
  createdAt: r.created_at?.toISOString?.() || r.created_at || null,
});

router.get("/", async (req, res, next) => {
  try {
    const { customerId, invoiceId } = req.query;
    let sql = "SELECT * FROM customer_balance_adjustments";
    const where = []; const vals = []; let i = 1;
    if (customerId) { where.push(`customer_id=$${i++}`); vals.push(customerId); }
    if (invoiceId) { where.push(`invoice_id=$${i++}`); vals.push(invoiceId); }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY created_at DESC";
    const { rows } = await pool.query(sql, vals);
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body || {};
    if (!ALLOWED_TYPES.has(d.adjustmentType)) {
      return res.status(400).json({ error: "نوع التسوية غير صحيح" });
    }
    if (typeof d.amount !== "number" || isNaN(d.amount)) {
      return res.status(400).json({ error: "قيمة التسوية مطلوبة" });
    }
    const { rows } = await pool.query(
      `INSERT INTO customer_balance_adjustments
        (customer_id, customer_name, invoice_id, adjustment_type, amount, reason, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.customerId||"", d.customerName||"", d.invoiceId||"",
       d.adjustmentType, d.amount, d.reason||"", d.notes||"", d.createdBy||""]
    );
    const adj = rows[0];

    // Audit trail (mandatory)
    const auditId = `AL${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
    const details = `تسوية ${adj.adjustment_type} بقيمة ${Number(adj.amount).toLocaleString()} — ${adj.reason || "بدون سبب"}`;
    await pool.query(
      `INSERT INTO audit_log (id, "user", action, entity, entity_id, entity_name, details)
       VALUES ($1,$2,'create','customer',$3,$4,$5)`,
      [auditId, d.createdBy || "", d.customerId || "", d.customerName || "", details]
    );

    // Touch invoice updated_at so connected clients refresh
    if (adj.invoice_id) {
      await pool.query("UPDATE invoices SET updated_at=NOW() WHERE id=$1", [adj.invoice_id]).catch(() => {});
    }
    res.json(toApi(adj));
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM customer_balance_adjustments WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "غير موجود" });
    const adj = rows[0];
    await pool.query("DELETE FROM customer_balance_adjustments WHERE id=$1", [req.params.id]);
    const auditId = `AL${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
    await pool.query(
      `INSERT INTO audit_log (id, "user", action, entity, entity_id, entity_name, details)
       VALUES ($1,$2,'delete','customer',$3,$4,$5)`,
      [auditId, req.body?.deletedBy || "", adj.customer_id || "", adj.customer_name || "",
       `حذف تسوية ${adj.adjustment_type} بقيمة ${Number(adj.amount).toLocaleString()}`]
    );
    if (adj.invoice_id) {
      await pool.query("UPDATE invoices SET updated_at=NOW() WHERE id=$1", [adj.invoice_id]).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
