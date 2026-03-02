import { forwardRef } from "react";
import type { CompanySettings } from "@/data/types";

interface InvoiceItem {
  productName: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
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
}

const calcLineTotal = (item: InvoiceItem) => item.qty * item.unitPrice - item.lineDiscount;
const calcTotal = (items: InvoiceItem[]) => items.reduce((sum, item) => sum + calcLineTotal(item), 0);

interface InvoicePrintProps {
  invoice: Invoice;
  settings: CompanySettings;
}

const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(({ invoice, settings }, ref) => {
  const total = calcTotal(invoice.items);
  const remaining = total - invoice.paidTotal;

  return (
    <div ref={ref} className="print-invoice" dir="rtl" style={{ fontFamily: "Cairo, sans-serif", padding: "40px", maxWidth: "800px", margin: "0 auto", color: "#1a1a1a" }}>
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
              <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: "600" }}>{item.productName}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px" }}>{item.qty}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px" }}>{item.unitPrice.toLocaleString()} ج.م</td>
              <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "13px" }}>{item.lineDiscount.toLocaleString()} ج.م</td>
              <td style={{ padding: "10px 12px", textAlign: "left", fontSize: "14px", fontWeight: "700" }}>{calcLineTotal(item).toLocaleString()} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div style={{ width: "280px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e9ecef" }}>
            <span style={{ fontSize: "14px", color: "#666" }}>الإجمالي</span>
            <span style={{ fontSize: "14px", fontWeight: "700" }}>{total.toLocaleString()} ج.م</span>
          </div>
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

      {/* Footer */}
      <div style={{ marginTop: "40px", paddingTop: "16px", borderTop: "2px solid #e9ecef", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>شكراً لتعاملكم معنا — {settings.name}</p>
        <p style={{ fontSize: "11px", color: "#bbb", margin: "4px 0 0" }}>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع</p>
      </div>
    </div>
  );
});

InvoicePrint.displayName = "InvoicePrint";
export default InvoicePrint;
