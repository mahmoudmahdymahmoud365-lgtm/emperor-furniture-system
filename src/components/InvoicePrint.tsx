import { forwardRef } from "react";
import type { CompanySettings } from "@/data/types";

interface InvoiceItem {
  productName: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  color?: string;
}

interface Invoice {
  id: string;
  customer: string;
  branch: string;
  employee: string;
  date: string;
  deliveryDate?: string;
  items: InvoiceItem[];
  status: string;
  paidTotal: number;
  commissionPercent: number;
  appliedOfferName?: string;
  appliedDiscount?: number;
  notes?: string;
}

const calcLineTotal = (item: InvoiceItem) => item.qty * item.unitPrice - item.lineDiscount;
const calcTotal = (items: InvoiceItem[]) => items.reduce((sum, item) => sum + calcLineTotal(item), 0);

interface InvoicePrintProps {
  invoice: Invoice;
  settings: CompanySettings;
  template?: "classic" | "modern" | "minimal";
}

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  const parts: string[] = [];
  const intPart = Math.floor(num);
  
  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands <= 10) parts.push(`${ones[thousands]} آلاف`);
    else parts.push(`${thousands} ألف`);
  }
  
  const rem = intPart % 1000;
  if (rem >= 100) parts.push(hundreds[Math.floor(rem / 100)]);
  const lastTwo = rem % 100;
  if (lastTwo >= 10 && lastTwo < 20) parts.push(teens[lastTwo - 10]);
  else {
    if (lastTwo % 10 > 0) parts.push(ones[lastTwo % 10]);
    if (lastTwo >= 20) parts.push(tens[Math.floor(lastTwo / 10)]);
  }

  return parts.join(" و") + " جنيهاً مصرياً";
}

const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(({ invoice, settings, template = "modern" }, ref) => {
  const subtotal = calcTotal(invoice.items);
  const discount = invoice.appliedDiscount || 0;
  const total = subtotal - discount;
  const remaining = total - invoice.paidTotal;
  const commission = total * (invoice.commissionPercent || 0) / 100;

  if (template === "minimal") {
    return (
      <div ref={ref} dir="rtl" style={{ fontFamily: "Cairo, sans-serif", padding: "20px", maxWidth: "400px", margin: "0 auto", color: "#1a1a1a", fontSize: "12px" }}>
        <div style={{ textAlign: "center", borderBottom: "2px dashed #333", paddingBottom: "12px", marginBottom: "12px" }}>
          {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: "30px", margin: "0 auto 4px" }} />}
          <p style={{ fontWeight: 800, fontSize: "14px" }}>{settings.name}</p>
          {settings.address && <p style={{ color: "#666", fontSize: "11px" }}>{settings.address}</p>}
          {settings.phone && <p style={{ color: "#666", fontSize: "11px" }}>هاتف: {settings.phone}</p>}
        </div>
        <div style={{ marginBottom: "8px" }}>
          <p><strong>فاتورة:</strong> {invoice.id} | <strong>التاريخ:</strong> {invoice.date}</p>
          <p><strong>العميل:</strong> {invoice.customer}</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
          <thead><tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "right", padding: "4px" }}>المنتج</th>
            <th style={{ textAlign: "center", padding: "4px" }}>الكمية</th>
            <th style={{ textAlign: "center", padding: "4px" }}>السعر</th>
            <th style={{ textAlign: "left", padding: "4px" }}>الإجمالي</th>
          </tr></thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px dashed #ccc" }}>
                <td style={{ padding: "3px 4px" }}>{item.productName}{item.color ? ` (${item.color})` : ""}</td>
                <td style={{ textAlign: "center", padding: "3px" }}>{item.qty}</td>
                <td style={{ textAlign: "center", padding: "3px" }}>{item.unitPrice.toLocaleString()}</td>
                <td style={{ textAlign: "left", padding: "3px" }}>{calcLineTotal(item).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderTop: "2px dashed #333", paddingTop: "8px" }}>
          {discount > 0 && <p>الخصم: {discount.toLocaleString()} ج.م</p>}
          <p style={{ fontSize: "14px", fontWeight: 800 }}>الإجمالي: {total.toLocaleString()} ج.م</p>
          <p>المدفوع: {invoice.paidTotal.toLocaleString()} ج.م</p>
          {remaining > 0 && <p style={{ fontWeight: 700 }}>المتبقي: {remaining.toLocaleString()} ج.م</p>}
        </div>
        {invoice.notes && (
          <div style={{ marginTop: "8px", padding: "6px", border: "1px dashed #999", fontSize: "11px" }}>
            <strong>ملاحظات:</strong> {invoice.notes}
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "10px", color: "#999" }}>
          شكراً لتعاملكم معنا
        </div>
      </div>
    );
  }

  if (template === "classic") {
    return (
      <div ref={ref} dir="rtl" style={{ fontFamily: "Cairo, sans-serif", padding: "40px", maxWidth: "800px", margin: "0 auto", color: "#1a1a1a", border: "3px double #0d5c63" }}>
        {/* Classic header with border */}
        <div style={{ textAlign: "center", borderBottom: "3px double #0d5c63", paddingBottom: "20px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: "60px", width: "60px", objectFit: "contain" }} />}
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0d5c63", margin: 0 }}>{settings.name}</h1>
              {settings.address && <p style={{ color: "#666", fontSize: "13px", margin: "2px 0 0" }}>{settings.address}</p>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", fontSize: "12px", color: "#888" }}>
            {settings.phone && <span>هاتف: {settings.phone}</span>}
            {settings.email && <span>بريد: {settings.email}</span>}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0d5c63", margin: "0 0 8px" }}>فاتورة مبيعات</h2>
            <p style={{ fontSize: "14px" }}>رقم الفاتورة: <strong>{invoice.id}</strong></p>
            <p style={{ fontSize: "14px" }}>التاريخ: <strong>{invoice.date}</strong></p>
            {invoice.deliveryDate && <p style={{ fontSize: "14px" }}>تاريخ التسليم: <strong>{invoice.deliveryDate}</strong></p>}
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "14px" }}>العميل: <strong>{invoice.customer}</strong></p>
            <p style={{ fontSize: "14px" }}>الفرع: <strong>{invoice.branch || "—"}</strong></p>
            <p style={{ fontSize: "14px" }}>الموظف: <strong>{invoice.employee || "—"}</strong></p>
            <p style={{ fontSize: "14px" }}>الحالة: <strong>{invoice.status}</strong></p>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px", border: "1px solid #ddd" }}>
          <thead>
            <tr style={{ background: "#0d5c63", color: "#fff" }}>
              <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>#</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>المنتج</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>الكمية</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>سعر الوحدة</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>الخصم</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #ddd", background: i % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                <td style={{ padding: "8px 12px" }}>{i + 1}</td>
                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{item.productName}{item.color ? ` — ${item.color}` : ""}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{item.qty}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{item.unitPrice.toLocaleString()} ج.م</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{item.lineDiscount.toLocaleString()} ج.م</td>
                <td style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>{calcLineTotal(item).toLocaleString()} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: "13px", color: "#666", maxWidth: "50%" }}>
            <p style={{ fontWeight: 600, marginBottom: "4px" }}>المبلغ بالحروف:</p>
            <p>{numberToArabicWords(total)}</p>
          </div>
          <div style={{ width: "280px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #ddd" }}>
              <span>المجموع</span><span style={{ fontWeight: 700 }}>{subtotal.toLocaleString()} ج.م</span>
            </div>
            {discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #ddd", color: "#856404" }}>
                <span>الخصم {invoice.appliedOfferName && `(${invoice.appliedOfferName})`}</span><span style={{ fontWeight: 700 }}>- {discount.toLocaleString()} ج.م</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #ddd", fontWeight: 700 }}>
              <span>الإجمالي</span><span>{total.toLocaleString()} ج.م</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #ddd", color: "#28a745" }}>
              <span>المدفوع</span><span style={{ fontWeight: 700 }}>{invoice.paidTotal.toLocaleString()} ج.م</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#0d5c63", color: "#fff", fontWeight: 700 }}>
              <span>المتبقي</span><span style={{ fontSize: "16px" }}>{remaining.toLocaleString()} ج.م</span>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: "20px", padding: "12px", border: "1px dashed #0d5c63", background: "#f8f9fa", fontSize: "13px" }}>
            <strong style={{ color: "#0d5c63" }}>ملاحظات:</strong> {invoice.notes}
          </div>
        )}
        </div>

        <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #333", width: "180px", paddingTop: "8px", fontSize: "12px" }}>توقيع العميل</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #333", width: "180px", paddingTop: "8px", fontSize: "12px" }}>توقيع المسؤول</div>
          </div>
        </div>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "11px", color: "#999", borderTop: "3px double #0d5c63", paddingTop: "12px" }}>
          شكراً لتعاملكم معنا — {settings.name} — هذه الفاتورة صادرة إلكترونياً
        </div>
      </div>
    );
  }

  // Modern template (default)
  return (
    <div ref={ref} dir="rtl" style={{ fontFamily: "Cairo, sans-serif", padding: "40px", maxWidth: "800px", margin: "0 auto", color: "#1a1a1a" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #0d5c63", paddingBottom: "20px", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: "50px", width: "50px", objectFit: "contain", borderRadius: "8px" }} />}
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0d5c63", margin: 0 }}>{settings.name}</h1>
            {settings.address && <p style={{ color: "#666", margin: "4px 0 0", fontSize: "14px" }}>{settings.address}</p>}
            <p style={{ color: "#888", margin: "2px 0 0", fontSize: "12px" }}>
              {settings.phone && `هاتف: ${settings.phone}`}{settings.phone && settings.email && " | "}{settings.email && `البريد: ${settings.email}`}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ background: "#0d5c63", color: "#fff", padding: "8px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "700" }}>فاتورة مبيعات</div>
          <p style={{ fontSize: "22px", fontWeight: "800", color: "#0d5c63", margin: "8px 0 0" }}>{invoice.id}</p>
        </div>
      </div>

      {/* Invoice Info Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
        <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", border: "1px solid #e9ecef" }}>
          <h3 style={{ fontSize: "13px", color: "#888", margin: "0 0 8px", fontWeight: "600" }}>بيانات العميل</h3>
          <p style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px" }}>{invoice.customer}</p>
          {invoice.branch && <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>الفرع: {invoice.branch}</p>}
        </div>
        <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", border: "1px solid #e9ecef" }}>
          <h3 style={{ fontSize: "13px", color: "#888", margin: "0 0 8px", fontWeight: "600" }}>بيانات الفاتورة</h3>
          <p style={{ fontSize: "14px", margin: "0 0 4px" }}>التاريخ: <strong>{invoice.date}</strong></p>
          {invoice.deliveryDate && <p style={{ fontSize: "14px", margin: "0 0 4px" }}>تاريخ التسليم: <strong>{invoice.deliveryDate}</strong></p>}
          <p style={{ fontSize: "14px", margin: "0 0 4px" }}>الموظف: <strong>{invoice.employee || "—"}</strong></p>
          <p style={{ fontSize: "14px", margin: 0 }}>الحالة: <strong>{invoice.status}</strong></p>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <thead>
          <tr style={{ background: "#0d5c63", color: "#fff" }}>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "13px", fontWeight: "600" }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "13px", fontWeight: "600" }}>المنتج</th>
            <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px", fontWeight: "600" }}>الكمية</th>
            <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px", fontWeight: "600" }}>سعر الوحدة</th>
            <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px", fontWeight: "600" }}>الخصم</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "13px", fontWeight: "600" }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e9ecef", background: i % 2 === 0 ? "#fff" : "#f8f9fa" }}>
              <td style={{ padding: "10px 12px", fontSize: "13px" }}>{i + 1}</td>
              <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: "600" }}>{item.productName}{item.color ? ` — ${item.color}` : ""}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px" }}>{item.qty}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px" }}>{item.unitPrice.toLocaleString()} ج.م</td>
              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px" }}>{item.lineDiscount.toLocaleString()} ج.م</td>
              <td style={{ padding: "10px 12px", textAlign: "left", fontSize: "14px", fontWeight: "700" }}>{calcLineTotal(item).toLocaleString()} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "13px", color: "#666", maxWidth: "50%" }}>
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>المبلغ بالحروف:</p>
          <p>{numberToArabicWords(total)}</p>
        </div>
        <div style={{ width: "300px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e9ecef" }}>
            <span style={{ fontSize: "14px", color: "#666" }}>المجموع</span>
            <span style={{ fontSize: "14px", fontWeight: "700" }}>{subtotal.toLocaleString()} ج.م</span>
          </div>
          {invoice.appliedOfferName && discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e9ecef", background: "#fff3cd" }}>
              <span style={{ fontSize: "14px", color: "#856404" }}>خصم ({invoice.appliedOfferName})</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#856404" }}>- {discount.toLocaleString()} ج.م</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e9ecef" }}>
            <span style={{ fontSize: "14px", color: "#666" }}>الإجمالي بعد الخصم</span>
            <span style={{ fontSize: "14px", fontWeight: "700" }}>{total.toLocaleString()} ج.م</span>
          </div>
          {commission > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e9ecef" }}>
              <span style={{ fontSize: "14px", color: "#666" }}>العمولة ({invoice.commissionPercent}%)</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#0d5c63" }}>{commission.toLocaleString()} ج.م</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e9ecef" }}>
            <span style={{ fontSize: "14px", color: "#666" }}>المدفوع</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#28a745" }}>{invoice.paidTotal.toLocaleString()} ج.م</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#0d5c63" }}>
            <span style={{ fontSize: "15px", color: "#fff", fontWeight: "600" }}>المتبقي</span>
            <span style={{ fontSize: "18px", fontWeight: "800", color: "#fff" }}>{remaining.toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div style={{ marginTop: "20px", padding: "14px 16px", borderRadius: "8px", border: "1px solid #e9ecef", background: "#fffbe6", fontSize: "13px" }}>
          <strong style={{ color: "#0d5c63" }}>ملاحظات: </strong>{invoice.notes}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "40px", paddingTop: "16px", borderTop: "2px solid #e9ecef", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>شكراً لتعاملكم معنا — {settings.name}</p>
          <p style={{ fontSize: "11px", color: "#bbb", margin: "4px 0 0" }}>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #333", width: "150px", paddingTop: "8px", fontSize: "11px", color: "#666" }}>التوقيع</div>
        </div>
      </div>
    </div>
  );
});

InvoicePrint.displayName = "InvoicePrint";
export default InvoicePrint;
