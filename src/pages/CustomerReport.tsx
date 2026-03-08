import { useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";
import { useCustomers, useInvoices, useReceipts, useCompanySettings } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const calcLineTotal = (item: InvoiceItem) => item.qty * item.unitPrice - item.lineDiscount;
const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((sum, i) => sum + calcLineTotal(i), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

export default function CustomerReport() {
  const { customerId } = useParams<{ customerId: string }>();
  const { customers } = useCustomers();
  const { invoices } = useInvoices();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const printRef = useRef<HTMLDivElement>(null);

  const customer = customers.find((c) => c.id === customerId);
  if (!customer) {
    return (
      <AppLayout>
        <div className="text-center p-8 text-muted-foreground">العميل غير موجود</div>
      </AppLayout>
    );
  }

  const custInvoices = invoices.filter((inv) => inv.customer === customer.fullName);
  const custReceipts = receipts.filter((r) => r.customer === customer.fullName);
  const totalInvoices = custInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
  const totalPaid = custReceipts.reduce((s, r) => s + r.amount, 0);
  const remaining = totalInvoices - totalPaid;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
        <head>
          <title>تقرير العميل - ${customer.fullName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1a1a1a; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: right; font-size: 13px; }
            th { background: #0d5c63; color: #fff; font-weight: 600; }
            tr:nth-child(even) { background: #f8f9fa; }
            h1 { color: #0d5c63; font-size: 24px; margin-bottom: 8px; }
            h2 { color: #0d5c63; font-size: 16px; margin: 24px 0 8px; border-bottom: 2px solid #0d5c63; padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
            .info-item { font-size: 14px; }
            .info-label { color: #888; }
            .summary { display: flex; gap: 24px; margin: 16px 0; }
            .summary-item { background: #f8f9fa; padding: 12px 20px; border-radius: 8px; text-align: center; }
            .summary-value { font-size: 20px; font-weight: 800; color: #0d5c63; }
            .summary-label { font-size: 12px; color: #666; }
            .text-danger { color: #dc3545; }
            .text-success { color: #28a745; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/customers"><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link>
            <h1 className="page-header mb-0">تقرير العميل: {customer.fullName}</h1>
          </div>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 ml-2" />طباعة التقرير</Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
            <p className="text-2xl font-bold text-primary">{totalInvoices.toLocaleString()} ج.م</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">إجمالي المدفوع</p>
            <p className="text-2xl font-bold text-success">{totalPaid.toLocaleString()} ج.م</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">المتبقي</p>
            <p className="text-2xl font-bold text-destructive">{remaining.toLocaleString()} ج.م</p>
          </CardContent></Card>
        </div>

        {/* Invoices Detail */}
        <Card>
          <CardHeader><CardTitle className="text-base">الفواتير والمنتجات</CardTitle></CardHeader>
          <CardContent>
            {custInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا توجد فواتير</p>
            ) : (
              <div className="space-y-6">
                {custInvoices.map((inv) => {
                  const invTotal = getInvoiceTotal(inv);
                   const invReceipts = receipts.filter((r) => r.invoiceId === inv.id);
                   const invPaid = invReceipts.reduce((s, r) => s + r.amount, 0);
                  return (
                    <div key={inv.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-primary">{inv.id}</span>
                          <span className="text-sm text-muted-foreground">{inv.date}</span>
                          <span className="text-sm">الفرع: {inv.branch}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>الإجمالي: <strong>{invTotal.toLocaleString()} ج.م</strong></span>
                          <span className="text-success">المدفوع: {invPaid.toLocaleString()} ج.م</span>
                          <span className="text-destructive">المتبقي: {(invTotal - invPaid).toLocaleString()} ج.م</span>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/30">
                          <th className="text-right p-2 font-medium text-muted-foreground">المنتج</th>
                          <th className="text-right p-2 font-medium text-muted-foreground">الكمية</th>
                          <th className="text-right p-2 font-medium text-muted-foreground">سعر الوحدة</th>
                          <th className="text-right p-2 font-medium text-muted-foreground">الخصم</th>
                          <th className="text-right p-2 font-medium text-muted-foreground">الإجمالي</th>
                        </tr></thead>
                        <tbody>
                          {inv.items.map((item, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2 font-medium">{item.productName}</td>
                              <td className="p-2">{item.qty}</td>
                              <td className="p-2">{item.unitPrice.toLocaleString()} ج.م</td>
                              <td className="p-2">{item.lineDiscount.toLocaleString()} ج.م</td>
                              <td className="p-2 font-bold">{calcLineTotal(item).toLocaleString()} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Installments */}
        <Card>
          <CardHeader><CardTitle className="text-base">سجل الأقساط المدفوعة</CardTitle></CardHeader>
          <CardContent>
            {custReceipts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا توجد أقساط</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">المبلغ</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">طريقة الدفع</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">ملاحظات</th>
                </tr></thead>
                <tbody>
                  {custReceipts.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3 font-medium text-primary">{r.id}</td>
                      <td className="p-3">{r.invoiceId}</td>
                      <td className="p-3 font-bold">{r.amount.toLocaleString()} ج.م</td>
                      <td className="p-3">{r.date}</td>
                      <td className="p-3">{r.method}</td>
                      <td className="p-3">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: "40px", margin: "0 auto 8px" }} />}
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#0d5c63" }}>{settings.name}</p>
          </div>
          <h1>تقرير العميل: {customer.fullName}</h1>
          <div className="info-grid">
            <div className="info-item"><span className="info-label">الهاتف: </span>{customer.phone}</div>
            <div className="info-item"><span className="info-label">المحافظة: </span>{customer.governorate}</div>
            <div className="info-item"><span className="info-label">العنوان: </span>{customer.address}</div>
            <div className="info-item"><span className="info-label">الوظيفة: </span>{customer.jobTitle}</div>
          </div>

          <div className="summary">
            <div className="summary-item"><div className="summary-label">إجمالي الفواتير</div><div className="summary-value">{totalInvoices.toLocaleString()} ج.م</div></div>
            <div className="summary-item"><div className="summary-label">المدفوع</div><div className="summary-value text-success">{totalPaid.toLocaleString()} ج.م</div></div>
            <div className="summary-item"><div className="summary-label">المتبقي</div><div className="summary-value text-danger">{remaining.toLocaleString()} ج.م</div></div>
          </div>

          <h2>الفواتير والمنتجات</h2>
          {custInvoices.map((inv) => {
            const invTotal = getInvoiceTotal(inv);
            const invReceipts = receipts.filter((r) => r.invoiceId === inv.id);
            const invPaid = invReceipts.reduce((s, r) => s + r.amount, 0);
            return (
              <div key={inv.id} style={{ marginBottom: "20px" }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{inv.id} — التاريخ: {inv.date} — الفرع: {inv.branch} — الإجمالي: {getInvoiceTotal(inv).toLocaleString()} ج.م — المدفوع: {invPaid.toLocaleString()} ج.م — المتبقي: {(getInvoiceTotal(inv) - invPaid).toLocaleString()} ج.م</p>
                <table>
                  <thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الخصم</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {inv.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.productName}</td><td>{item.qty}</td><td>{item.unitPrice.toLocaleString()} ج.م</td>
                        <td>{item.lineDiscount.toLocaleString()} ج.م</td><td>{calcLineTotal(item).toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <h2>سجل الأقساط</h2>
          <table>
            <thead><tr><th>الكود</th><th>رقم الفاتورة</th><th>المبلغ</th><th>التاريخ</th><th>طريقة الدفع</th><th>ملاحظات</th></tr></thead>
            <tbody>
              {custReceipts.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.invoiceId}</td><td>{r.amount.toLocaleString()} ج.م</td>
                  <td>{r.date}</td><td>{r.method}</td><td>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 30, textAlign: "center", color: "#999", fontSize: 11, borderTop: "1px solid #ddd", paddingTop: 12 }}>
            تقرير صادر بتاريخ {new Date().toLocaleDateString("ar-EG")} — {settings.name}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
