import { useRef } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, UserCog, Printer } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoices, useCustomers, useEmployees, useReceipts, useCompanySettings } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const calcTotal = (items: InvoiceItem[]) => items.reduce((sum, i) => sum + (i.qty * i.unitPrice - i.lineDiscount), 0);

export default function Reports() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { employees } = useEmployees();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const [dateFrom, setDateFrom] = useState("2025-06-01");
  const [dateTo, setDateTo] = useState("2025-06-30");
  const commPrintRef = useRef<HTMLDivElement>(null);

  const filteredInvoices = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);

  // Customer balances using receipts (actual payments)
  const customerBalances = customers.map((c) => {
    const custInvoices = invoices.filter((inv) => inv.customer === c.fullName);
    const totalInvoices = custInvoices.reduce((s, inv) => s + calcTotal(inv.items), 0);
    const totalPaid = receipts.filter((r) => r.customer === c.fullName).reduce((s, r) => s + r.amount, 0);
    return { name: c.fullName, totalInvoices, totalPaid, balance: totalInvoices - totalPaid };
  });

  // Commission data - filtered by date
  const filteredForComm = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);
  const empCommissions = employees
    .filter((e) => e.role === "مبيعات")
    .map((e) => {
      const empInvoices = filteredForComm.filter((inv) => inv.employee === e.name);
      const totalSales = empInvoices.reduce((s, inv) => s + calcTotal(inv.items), 0);
      const commissionAmount = empInvoices.reduce((s, inv) => s + calcTotal(inv.items) * (inv.commissionPercent / 100), 0);
      return { name: e.name, monthlySalary: e.monthlySalary, totalSales, commissionAmount, totalDue: e.monthlySalary + commissionAmount };
    });

  const handlePrintCommissions = () => {
    const content = commPrintRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
        <head>
          <title>تقرير العمولات والمرتبات</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1a1a1a; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 10px 14px; border: 1px solid #ddd; text-align: right; font-size: 13px; }
            th { background: #0d5c63; color: #fff; font-weight: 600; }
            tr:nth-child(even) { background: #f8f9fa; }
            h1 { color: #0d5c63; font-size: 22px; margin-bottom: 4px; }
            .subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
            .total-row td { font-weight: 800; background: #e8f5e9 !important; }
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

  const totalCommDue = empCommissions.reduce((s, e) => s + e.totalDue, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-header">التقارير</h1>

        <Tabs defaultValue="sales" dir="rtl">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="sales" className="gap-2"><BarChart3 className="h-4 w-4" />المبيعات</TabsTrigger>
            <TabsTrigger value="balances" className="gap-2"><Users className="h-4 w-4" />أرصدة العملاء</TabsTrigger>
            <TabsTrigger value="commissions" className="gap-2"><UserCog className="h-4 w-4" />العمولات</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">تقرير المبيعات</CardTitle>
                  <ExportButtons
                    data={filteredInvoices.map((inv) => ({ id: inv.id, customer: inv.customer, date: inv.date, total: calcTotal(inv.items), paidTotal: inv.paidTotal }))}
                    headers={[{ key: "id", label: "الفاتورة" }, { key: "customer", label: "العميل" }, { key: "date", label: "التاريخ" }, { key: "total", label: "الإجمالي" }, { key: "paidTotal", label: "المدفوع" }]}
                    fileName="تقرير_المبيعات"
                    title="تقرير المبيعات"
                  />
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} dir="ltr" className="w-40" /></div>
                  <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} dir="ltr" className="w-40" /></div>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الفاتورة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">التاريخ</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الإجمالي</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المدفوع</th>
                  </tr></thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="p-3 font-medium text-primary">{inv.id}</td>
                        <td className="p-3">{inv.customer}</td>
                        <td className="p-3">{inv.date}</td>
                        <td className="p-3">{calcTotal(inv.items).toLocaleString()} ج.م</td>
                        <td className="p-3">{inv.paidTotal.toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">أرصدة العملاء</CardTitle>
                  <ExportButtons
                    data={customerBalances as any}
                    headers={[{ key: "name", label: "العميل" }, { key: "totalInvoices", label: "إجمالي الفواتير" }, { key: "totalPaid", label: "المدفوع (أقساط)" }, { key: "balance", label: "الرصيد المتبقي" }]}
                    fileName="أرصدة_العملاء"
                    title="أرصدة العملاء"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجمالي الفواتير</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المدفوع (أقساط)</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الرصيد المتبقي</th>
                  </tr></thead>
                  <tbody>
                    {customerBalances.map((c) => (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="p-3">{c.name}</td>
                        <td className="p-3">{c.totalInvoices.toLocaleString()} ج.م</td>
                        <td className="p-3 text-success">{c.totalPaid.toLocaleString()} ج.م</td>
                        <td className="p-3 text-destructive font-medium">{c.balance.toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">تقرير العمولات والمرتبات</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrintCommissions}>
                      <Printer className="h-4 w-4 ml-1" />طباعة
                    </Button>
                    <ExportButtons
                      data={empCommissions as any}
                      headers={[{ key: "name", label: "الموظف" }, { key: "monthlySalary", label: "المرتب الثابت" }, { key: "totalSales", label: "إجمالي المبيعات" }, { key: "commissionAmount", label: "إجمالي العمولات" }, { key: "totalDue", label: "المستحق الكلي" }]}
                      fileName="تقرير_العمولات"
                      title="تقرير العمولات والمرتبات"
                    />
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} dir="ltr" className="w-40" /></div>
                  <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} dir="ltr" className="w-40" /></div>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الموظف</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المرتب الثابت</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجمالي المبيعات</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجمالي العمولات</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المستحق الكلي</th>
                  </tr></thead>
                  <tbody>
                    {empCommissions.map((c) => (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="p-3">{c.name}</td>
                        <td className="p-3">{c.monthlySalary.toLocaleString()} ج.م</td>
                        <td className="p-3">{c.totalSales.toLocaleString()} ج.م</td>
                        <td className="p-3 text-accent-foreground">{c.commissionAmount.toLocaleString()} ج.م</td>
                        <td className="p-3 font-bold text-primary">{c.totalDue.toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hidden print content for commissions */}
      <div className="hidden">
        <div ref={commPrintRef}>
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: "40px", margin: "0 auto 8px" }} />}
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#0d5c63" }}>{settings.name}</p>
          </div>
          <h1>تقرير العمولات والمرتبات</h1>
          <p className="subtitle">الفترة من {dateFrom} إلى {dateTo}</p>
          <table>
            <thead><tr>
              <th>الموظف</th><th>المرتب الثابت</th><th>إجمالي المبيعات</th><th>إجمالي العمولات</th><th>المستحق الكلي</th>
            </tr></thead>
            <tbody>
              {empCommissions.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.monthlySalary.toLocaleString()} ج.م</td>
                  <td>{c.totalSales.toLocaleString()} ج.م</td>
                  <td>{c.commissionAmount.toLocaleString()} ج.م</td>
                  <td style={{ fontWeight: 700 }}>{c.totalDue.toLocaleString()} ج.م</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={4} style={{ fontWeight: 800 }}>الإجمالي المستحق</td>
                <td style={{ fontWeight: 800 }}>{totalCommDue.toLocaleString()} ج.م</td>
              </tr>
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
