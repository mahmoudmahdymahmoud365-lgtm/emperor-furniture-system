import { useRef, useState, useMemo } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, UserCog, Printer, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoices, useCustomers, useEmployees, useReceipts, useCompanySettings } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((sum, i) => sum + (i.qty * i.unitPrice - i.lineDiscount), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

export default function Reports() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { employees } = useEmployees();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const [dateFrom, setDateFrom] = useState("2025-06-01");
  const [dateTo, setDateTo] = useState("2025-06-30");
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owing" | "paid">("all");
  const commPrintRef = useRef<HTMLDivElement>(null);

  const filteredInvoices = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);

  // Customer balances
  const customerBalances = useMemo(() => {
    return customers.map((c) => {
      const custInvoices = invoices.filter((inv) => inv.customer === c.fullName);
      const totalInvoices = custInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
      const totalPaid = receipts.filter((r) => r.customer === c.fullName).reduce((s, r) => s + r.amount, 0);
      return { name: c.fullName, phone: c.phone, governorate: c.governorate, totalInvoices, totalPaid, balance: totalInvoices - totalPaid };
    });
  }, [customers, invoices, receipts]);

  const filteredBalances = useMemo(() => {
    return customerBalances.filter(c => {
      const matchSearch = !balanceSearch || c.name.includes(balanceSearch) || c.phone.includes(balanceSearch);
      const matchFilter = balanceFilter === "all" || (balanceFilter === "owing" && c.balance > 0) || (balanceFilter === "paid" && c.balance <= 0);
      return matchSearch && matchFilter;
    });
  }, [customerBalances, balanceSearch, balanceFilter]);

  // Commission data
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
      <html dir="rtl"><head><title>تقرير العمولات والمرتبات</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1a1a1a; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; } th, td { padding: 10px 14px; border: 1px solid #ddd; text-align: right; font-size: 13px; }
      th { background: #0d5c63; color: #fff; font-weight: 600; } tr:nth-child(even) { background: #f8f9fa; }
      h1 { color: #0d5c63; font-size: 22px; margin-bottom: 4px; } .subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
      .total-row td { font-weight: 800; background: #e8f5e9 !important; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }</style></head>
      <body>${content.innerHTML}</body></html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const totalCommDue = empCommissions.reduce((s, e) => s + e.totalDue, 0);
  const totalOwing = filteredBalances.reduce((s, c) => s + Math.max(0, c.balance), 0);

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
                    fileName="تقرير_المبيعات" title="تقرير المبيعات"
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
                    data={filteredBalances as any}
                    headers={[{ key: "name", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "totalInvoices", label: "إجمالي الفواتير" }, { key: "totalPaid", label: "المدفوع" }, { key: "balance", label: "المتبقي" }]}
                    fileName="أرصدة_العملاء" title="أرصدة العملاء"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-3">
                  <div className="relative max-w-sm flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="بحث بالاسم أو الهاتف..." value={balanceSearch} onChange={(e) => setBalanceSearch(e.target.value)} className="pr-10" />
                  </div>
                  <select
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={balanceFilter}
                    onChange={(e) => setBalanceFilter(e.target.value as any)}
                  >
                    <option value="all">الكل</option>
                    <option value="owing">عليه مبالغ متبقية</option>
                    <option value="paid">مسدد بالكامل</option>
                  </select>
                </div>
                {totalOwing > 0 && (
                  <div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm">
                    إجمالي المديونيات: <span className="font-bold text-destructive">{totalOwing.toLocaleString()} ج.م</span> — <span className="text-muted-foreground">{filteredBalances.filter(c => c.balance > 0).length} عميل</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الهاتف</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجمالي الفواتير</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المدفوع</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الرصيد المتبقي</th>
                  </tr></thead>
                  <tbody>
                    {filteredBalances.map((c) => (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="p-3">{c.name}</td>
                        <td className="p-3" dir="ltr">{c.phone}</td>
                        <td className="p-3">{c.totalInvoices.toLocaleString()} ج.م</td>
                        <td className="p-3 text-success">{c.totalPaid.toLocaleString()} ج.م</td>
                        <td className={`p-3 font-medium ${c.balance > 0 ? "text-destructive" : "text-success"}`}>{c.balance.toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                    {filteredBalances.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                    )}
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
                      headers={[{ key: "name", label: "الموظف" }, { key: "monthlySalary", label: "المرتب" }, { key: "totalSales", label: "المبيعات" }, { key: "commissionAmount", label: "العمولات" }, { key: "totalDue", label: "المستحق" }]}
                      fileName="تقرير_العمولات" title="تقرير العمولات والمرتبات"
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
                        <td className="p-3 font-semibold" style={{ color: "hsl(30, 90%, 50%)" }}>{c.commissionAmount.toLocaleString()} ج.م</td>
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
            <thead><tr><th>الموظف</th><th>المرتب الثابت</th><th>إجمالي المبيعات</th><th>إجمالي العمولات</th><th>المستحق الكلي</th></tr></thead>
            <tbody>
              {empCommissions.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td><td>{c.monthlySalary.toLocaleString()} ج.م</td><td>{c.totalSales.toLocaleString()} ج.م</td>
                  <td>{c.commissionAmount.toLocaleString()} ج.م</td><td style={{ fontWeight: 700 }}>{c.totalDue.toLocaleString()} ج.م</td>
                </tr>
              ))}
              <tr className="total-row"><td colSpan={4} style={{ fontWeight: 800 }}>الإجمالي المستحق</td><td style={{ fontWeight: 800 }}>{totalCommDue.toLocaleString()} ج.م</td></tr>
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
