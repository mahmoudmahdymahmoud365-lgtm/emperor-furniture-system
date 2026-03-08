import { useRef, useState, useMemo } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, UserCog, Printer, Search, TrendingUp, Clock, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoices, useCustomers, useEmployees, useReceipts, useCompanySettings, useBranches } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((sum, i) => sum + (i.qty * i.unitPrice - i.lineDiscount), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

export default function Reports() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { employees } = useEmployees();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const { branches } = useBranches();
  const [dateFrom, setDateFrom] = useState("2025-06-01");
  const [dateTo, setDateTo] = useState("2025-06-30");
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owing" | "paid">("all");
  const commPrintRef = useRef<HTMLDivElement>(null);

  const filteredInvoices = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);

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

  const empCommissions = employees.filter((e) => e.role === "مبيعات").map((e) => {
    const empInvoices = filteredInvoices.filter((inv) => inv.employee === e.name);
    const totalSales = empInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const commissionAmount = empInvoices.reduce((s, inv) => s + getInvoiceTotal(inv) * (inv.commissionPercent / 100), 0);
    return { name: e.name, monthlySalary: e.monthlySalary, totalSales, commissionAmount, totalDue: e.monthlySalary + commissionAmount };
  });

  // P&L
  const plData = useMemo(() => {
    const revenue = filteredInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const totalSalaries = employees.filter(e => e.active).reduce((s, e) => s + e.monthlySalary, 0);
    const totalRents = branches.filter(b => b.active).reduce((s, b) => s + b.rent, 0);
    const totalCommissions = filteredInvoices.reduce((s, inv) => s + getInvoiceTotal(inv) * (inv.commissionPercent / 100), 0);
    const totalExpenses = totalSalaries + totalRents + totalCommissions;
    return { revenue, totalSalaries, totalRents, totalCommissions, totalExpenses, profit: revenue - totalExpenses };
  }, [filteredInvoices, employees, branches]);

  // Employee performance
  const empPerformance = useMemo(() => {
    return employees.filter(e => e.active).map(e => {
      const empInvoices = filteredInvoices.filter(inv => inv.employee === e.name);
      const totalSales = empInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
      const commission = empInvoices.reduce((s, inv) => s + getInvoiceTotal(inv) * (inv.commissionPercent / 100), 0);
      const avgInvoice = empInvoices.length > 0 ? totalSales / empInvoices.length : 0;
      return { name: e.name, branch: e.branch, role: e.role, invoiceCount: empInvoices.length, totalSales, avgInvoice, commission };
    }).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredInvoices, employees]);

  // Overdue customers
  const overdueCustomers = useMemo(() => {
    const now = new Date();
    const customerLastPay = new Map<string, string>();
    receipts.forEach(r => { const e = customerLastPay.get(r.customer); if (!e || r.date > e) customerLastPay.set(r.customer, r.date); });
    const results: { name: string; phone: string; balance: number; lastPayment: string | null; daysSince: number; invoiceIds: string[] }[] = [];
    const customerMap = new Map<string, { balance: number; invoiceIds: string[]; phone: string }>();
    invoices.forEach(inv => {
      const remaining = getInvoiceTotal(inv) - inv.paidTotal;
      if (remaining > 0) {
        const existing = customerMap.get(inv.customer);
        const cust = customers.find(c => c.fullName === inv.customer);
        customerMap.set(inv.customer, { balance: (existing?.balance || 0) + remaining, invoiceIds: [...(existing?.invoiceIds || []), inv.id], phone: cust?.phone || existing?.phone || "" });
      }
    });
    customerMap.forEach((data, name) => {
      const lastPay = customerLastPay.get(name);
      const daysSince = lastPay ? Math.floor((now.getTime() - new Date(lastPay).getTime()) / 86400000) : 999;
      if (daysSince >= 30) results.push({ name, phone: data.phone, balance: data.balance, lastPayment: lastPay || null, daysSince, invoiceIds: data.invoiceIds });
    });
    return results.sort((a, b) => b.balance - a.balance);
  }, [invoices, customers, receipts]);

  const handlePrintCommissions = () => {
    const content = commPrintRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><title>تقرير العمولات</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',sans-serif;padding:30px;color:#1a1a1a}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:10px 14px;border:1px solid #ddd;text-align:right;font-size:13px}th{background:#0d5c63;color:#fff;font-weight:600}h1{color:#0d5c63;font-size:22px;margin-bottom:4px}.subtitle{color:#666;font-size:13px;margin-bottom:16px}.total-row td{font-weight:800;background:#e8f5e9!important}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${content.innerHTML}</body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const totalCommDue = empCommissions.reduce((s, e) => s + e.totalDue, 0);
  const totalOwing = filteredBalances.reduce((s, c) => s + Math.max(0, c.balance), 0);

  const DateFilters = () => (
    <div className="flex gap-4 mt-2">
      <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} dir="ltr" className="w-40" /></div>
      <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} dir="ltr" className="w-40" /></div>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-header">التقارير</h1>
        <Tabs defaultValue="sales" dir="rtl">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
            <TabsTrigger value="sales" className="gap-1.5"><BarChart3 className="h-4 w-4" />المبيعات</TabsTrigger>
            <TabsTrigger value="balances" className="gap-1.5"><Users className="h-4 w-4" />أرصدة العملاء</TabsTrigger>
            <TabsTrigger value="overdue" className="gap-1.5"><Clock className="h-4 w-4" />المتأخرين</TabsTrigger>
            <TabsTrigger value="commissions" className="gap-1.5"><UserCog className="h-4 w-4" />العمولات</TabsTrigger>
            <TabsTrigger value="pl" className="gap-1.5"><TrendingUp className="h-4 w-4" />أرباح وخسائر</TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5"><DollarSign className="h-4 w-4" />أداء الموظفين</TabsTrigger>
          </TabsList>

          {/* Sales */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">تقرير المبيعات</CardTitle>
                  <ExportButtons data={filteredInvoices.map(inv => ({ id: inv.id, customer: inv.customer, date: inv.date, total: getInvoiceTotal(inv), paidTotal: inv.paidTotal }))} headers={[{ key: "id", label: "الفاتورة" }, { key: "customer", label: "العميل" }, { key: "date", label: "التاريخ" }, { key: "total", label: "الإجمالي" }, { key: "paidTotal", label: "المدفوع" }]} fileName="تقرير_المبيعات" title="تقرير المبيعات" />
                </div>
                <DateFilters />
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">الفاتورة</th><th className="text-right p-3 font-medium text-muted-foreground">العميل</th><th className="text-right p-3 font-medium text-muted-foreground">التاريخ</th><th className="text-right p-3 font-medium text-muted-foreground">الإجمالي</th><th className="text-right p-3 font-medium text-muted-foreground">المدفوع</th></tr></thead>
                  <tbody>
                    {filteredInvoices.map(inv => (<tr key={inv.id} className="border-b last:border-0"><td className="p-3 font-medium text-primary">{inv.id}</td><td className="p-3">{inv.customer}</td><td className="p-3">{inv.date}</td><td className="p-3">{getInvoiceTotal(inv).toLocaleString()} ج.م</td><td className="p-3">{inv.paidTotal.toLocaleString()} ج.م</td></tr>))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balances */}
          <TabsContent value="balances">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">أرصدة العملاء</CardTitle>
                  <ExportButtons data={filteredBalances as any} headers={[{ key: "name", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "totalInvoices", label: "إجمالي الفواتير" }, { key: "totalPaid", label: "المدفوع" }, { key: "balance", label: "المتبقي" }]} fileName="أرصدة_العملاء" title="أرصدة العملاء" />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-3">
                  <div className="relative max-w-sm flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="بحث..." value={balanceSearch} onChange={(e) => setBalanceSearch(e.target.value)} className="pr-10" /></div>
                  <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value as any)}>
                    <option value="all">الكل</option><option value="owing">عليه متبقي</option><option value="paid">مسدد</option>
                  </select>
                </div>
                {totalOwing > 0 && (<div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm">إجمالي المديونيات: <span className="font-bold text-destructive">{totalOwing.toLocaleString()} ج.م</span></div>)}
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">العميل</th><th className="text-right p-3 font-medium text-muted-foreground">الهاتف</th><th className="text-right p-3 font-medium text-muted-foreground">الفواتير</th><th className="text-right p-3 font-medium text-muted-foreground">المدفوع</th><th className="text-right p-3 font-medium text-muted-foreground">المتبقي</th></tr></thead>
                  <tbody>
                    {filteredBalances.map(c => (<tr key={c.name} className="border-b last:border-0"><td className="p-3">{c.name}</td><td className="p-3" dir="ltr">{c.phone}</td><td className="p-3">{c.totalInvoices.toLocaleString()} ج.م</td><td className="p-3 text-success">{c.totalPaid.toLocaleString()} ج.م</td><td className={`p-3 font-medium ${c.balance > 0 ? "text-destructive" : "text-success"}`}>{c.balance.toLocaleString()} ج.م</td></tr>))}
                    {filteredBalances.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>)}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overdue */}
          <TabsContent value="overdue">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">العملاء المتأخرين (أكثر من 30 يوم)</CardTitle>
                  <ExportButtons data={overdueCustomers.map(c => ({ ...c, invoiceIds: c.invoiceIds.join(", "), lastPayment: c.lastPayment || "لم يدفع", daysSince: c.daysSince === 999 ? "لم يدفع" : `${c.daysSince} يوم` })) as any} headers={[{ key: "name", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "invoiceIds", label: "الفواتير" }, { key: "lastPayment", label: "آخر دفعة" }, { key: "daysSince", label: "المدة" }, { key: "balance", label: "المستحق" }]} fileName="المتأخرين" title="العملاء المتأخرين" />
                </div>
              </CardHeader>
              <CardContent>
                {overdueCustomers.length === 0 ? (<div className="p-8 text-center text-muted-foreground">لا يوجد عملاء متأخرين 🎉</div>) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">العميل</th><th className="text-right p-3 font-medium text-muted-foreground">الهاتف</th><th className="text-right p-3 font-medium text-muted-foreground">الفواتير</th><th className="text-right p-3 font-medium text-muted-foreground">آخر دفعة</th><th className="text-right p-3 font-medium text-muted-foreground">المدة</th><th className="text-right p-3 font-medium text-muted-foreground">المستحق</th></tr></thead>
                    <tbody>
                      {overdueCustomers.map(c => (<tr key={c.name} className="border-b last:border-0"><td className="p-3 font-medium">{c.name}</td><td className="p-3" dir="ltr">{c.phone || "-"}</td><td className="p-3 text-xs">{c.invoiceIds.join(", ")}</td><td className="p-3">{c.lastPayment || "لم يدفع"}</td><td className="p-3 text-warning font-medium">{c.daysSince === 999 ? "لم يدفع أبداً" : `${c.daysSince} يوم`}</td><td className="p-3 text-destructive font-bold">{c.balance.toLocaleString()} ج.م</td></tr>))}
                      <tr className="bg-muted/30 font-bold"><td colSpan={5} className="p-3">الإجمالي</td><td className="p-3 text-destructive">{overdueCustomers.reduce((s, c) => s + c.balance, 0).toLocaleString()} ج.م</td></tr>
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions */}
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">العمولات والمرتبات</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrintCommissions}><Printer className="h-4 w-4 ml-1" />طباعة</Button>
                    <ExportButtons data={empCommissions as any} headers={[{ key: "name", label: "الموظف" }, { key: "monthlySalary", label: "المرتب" }, { key: "totalSales", label: "المبيعات" }, { key: "commissionAmount", label: "العمولات" }, { key: "totalDue", label: "المستحق" }]} fileName="تقرير_العمولات" title="العمولات" />
                  </div>
                </div>
                <DateFilters />
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">الموظف</th><th className="text-right p-3 font-medium text-muted-foreground">المرتب</th><th className="text-right p-3 font-medium text-muted-foreground">المبيعات</th><th className="text-right p-3 font-medium text-muted-foreground">العمولات</th><th className="text-right p-3 font-medium text-muted-foreground">المستحق</th></tr></thead>
                  <tbody>
                    {empCommissions.map(c => (<tr key={c.name} className="border-b last:border-0"><td className="p-3">{c.name}</td><td className="p-3">{c.monthlySalary.toLocaleString()} ج.م</td><td className="p-3">{c.totalSales.toLocaleString()} ج.م</td><td className="p-3 font-semibold" style={{ color: "hsl(30, 90%, 50%)" }}>{c.commissionAmount.toLocaleString()} ج.م</td><td className="p-3 font-bold text-primary">{c.totalDue.toLocaleString()} ج.م</td></tr>))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* P&L */}
          <TabsContent value="pl">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">تقرير الأرباح والخسائر</CardTitle>
                  <ExportButtons data={[plData]} headers={[{ key: "revenue", label: "الإيرادات" }, { key: "totalSalaries", label: "الرواتب" }, { key: "totalRents", label: "الإيجارات" }, { key: "totalCommissions", label: "العمولات" }, { key: "totalExpenses", label: "المصروفات" }, { key: "profit", label: "صافي الربح" }]} fileName="الأرباح_والخسائر" title="أرباح وخسائر" />
                </div>
                <DateFilters />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
                    <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-success">{plData.revenue.toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                    <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
                    <p className="text-2xl font-bold text-destructive">{plData.totalExpenses.toLocaleString()} ج.م</p>
                  </div>
                  <div className={`p-4 rounded-lg border text-center ${plData.profit >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"}`}>
                    <p className="text-sm text-muted-foreground">صافي الربح</p>
                    <p className={`text-2xl font-bold ${plData.profit >= 0 ? "text-success" : "text-destructive"}`}>{plData.profit.toLocaleString()} ج.م</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">البند</th><th className="text-right p-3 font-medium text-muted-foreground">المبلغ</th></tr></thead>
                  <tbody>
                    <tr className="border-b"><td className="p-3 text-success font-medium">إيرادات المبيعات</td><td className="p-3 text-success font-bold">{plData.revenue.toLocaleString()} ج.م</td></tr>
                    <tr className="border-b bg-muted/20"><td className="p-3 font-semibold" colSpan={2}>المصروفات</td></tr>
                    <tr className="border-b"><td className="p-3 pr-8">رواتب الموظفين (شهري)</td><td className="p-3 text-destructive">{plData.totalSalaries.toLocaleString()} ج.م</td></tr>
                    <tr className="border-b"><td className="p-3 pr-8">إيجارات الفروع (شهري)</td><td className="p-3 text-destructive">{plData.totalRents.toLocaleString()} ج.م</td></tr>
                    <tr className="border-b"><td className="p-3 pr-8">عمولات المبيعات</td><td className="p-3 text-destructive">{plData.totalCommissions.toLocaleString()} ج.م</td></tr>
                    <tr className="border-b bg-muted/30"><td className="p-3 font-bold">إجمالي المصروفات</td><td className="p-3 font-bold text-destructive">{plData.totalExpenses.toLocaleString()} ج.م</td></tr>
                    <tr className="font-bold text-lg"><td className="p-3">صافي الربح / الخسارة</td><td className={`p-3 ${plData.profit >= 0 ? "text-success" : "text-destructive"}`}>{plData.profit.toLocaleString()} ج.م</td></tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Performance */}
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">أداء الموظفين</CardTitle>
                  <ExportButtons data={empPerformance as any} headers={[{ key: "name", label: "الموظف" }, { key: "branch", label: "الفرع" }, { key: "invoiceCount", label: "الفواتير" }, { key: "totalSales", label: "المبيعات" }, { key: "avgInvoice", label: "المتوسط" }, { key: "commission", label: "العمولة" }]} fileName="أداء_الموظفين" title="أداء الموظفين" />
                </div>
                <DateFilters />
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">#</th><th className="text-right p-3 font-medium text-muted-foreground">الموظف</th><th className="text-right p-3 font-medium text-muted-foreground">الفرع</th><th className="text-right p-3 font-medium text-muted-foreground">الدور</th><th className="text-right p-3 font-medium text-muted-foreground">الفواتير</th><th className="text-right p-3 font-medium text-muted-foreground">المبيعات</th><th className="text-right p-3 font-medium text-muted-foreground">المتوسط</th><th className="text-right p-3 font-medium text-muted-foreground">العمولة</th></tr></thead>
                  <tbody>
                    {empPerformance.map((e, i) => (
                      <tr key={e.name} className="border-b last:border-0">
                        <td className="p-3"><span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? "bg-warning text-warning-foreground" : i === 1 ? "bg-muted text-muted-foreground" : "text-muted-foreground"}`}>{i + 1}</span></td>
                        <td className="p-3 font-medium">{e.name}</td>
                        <td className="p-3">{e.branch}</td>
                        <td className="p-3 text-xs">{e.role}</td>
                        <td className="p-3">{e.invoiceCount}</td>
                        <td className="p-3 font-semibold text-primary">{e.totalSales.toLocaleString()} ج.م</td>
                        <td className="p-3">{Math.round(e.avgInvoice).toLocaleString()} ج.م</td>
                        <td className="p-3 font-semibold" style={{ color: "hsl(30, 90%, 50%)" }}>{Math.round(e.commission).toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                    {empPerformance.length === 0 && (<tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>)}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden">
        <div ref={commPrintRef}>
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: "40px", margin: "0 auto 8px" }} />}
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#0d5c63" }}>{settings.name}</p>
          </div>
          <h1>تقرير العمولات والمرتبات</h1>
          <p className="subtitle">الفترة من {dateFrom} إلى {dateTo}</p>
          <table>
            <thead><tr><th>الموظف</th><th>المرتب</th><th>المبيعات</th><th>العمولات</th><th>المستحق</th></tr></thead>
            <tbody>
              {empCommissions.map(c => (<tr key={c.name}><td>{c.name}</td><td>{c.monthlySalary.toLocaleString()} ج.م</td><td>{c.totalSales.toLocaleString()} ج.م</td><td>{c.commissionAmount.toLocaleString()} ج.م</td><td style={{ fontWeight: 700 }}>{c.totalDue.toLocaleString()} ج.م</td></tr>))}
              <tr className="total-row"><td colSpan={4} style={{ fontWeight: 800 }}>الإجمالي</td><td style={{ fontWeight: 800 }}>{totalCommDue.toLocaleString()} ج.م</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 30, textAlign: "center", color: "#999", fontSize: 11, borderTop: "1px solid #ddd", paddingTop: 12 }}>تقرير صادر بتاريخ {new Date().toLocaleDateString("ar-EG")} — {settings.name}</div>
        </div>
      </div>
    </AppLayout>
  );
}
