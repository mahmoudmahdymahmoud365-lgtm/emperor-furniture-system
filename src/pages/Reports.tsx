import { useRef, useState, useMemo } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Users, UserCog, Printer, Search, TrendingUp, Clock, DollarSign,
  Package, MapPin, Wallet, PieChart as PieChartIcon, FileBarChart,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { useInvoices, useCustomers, useEmployees, useReceipts, useCompanySettings, useBranches, useProducts, useExpenses } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";
import { EXPENSE_CATEGORY_LABELS } from "@/data/types";

const COLORS = ["hsl(170,60%,40%)", "hsl(210,70%,50%)", "hsl(30,90%,50%)", "hsl(340,70%,50%)", "hsl(90,50%,45%)", "hsl(260,60%,55%)", "hsl(50,80%,50%)", "hsl(0,70%,50%)"];

const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((sum, i) => sum + (i.qty * i.unitPrice - i.lineDiscount), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

const CustomTooltipStyle = {
  borderRadius: "12px",
  border: "none",
  fontFamily: "Cairo",
  fontSize: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  padding: "10px 14px",
};

export default function Reports() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { employees } = useEmployees();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const { branches } = useBranches();
  const { products } = useProducts();
  const { expenses } = useExpenses();
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState("2025-12-31");
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owing" | "paid">("all");
  const commPrintRef = useRef<HTMLDivElement>(null);

  const filteredInvoices = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);
  const filteredExpenses = expenses.filter(e => e.date >= dateFrom && e.date <= dateTo);

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

  // Commissions
  const empCommissions = employees.filter((e) => e.role === "مبيعات").map((e) => {
    const empInvoices = filteredInvoices.filter((inv) => inv.employee === e.name);
    const totalSales = empInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const commissionAmount = empInvoices.reduce((s, inv) => s + getInvoiceTotal(inv) * (inv.commissionPercent / 100), 0);
    return { name: e.name, monthlySalary: e.monthlySalary, totalSales, commissionAmount, totalDue: e.monthlySalary + commissionAmount };
  });

  // P&L with expenses
  const plData = useMemo(() => {
    const revenue = filteredInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const totalSalaries = employees.filter(e => e.active).reduce((s, e) => s + e.monthlySalary, 0);
    const totalRents = branches.filter(b => b.active).reduce((s, b) => s + b.rent, 0);
    const totalCommissions = filteredInvoices.reduce((s, inv) => s + getInvoiceTotal(inv) * (inv.commissionPercent / 100), 0);
    const totalRecordedExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalExpenses = totalSalaries + totalRents + totalCommissions + totalRecordedExpenses;
    return { revenue, totalSalaries, totalRents, totalCommissions, totalRecordedExpenses, totalExpenses, profit: revenue - totalExpenses };
  }, [filteredInvoices, employees, branches, filteredExpenses]);

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

  // Product profitability (from advanced)
  const productProfitability = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; qty: number; invoiceCount: number }>();
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const existing = map.get(item.productName) || { name: item.productName, revenue: 0, qty: 0, invoiceCount: 0 };
        existing.revenue += item.qty * item.unitPrice - item.lineDiscount;
        existing.qty += item.qty;
        existing.invoiceCount++;
        map.set(item.productName, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredInvoices]);

  // Branch profitability (from advanced)
  const branchProfitability = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; invoiceCount: number; collected: number; rent: number }>();
    branches.forEach(b => { map.set(b.name, { name: b.name, revenue: 0, invoiceCount: 0, collected: 0, rent: b.rent }); });
    filteredInvoices.forEach(inv => {
      const existing = map.get(inv.branch) || { name: inv.branch, revenue: 0, invoiceCount: 0, collected: 0, rent: 0 };
      existing.revenue += getInvoiceTotal(inv);
      existing.invoiceCount++;
      existing.collected += inv.paidTotal;
      map.set(inv.branch, existing);
    });
    return Array.from(map.values()).map(b => ({
      ...b, profit: b.revenue - b.rent,
      collectionRate: b.revenue > 0 ? Math.round((b.collected / b.revenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredInvoices, branches]);

  // Cash flow (from advanced)
  const cashFlow = useMemo(() => {
    const months = new Map<string, { month: string; income: number; expenses: number }>();
    receipts.forEach(r => {
      if (r.date < dateFrom || r.date > dateTo) return;
      const month = r.date.substring(0, 7);
      const existing = months.get(month) || { month, income: 0, expenses: 0 };
      existing.income += r.amount;
      months.set(month, existing);
    });
    const monthlySalaries = employees.filter(e => e.active).reduce((s, e) => s + e.monthlySalary, 0);
    const monthlyRents = branches.filter(b => b.active).reduce((s, b) => s + b.rent, 0);
    const monthlyExpenses = monthlySalaries + monthlyRents;
    filteredInvoices.forEach(inv => {
      const month = inv.date.substring(0, 7);
      const existing = months.get(month) || { month, income: 0, expenses: 0 };
      existing.expenses += getInvoiceTotal(inv) * (inv.commissionPercent / 100);
      months.set(month, existing);
    });
    // Add recorded expenses
    filteredExpenses.forEach(exp => {
      const month = exp.date.substring(0, 7);
      const existing = months.get(month) || { month, income: 0, expenses: 0 };
      existing.expenses += exp.amount;
      months.set(month, existing);
    });
    months.forEach((v) => { v.expenses += monthlyExpenses; });
    return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      monthLabel: new Date(m.month + "-01").toLocaleDateString("ar-EG", { month: "short", year: "numeric" }),
      net: m.income - m.expenses,
    }));
  }, [receipts, employees, branches, filteredInvoices, filteredExpenses, dateFrom, dateTo]);

  // Category breakdown (from advanced)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const product = products.find(p => p.name === item.productName);
        const cat = product?.category || "أخرى";
        map.set(cat, (map.get(cat) || 0) + item.qty * item.unitPrice - item.lineDiscount);
      });
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredInvoices, products]);

  // Expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const label = EXPENSE_CATEGORY_LABELS[e.category] || e.category;
      map.set(label, (map.get(label) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <FileBarChart className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">التقارير</h1>
            <p className="text-sm text-muted-foreground">جميع التقارير المالية والتحليلية في مكان واحد</p>
          </div>
        </div>

        <Tabs defaultValue="sales" dir="rtl">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1 p-1.5 bg-muted/50 rounded-xl">
            <TabsTrigger value="sales" className="gap-1.5 rounded-lg"><BarChart3 className="h-4 w-4" />المبيعات</TabsTrigger>
            <TabsTrigger value="balances" className="gap-1.5 rounded-lg"><Users className="h-4 w-4" />أرصدة العملاء</TabsTrigger>
            <TabsTrigger value="overdue" className="gap-1.5 rounded-lg"><Clock className="h-4 w-4" />المتأخرين</TabsTrigger>
            <TabsTrigger value="commissions" className="gap-1.5 rounded-lg"><UserCog className="h-4 w-4" />العمولات</TabsTrigger>
            <TabsTrigger value="pl" className="gap-1.5 rounded-lg"><TrendingUp className="h-4 w-4" />أرباح وخسائر</TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5 rounded-lg"><DollarSign className="h-4 w-4" />أداء الموظفين</TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 rounded-lg"><Package className="h-4 w-4" />ربحية المنتجات</TabsTrigger>
            <TabsTrigger value="branches" className="gap-1.5 rounded-lg"><MapPin className="h-4 w-4" />ربحية الفروع</TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-1.5 rounded-lg"><Wallet className="h-4 w-4" />التدفق النقدي</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 rounded-lg"><PieChartIcon className="h-4 w-4" />تحليل الفئات</TabsTrigger>
          </TabsList>

          {/* Sales */}
          <TabsContent value="sales">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">تقرير المبيعات</h3>
                  <ExportButtons data={filteredInvoices.map(inv => ({ id: inv.id, customer: inv.customer, date: inv.date, total: getInvoiceTotal(inv), paidTotal: inv.paidTotal }))} headers={[{ key: "id", label: "الفاتورة" }, { key: "customer", label: "العميل" }, { key: "date", label: "التاريخ" }, { key: "total", label: "الإجمالي" }, { key: "paidTotal", label: "المدفوع" }]} fileName="تقرير_المبيعات" title="تقرير المبيعات" />
                </div>
                <DateFilters />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفاتورة</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">العميل</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">التاريخ</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الإجمالي</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المدفوع</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredInvoices.map(inv => (<tr key={inv.id} className="hover:bg-muted/30 transition-colors"><td className="p-3 font-semibold text-primary">{inv.id}</td><td className="p-3">{inv.customer}</td><td className="p-3 text-muted-foreground text-xs">{inv.date}</td><td className="p-3 font-medium">{getInvoiceTotal(inv).toLocaleString()} ج.م</td><td className="p-3">{inv.paidTotal.toLocaleString()} ج.م</td></tr>))}
                    {filteredInvoices.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد فواتير في هذه الفترة</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Balances */}
          <TabsContent value="balances">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">أرصدة العملاء</h3>
                  <ExportButtons data={filteredBalances as any} headers={[{ key: "name", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "totalInvoices", label: "إجمالي الفواتير" }, { key: "totalPaid", label: "المدفوع" }, { key: "balance", label: "المتبقي" }]} fileName="أرصدة_العملاء" title="أرصدة العملاء" />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-3">
                  <div className="relative max-w-sm flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="بحث..." value={balanceSearch} onChange={(e) => setBalanceSearch(e.target.value)} className="pr-10" /></div>
                  <select className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm" value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value as any)}>
                    <option value="all">الكل</option><option value="owing">عليه متبقي</option><option value="paid">مسدد</option>
                  </select>
                </div>
                {totalOwing > 0 && (<div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-xl text-sm">إجمالي المديونيات: <span className="font-bold text-destructive">{totalOwing.toLocaleString()} ج.م</span></div>)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">العميل</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الهاتف</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفواتير</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المدفوع</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المتبقي</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredBalances.map(c => (<tr key={c.name} className="hover:bg-muted/30 transition-colors"><td className="p-3">{c.name}</td><td className="p-3" dir="ltr">{c.phone}</td><td className="p-3">{c.totalInvoices.toLocaleString()} ج.م</td><td className="p-3 text-success">{c.totalPaid.toLocaleString()} ج.م</td><td className={`p-3 font-semibold ${c.balance > 0 ? "text-destructive" : "text-success"}`}>{c.balance.toLocaleString()} ج.م</td></tr>))}
                    {filteredBalances.length === 0 && (<tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد نتائج</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Overdue */}
          <TabsContent value="overdue">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">العملاء المتأخرين (أكثر من 30 يوم)</h3>
                  <ExportButtons data={overdueCustomers.map(c => ({ ...c, invoiceIds: c.invoiceIds.join(", "), lastPayment: c.lastPayment || "لم يدفع", daysSince: c.daysSince === 999 ? "لم يدفع" : `${c.daysSince} يوم` })) as any} headers={[{ key: "name", label: "العميل" }, { key: "phone", label: "الهاتف" }, { key: "invoiceIds", label: "الفواتير" }, { key: "lastPayment", label: "آخر دفعة" }, { key: "daysSince", label: "المدة" }, { key: "balance", label: "المستحق" }]} fileName="المتأخرين" title="العملاء المتأخرين" />
                </div>
              </div>
              <div className="overflow-x-auto">
                {overdueCustomers.length === 0 ? (<div className="p-10 text-center text-muted-foreground">لا يوجد عملاء متأخرين 🎉</div>) : (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">العميل</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الهاتف</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفواتير</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">آخر دفعة</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المدة</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المستحق</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {overdueCustomers.map(c => (<tr key={c.name} className="hover:bg-muted/30 transition-colors"><td className="p-3 font-medium">{c.name}</td><td className="p-3" dir="ltr">{c.phone || "-"}</td><td className="p-3 text-xs">{c.invoiceIds.join(", ")}</td><td className="p-3">{c.lastPayment || "لم يدفع"}</td><td className="p-3 text-warning font-medium">{c.daysSince === 999 ? "لم يدفع أبداً" : `${c.daysSince} يوم`}</td><td className="p-3 text-destructive font-bold">{c.balance.toLocaleString()} ج.م</td></tr>))}
                      <tr className="bg-muted/30 font-bold"><td colSpan={5} className="p-3">الإجمالي</td><td className="p-3 text-destructive">{overdueCustomers.reduce((s, c) => s + c.balance, 0).toLocaleString()} ج.م</td></tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Commissions */}
          <TabsContent value="commissions">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">العمولات والمرتبات</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={handlePrintCommissions}><Printer className="h-4 w-4" />طباعة</Button>
                    <ExportButtons data={empCommissions as any} headers={[{ key: "name", label: "الموظف" }, { key: "monthlySalary", label: "المرتب" }, { key: "totalSales", label: "المبيعات" }, { key: "commissionAmount", label: "العمولات" }, { key: "totalDue", label: "المستحق" }]} fileName="تقرير_العمولات" title="العمولات" />
                  </div>
                </div>
                <DateFilters />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الموظف</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المرتب</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المبيعات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">العمولات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المستحق</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {empCommissions.map(c => (<tr key={c.name} className="hover:bg-muted/30 transition-colors"><td className="p-3">{c.name}</td><td className="p-3">{c.monthlySalary.toLocaleString()} ج.م</td><td className="p-3">{c.totalSales.toLocaleString()} ج.م</td><td className="p-3 font-semibold text-accent">{c.commissionAmount.toLocaleString()} ج.م</td><td className="p-3 font-bold text-primary">{c.totalDue.toLocaleString()} ج.م</td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* P&L */}
          <TabsContent value="pl">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">تقرير الأرباح والخسائر</h3>
                  <ExportButtons data={[plData]} headers={[{ key: "revenue", label: "الإيرادات" }, { key: "totalSalaries", label: "الرواتب" }, { key: "totalRents", label: "الإيجارات" }, { key: "totalCommissions", label: "العمولات" }, { key: "totalRecordedExpenses", label: "مصروفات مسجلة" }, { key: "totalExpenses", label: "المصروفات" }, { key: "profit", label: "صافي الربح" }]} fileName="الأرباح_والخسائر" title="أرباح وخسائر" />
                </div>
                <DateFilters />
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-success/15 to-success/5 border border-success/20 text-center">
                    <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-success">{plData.revenue.toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-destructive/15 to-destructive/5 border border-destructive/20 text-center">
                    <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
                    <p className="text-2xl font-bold text-destructive">{plData.totalExpenses.toLocaleString()} ج.م</p>
                  </div>
                  <div className={`p-4 rounded-2xl border text-center ${plData.profit >= 0 ? "bg-gradient-to-br from-success/15 to-success/5 border-success/20" : "bg-gradient-to-br from-destructive/15 to-destructive/5 border-destructive/20"}`}>
                    <p className="text-sm text-muted-foreground">صافي الربح</p>
                    <p className={`text-2xl font-bold ${plData.profit >= 0 ? "text-success" : "text-destructive"}`}>{plData.profit.toLocaleString()} ج.م</p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">البند</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المبلغ</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="p-3 text-success font-medium">إيرادات المبيعات</td><td className="p-3 text-success font-bold">{plData.revenue.toLocaleString()} ج.م</td></tr>
                      <tr className="bg-muted/20"><td className="p-3 font-semibold" colSpan={2}>المصروفات</td></tr>
                      <tr><td className="p-3 pr-8">رواتب الموظفين (شهري)</td><td className="p-3 text-destructive">{plData.totalSalaries.toLocaleString()} ج.م</td></tr>
                      <tr><td className="p-3 pr-8">إيجارات الفروع (شهري)</td><td className="p-3 text-destructive">{plData.totalRents.toLocaleString()} ج.م</td></tr>
                      <tr><td className="p-3 pr-8">عمولات المبيعات</td><td className="p-3 text-destructive">{plData.totalCommissions.toLocaleString()} ج.م</td></tr>
                      <tr><td className="p-3 pr-8">مصروفات مسجلة (فواتير وخدمات)</td><td className="p-3 text-destructive">{plData.totalRecordedExpenses.toLocaleString()} ج.م</td></tr>
                      <tr className="bg-muted/30"><td className="p-3 font-bold">إجمالي المصروفات</td><td className="p-3 font-bold text-destructive">{plData.totalExpenses.toLocaleString()} ج.م</td></tr>
                      <tr className="font-bold text-lg"><td className="p-3">صافي الربح / الخسارة</td><td className={`p-3 ${plData.profit >= 0 ? "text-success" : "text-destructive"}`}>{plData.profit.toLocaleString()} ج.م</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Expense breakdown chart */}
                {expenseBreakdown.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-foreground mb-3">توزيع المصروفات المسجلة</h4>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="h-[220px] w-full md:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                              {expenseBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2">
                        {expenseBreakdown.map((c, i) => (
                          <div key={c.name} className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-muted-foreground flex-1">{c.name}</span>
                            <span className="font-bold">{c.value.toLocaleString()} ج.م</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Employee Performance */}
          <TabsContent value="performance">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">أداء الموظفين</h3>
                  <ExportButtons data={empPerformance as any} headers={[{ key: "name", label: "الموظف" }, { key: "branch", label: "الفرع" }, { key: "invoiceCount", label: "الفواتير" }, { key: "totalSales", label: "المبيعات" }, { key: "avgInvoice", label: "المتوسط" }, { key: "commission", label: "العمولة" }]} fileName="أداء_الموظفين" title="أداء الموظفين" />
                </div>
                <DateFilters />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">#</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الموظف</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفرع</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الدور</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفواتير</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المبيعات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المتوسط</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">العمولة</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {empPerformance.map((e, i) => (
                      <tr key={e.name} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3"><span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? "bg-warning text-warning-foreground" : i === 1 ? "bg-muted text-muted-foreground" : "text-muted-foreground"}`}>{i + 1}</span></td>
                        <td className="p-3 font-medium">{e.name}</td>
                        <td className="p-3">{e.branch}</td>
                        <td className="p-3 text-xs">{e.role}</td>
                        <td className="p-3">{e.invoiceCount}</td>
                        <td className="p-3 font-semibold text-primary">{e.totalSales.toLocaleString()} ج.م</td>
                        <td className="p-3">{Math.round(e.avgInvoice).toLocaleString()} ج.م</td>
                        <td className="p-3 font-semibold text-accent">{Math.round(e.commission).toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                    {empPerformance.length === 0 && (<tr><td colSpan={8} className="p-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Product Profitability */}
          <TabsContent value="products">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">ربحية المنتجات</h3>
                  <ExportButtons data={productProfitability as any} headers={[{ key: "name", label: "المنتج" }, { key: "revenue", label: "الإيرادات" }, { key: "qty", label: "الكمية المباعة" }, { key: "invoiceCount", label: "عدد الفواتير" }]} fileName="ربحية_المنتجات" title="ربحية المنتجات" />
                </div>
                <DateFilters />
              </div>
              <div className="p-5">
                {productProfitability.length > 0 && (
                  <div className="h-[300px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productProfitability.slice(0, 10)} layout="vertical">
                        <defs>
                          <linearGradient id="prodGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="hsl(172, 66%, 26%)" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="hsl(172, 66%, 36%)" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" strokeOpacity={0.5} />
                        <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                        <Bar dataKey="revenue" fill="url(#prodGrad)" radius={[0, 8, 8, 0]} name="الإيرادات" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">#</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المنتج</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الإيرادات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الكمية</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفواتير</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {productProfitability.map((p, i) => (
                        <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3 font-bold text-primary">{p.revenue.toLocaleString()} ج.م</td>
                          <td className="p-3">{p.qty}</td>
                          <td className="p-3">{p.invoiceCount}</td>
                        </tr>
                      ))}
                      {productProfitability.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Branch Profitability */}
          <TabsContent value="branches">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-foreground">ربحية الفروع</h3>
                  <ExportButtons data={branchProfitability as any} headers={[{ key: "name", label: "الفرع" }, { key: "revenue", label: "الإيرادات" }, { key: "rent", label: "الإيجار" }, { key: "profit", label: "الربح" }, { key: "collectionRate", label: "نسبة التحصيل %" }]} fileName="ربحية_الفروع" title="ربحية الفروع" />
                </div>
                <DateFilters />
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {branchProfitability.map((b) => (
                    <div key={b.name} className={`p-4 rounded-2xl border text-center transition-all hover:shadow-md ${b.profit >= 0 ? "bg-gradient-to-br from-success/10 to-success/5 border-success/20" : "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20"}`}>
                      <p className="text-sm text-muted-foreground">{b.name}</p>
                      <p className={`text-xl font-bold mt-1 ${b.profit >= 0 ? "text-success" : "text-destructive"}`}>{b.profit.toLocaleString()} ج.م</p>
                      <p className="text-xs text-muted-foreground mt-1">تحصيل {b.collectionRate}% • {b.invoiceCount} فاتورة</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفرع</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الإيرادات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المحصل</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الإيجار</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الربح</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">التحصيل</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {branchProfitability.map(b => (
                        <tr key={b.name} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{b.name}</td>
                          <td className="p-3">{b.revenue.toLocaleString()} ج.م</td>
                          <td className="p-3 text-success">{b.collected.toLocaleString()} ج.م</td>
                          <td className="p-3 text-destructive">{b.rent.toLocaleString()} ج.م</td>
                          <td className={`p-3 font-bold ${b.profit >= 0 ? "text-success" : "text-destructive"}`}>{b.profit.toLocaleString()} ج.م</td>
                          <td className="p-3">{b.collectionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cashflow">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <h3 className="font-bold text-foreground">التدفق النقدي الشهري</h3>
                <DateFilters />
              </div>
              <div className="p-5">
                {cashFlow.length > 0 ? (
                  <>
                    <div className="h-[350px] mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlow}>
                          <defs>
                            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(170,60%,40%)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="hsl(170,60%,40%)" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(0,70%,50%)" stopOpacity={0.2} />
                              <stop offset="100%" stopColor="hsl(0,70%,50%)" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" strokeOpacity={0.5} />
                          <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                          <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: "12px" }} />
                          <Area type="monotone" dataKey="income" name="الدخل" stroke="hsl(170,60%,40%)" strokeWidth={2} fill="url(#incomeGrad)" />
                          <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="hsl(0,70%,50%)" strokeWidth={2} fill="url(#expGrad)" />
                          <Area type="monotone" dataKey="net" name="الصافي" stroke="hsl(210,70%,50%)" fill="transparent" strokeDasharray="5 5" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الشهر</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الدخل</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">المصروفات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الصافي</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {cashFlow.map(m => (
                            <tr key={m.month} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 font-medium">{m.monthLabel}</td>
                              <td className="p-3 text-success">{m.income.toLocaleString()} ج.م</td>
                              <td className="p-3 text-destructive">{m.expenses.toLocaleString()} ج.م</td>
                              <td className={`p-3 font-bold ${m.net >= 0 ? "text-success" : "text-destructive"}`}>{m.net.toLocaleString()} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="p-10 text-center text-muted-foreground">لا توجد بيانات للفترة المحددة</div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Category Analysis */}
          <TabsContent value="categories">
            <div className="section-card">
              <div className="p-5 border-b border-border">
                <h3 className="font-bold text-foreground">تحليل المبيعات بالفئة</h3>
                <DateFilters />
              </div>
              <div className="p-5">
                {categoryBreakdown.length > 0 ? (
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="h-[300px] w-full md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} strokeWidth={0}>
                            {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full">
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-muted/50"><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفئة</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">الإيرادات</th><th className="text-right p-3 font-semibold text-muted-foreground text-xs">النسبة</th></tr></thead>
                          <tbody className="divide-y divide-border">
                            {categoryBreakdown.map((c, i) => {
                              const total = categoryBreakdown.reduce((s, x) => s + x.value, 0);
                              return (
                                <tr key={c.name} className="hover:bg-muted/30 transition-colors">
                                  <td className="p-3 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-md inline-block shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    {c.name}
                                  </td>
                                  <td className="p-3 font-bold">{c.value.toLocaleString()} ج.م</td>
                                  <td className="p-3">{total > 0 ? ((c.value / total) * 100).toFixed(1) : 0}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center text-muted-foreground">لا توجد بيانات</div>
                )}
              </div>
            </div>
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
