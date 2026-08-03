const router = require("express").Router();
const pool = require("../db");

const AUTO_STATUSES = new Set(["مسودة", "مؤكدة", "مدفوعة جزئياً", "مدفوعة بالكامل", "مرتجعة"]);
const FROZEN_STATUSES = new Set(["ملغاة", "مغلقة"]);

const toApi = r => ({
  id: r.id, customer: r.customer, branch: r.branch, employee: r.employee,
  date: r.date, deliveryDate: r.delivery_date, items: r.items || [],
  status: r.status, paidTotal: Number(r.paid_total), commissionPercent: Number(r.commission_percent),
  appliedOfferName: r.applied_offer_name || '', appliedDiscount: Number(r.applied_discount || 0),
  notes: r.notes || '',
  returnedTotal: Number(r.returned_total || 0),
  updatedAt: r.updated_at?.toISOString?.() || r.updated_at || null,
});

function calcInvoiceTotal(inv) {
  const items = inv.items || [];
  const sub = items.reduce((s, it) => s + (Number(it.qty)||0) * (Number(it.unitPrice)||0) - (Number(it.lineDiscount)||0), 0);
  return sub - Number(inv.applied_discount || inv.appliedDiscount || 0);
}

// Applies a signed stock delta for a list of invoice items (skips agency products)
async function applyStockDelta(items, sign) {
  for (const item of (items || [])) {
    const qty = Number(item.qty) || 0;
    if (!item.productName || !qty) continue;
    const { rows } = await pool.query("SELECT id, is_agency FROM products WHERE name=$1 LIMIT 1", [item.productName]);
    if (!rows[0] || rows[0].is_agency) continue;
    await pool.query(
      "UPDATE products SET stock = GREATEST(0, stock + $1), updated_at=NOW() WHERE id=$2",
      [sign * qty, rows[0].id]
    );
  }
}

async function getReturnedTotal(invoiceId) {
  try {
    const { rows } = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS t FROM product_returns WHERE invoice_id=$1", [invoiceId]
    );
    return Number(rows[0]?.t || 0);
  } catch { return 0; }
}

async function recomputeInvoiceStatus(invoiceId) {
  const { rows } = await pool.query("SELECT * FROM invoices WHERE id=$1", [invoiceId]);
  if (!rows[0]) return;
  const inv = rows[0];
  // Never auto-override manually frozen statuses
  if (FROZEN_STATUSES.has(inv.status)) return;
  if (!AUTO_STATUSES.has(inv.status) && inv.status !== "" && inv.status !== "مدفوعة") return;

  const total = calcInvoiceTotal(inv);
  const returned = await getReturnedTotal(invoiceId);
  const net = total - returned;
  const paid = Number(inv.paid_total || 0);

  let next;
  if (returned > 0 && net <= 0.001) next = "مرتجعة";
  else if (net <= 0) next = inv.status || "مسودة";
  else if (paid <= 0) next = inv.status === "مسودة" ? "مسودة" : "مؤكدة";
  else if (paid + 0.001 < net) next = "مدفوعة جزئياً";
  else next = "مدفوعة بالكامل";

  if (next && next !== inv.status) {
    await pool.query("UPDATE invoices SET status=$1, updated_at=NOW() WHERE id=$2", [next, invoiceId]);
  }
}

async function fetchInvoiceApi(id) {
  const { rows } = await pool.query("SELECT * FROM invoices WHERE id=$1", [id]);
  if (!rows[0]) return null;
  const out = toApi(rows[0]);
  out.returnedTotal = await getReturnedTotal(id);
  return out;
}


router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM invoices ORDER BY created_at DESC");
    let returnsByInvoice = {};
    try {
      const { rows: rr } = await pool.query("SELECT invoice_id, COALESCE(SUM(total_amount),0) AS t FROM product_returns GROUP BY invoice_id");
      for (const r of rr) returnsByInvoice[r.invoice_id] = Number(r.t);
    } catch {}
    res.json(rows.map(r => ({ ...toApi(r), returnedTotal: returnsByInvoice[r.id] || 0 })));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO invoices (id, customer, branch, employee, date, delivery_date, items, status, paid_total, commission_percent, applied_offer_name, applied_discount, notes)
       VALUES ('INV-' || LPAD(nextval('invoices_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.customer, d.branch||'', d.employee||'', d.date || new Date().toISOString().split("T")[0], d.deliveryDate||'',
       JSON.stringify(d.items||[]), d.status||'مسودة', d.paidTotal||0, d.commissionPercent||0,
       d.appliedOfferName||'', d.appliedDiscount||0, d.notes||'']
    );
    // Decrement stock — skip agency items
    await applyStockDelta(d.items || [], -1);
    await recomputeInvoiceStatus(rows[0].id);
    res.json(await fetchInvoiceApi(rows[0].id));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows: prev } = await pool.query("SELECT * FROM invoices WHERE id=$1", [req.params.id]);
    if (!prev[0]) return res.status(404).json({ error: "الفاتورة غير موجودة" });
    const prevItems = prev[0].items || [];
    const prevStatus = prev[0].status;

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
    if (d.appliedOfferName !== undefined) { sets.push(`applied_offer_name=$${i++}`); vals.push(d.appliedOfferName); }
    if (d.appliedDiscount !== undefined) { sets.push(`applied_discount=$${i++}`); vals.push(d.appliedDiscount); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json(await fetchInvoiceApi(req.params.id));

    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);

    let query = `UPDATE invoices SET ${sets.join(",")} WHERE id=$${i}`;
    if (d._updatedAt) {
      vals.push(d._updatedAt);
      query += ` AND updated_at=$${i + 1}`;
    }
    query += " RETURNING *";

    const { rowCount } = await pool.query(query, vals);
    if (rowCount === 0) {
      const cur = await pool.query("SELECT * FROM invoices WHERE id=$1", [req.params.id]);
      if (cur.rowCount === 0) return res.status(404).json({ error: "الفاتورة غير موجودة" });
      return res.status(409).json({ error: "CONFLICT", message: "تم تعديل هذا السجل من جهاز آخر.", current: toApi(cur.rows[0]) });
    }

    // --- Real stock reconciliation when items changed ---
    if (d.items !== undefined) {
      await applyStockDelta(prevItems, +1);   // give back everything previously reserved
      await applyStockDelta(d.items, -1);     // take the new quantities
    }
    // --- Cancelling an invoice returns its stock; un-cancelling takes it again ---
    if (d.status !== undefined && d.status !== prevStatus) {
      const currentItems = d.items !== undefined ? d.items : prevItems;
      if (d.status === "ملغاة" && prevStatus !== "ملغاة") await applyStockDelta(currentItems, +1);
      if (prevStatus === "ملغاة" && d.status !== "ملغاة") await applyStockDelta(currentItems, -1);
    }

    // Only auto-recompute when status was NOT explicitly set in this request
    if (d.status === undefined) await recomputeInvoiceStatus(req.params.id);
    res.json(await fetchInvoiceApi(req.params.id));
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT items, status FROM invoices WHERE id=$1", [req.params.id]);
    if (rows[0] && rows[0].status !== "ملغاة") {
      // Give back only what is still held by the invoice (already-returned qty is back in stock)
      const returnedQty = new Map();
      try {
        const { rows: rr } = await pool.query("SELECT items FROM product_returns WHERE invoice_id=$1", [req.params.id]);
        for (const r of rr) for (const it of (r.items || [])) {
          returnedQty.set(it.productName, (returnedQty.get(it.productName) || 0) + (Number(it.qty) || 0));
        }
      } catch {}
      const net = (rows[0].items || []).map(it => {
        const back = returnedQty.get(it.productName) || 0;
        const take = Math.min(back, Number(it.qty) || 0);
        returnedQty.set(it.productName, back - take);
        return { ...it, qty: (Number(it.qty) || 0) - take };
      }).filter(it => it.qty > 0);
      await applyStockDelta(net, +1);
    }

    await pool.query("DELETE FROM receipts WHERE invoice_id=$1", [req.params.id]);
    await pool.query("DELETE FROM product_returns WHERE invoice_id=$1", [req.params.id]).catch(() => {});
    await pool.query("DELETE FROM customer_balance_adjustments WHERE invoice_id=$1", [req.params.id]).catch(() => {});
    await pool.query("DELETE FROM invoices WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});


module.exports = router;
module.exports.recomputeInvoiceStatus = recomputeInvoiceStatus;
