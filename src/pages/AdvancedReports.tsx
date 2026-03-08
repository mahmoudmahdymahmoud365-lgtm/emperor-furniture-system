import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButtons } from "@/components/ExportButtons";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { TrendingUp, Package, MapPin, Wallet } from "lucide-react";
import { useInvoices, useProducts, useReceipts, useBranches, useEmployees } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const COLORS = ["hsl(170,60%,40%)", "hsl(210,70%,50%)", "hsl(30,90%,50%)", "hsl(340,70%,50%)", "hsl(90,50%,45%)", "hsl(260,60%,55%)", "hsl(50,80%,50%)", "hsl(0,70%,50%)"];

const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((s, i) => s + (i.qty * i.unitPrice - i.lineDiscount), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

export default function AdvancedReports() {
  const { invoices } = useInvoices();
  const { products } = useProducts();
  const { receipts } = useReceipts();
  const { branches } = useBranches();
  const { employees } = useEmployees();
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState("2025-12-31");

  const filteredInvoices = invoices.filter(inv => inv.date >= dateFrom && inv.date <= dateTo);

  // Profitability per product
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

  // Profitability per branch
  const branchProfitability = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; invoiceCount: number; collected: number; rent: number }>();
    branches.forEach(b => {
      map.set(b.name, { name: b.name, revenue: 0, invoiceCount: 0, collected: 0, rent: b.rent });
    });
    filteredInvoices.forEach(inv => {
      const existing = map.get(inv.branch) || { name: inv.branch, revenue: 0, invoiceCount: 0, collected: 0, rent: 0 };
      existing.revenue += getInvoiceTotal(inv);
      existing.invoiceCount++;
      existing.collected += inv.paidTotal;
      map.set(inv.branch, existing);
    });
    return Array.from(map.values()).map(b => ({
      ...b,
      profit: b.revenue - b.rent,
      collectionRate: b.revenue > 0 ? Math.round((b.collected / b.revenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredInvoices, branches]);

  // Cash flow (monthly)
  const cashFlow = useMemo(() => {
    const months = new Map<string, { month: string; income: number; expenses: number }>();
    
    // Income from receipts
    receipts.forEach(r => {
      if (r.date < dateFrom || r.date > dateTo) return;
      const month = r.date.substring(0, 7);
      const existing = months.get(month) || { month, income: 0, expenses: 0 };
      existing.income += r.amount;
      months.set(month, existing);
    });

    // Expenses (salaries + rents - monthly estimate)
    const monthlySalaries = employees.filter(e => e.active).reduce((s, e) => s + e.monthlySalary, 0);
    const monthlyRents = branches.filter(b => b.active).reduce((s, b) => s + b.rent, 0);
    const monthlyExpenses = monthlySalaries + monthlyRents;

    // Add commissions per month
    filteredInvoices.forEach(inv => {
      const month = inv.date.substring(0, 7);
      const existing = months.get(month) || { month, income: 0, expenses: 0 };
      existing.expenses += getInvoiceTotal(inv) * (inv.commissionPercent / 100);
      months.set(month, existing);
    });

    // Add fixed expenses to each month
    months.forEach((v, k) => {
      v.expenses += monthlyExpenses;
    });

    return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      monthLabel: new Date(m.month + "-01").toLocaleDateString("ar-EG", { month: "short", year: "numeric" }),
      net: m.income - m.expenses,
    }));
  }, [receipts, employees, branches, filteredInvoices, dateFrom, dateTo]);

  // Category breakdown
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

  const DateFilters = () => (
    <div className="flex gap-4 mt-2">
      <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} dir="ltr" className="w-40" /></div>
      <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} dir="ltr" className="w-40" /></div>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-header">التقارير المتقدمة</h1>
        <Tabs defaultValue="products" dir="rtl">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
            <TabsTrigger value="products" className="gap-1.5"><Package className="h-4 w-4" />ربحية المنتجات</TabsTrigger>
            <TabsTrigger value="branches" className="gap-1.5"><MapPin className="h-4 w-4" />ربحية الفروع</TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-1.5"><Wallet className="h-4 w-4" />التدفق النقدي</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5"><TrendingUp className="h-4 w-4" />تحليل الفئات</TabsTrigger>
          </TabsList>

          {/* Product Profitability */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">ربحية المنتجات</CardTitle>
                  <ExportButtons data={productProfitability as any} headers={[{ key: "name", label: "المنتج" }, { key: "revenue", label: "الإيرادات" }, { key: "qty", label: "الكمية المباعة" }, { key: "invoiceCount", label: "عدد الفواتير" }]} fileName="ربحية_المنتجات" title="ربحية المنتجات" />
                </div>
                <DateFilters />
              </CardHeader>
              <CardContent>
                {productProfitability.length > 0 && (
                  <div className="h-[300px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productProfitability.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                        <Bar dataKey="revenue" fill="hsl(170,60%,40%)" radius={[0, 4, 4, 0]} name="الإيرادات" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">#</th><th className="text-right p-3 font-medium text-muted-foreground">المنتج</th><th className="text-right p-3 font-medium text-muted-foreground">الإيرادات</th><th className="text-right p-3 font-medium text-muted-foreground">الكمية</th><th className="text-right p-3 font-medium text-muted-foreground">الفواتير</th></tr></thead>
                  <tbody>
                    {productProfitability.map((p, i) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="p-3 font-medium text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 font-bold text-primary">{p.revenue.toLocaleString()} ج.م</td>
                        <td className="p-3">{p.qty}</td>
                        <td className="p-3">{p.invoiceCount}</td>
                      </tr>
                    ))}
                    {productProfitability.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branch Profitability */}
          <TabsContent value="branches">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">ربحية الفروع</CardTitle>
                  <ExportButtons data={branchProfitability as any} headers={[{ key: "name", label: "الفرع" }, { key: "revenue", label: "الإيرادات" }, { key: "rent", label: "الإيجار" }, { key: "profit", label: "الربح" }, { key: "collectionRate", label: "نسبة التحصيل %" }]} fileName="ربحية_الفروع" title="ربحية الفروع" />
                </div>
                <DateFilters />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {branchProfitability.map((b, i) => (
                    <div key={b.name} className={`p-4 rounded-lg border text-center ${b.profit >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                      <p className="text-sm text-muted-foreground">{b.name}</p>
                      <p className={`text-xl font-bold mt-1 ${b.profit >= 0 ? "text-success" : "text-destructive"}`}>{b.profit.toLocaleString()} ج.م</p>
                      <p className="text-xs text-muted-foreground mt-1">تحصيل {b.collectionRate}% • {b.invoiceCount} فاتورة</p>
                    </div>
                  ))}
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">الفرع</th><th className="text-right p-3 font-medium text-muted-foreground">الإيرادات</th><th className="text-right p-3 font-medium text-muted-foreground">المحصل</th><th className="text-right p-3 font-medium text-muted-foreground">الإيجار</th><th className="text-right p-3 font-medium text-muted-foreground">الربح</th><th className="text-right p-3 font-medium text-muted-foreground">التحصيل</th></tr></thead>
                  <tbody>
                    {branchProfitability.map(b => (
                      <tr key={b.name} className="border-b last:border-0">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cashflow">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">التدفق النقدي الشهري</CardTitle>
                <DateFilters />
              </CardHeader>
              <CardContent>
                {cashFlow.length > 0 ? (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashFlow}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                        <Legend />
                        <Area type="monotone" dataKey="income" name="الدخل" stroke="hsl(170,60%,40%)" fill="hsl(170,60%,40%)" fillOpacity={0.2} />
                        <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="hsl(0,70%,50%)" fill="hsl(0,70%,50%)" fillOpacity={0.2} />
                        <Area type="monotone" dataKey="net" name="الصافي" stroke="hsl(210,70%,50%)" fill="hsl(210,70%,50%)" fillOpacity={0.1} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">لا توجد بيانات للفترة المحددة</div>
                )}
                {cashFlow.length > 0 && (
                  <table className="w-full text-sm mt-6">
                    <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">الشهر</th><th className="text-right p-3 font-medium text-muted-foreground">الدخل</th><th className="text-right p-3 font-medium text-muted-foreground">المصروفات</th><th className="text-right p-3 font-medium text-muted-foreground">الصافي</th></tr></thead>
                    <tbody>
                      {cashFlow.map(m => (
                        <tr key={m.month} className="border-b last:border-0">
                          <td className="p-3 font-medium">{m.monthLabel}</td>
                          <td className="p-3 text-success">{m.income.toLocaleString()} ج.م</td>
                          <td className="p-3 text-destructive">{m.expenses.toLocaleString()} ج.م</td>
                          <td className={`p-3 font-bold ${m.net >= 0 ? "text-success" : "text-destructive"}`}>{m.net.toLocaleString()} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Analysis */}
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">تحليل المبيعات بالفئة</CardTitle>
                <DateFilters />
              </CardHeader>
              <CardContent>
                {categoryBreakdown.length > 0 ? (
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="h-[300px] w-full md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                            {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/50"><th className="text-right p-3 font-medium text-muted-foreground">الفئة</th><th className="text-right p-3 font-medium text-muted-foreground">الإيرادات</th><th className="text-right p-3 font-medium text-muted-foreground">النسبة</th></tr></thead>
                        <tbody>
                          {categoryBreakdown.map((c, i) => {
                            const total = categoryBreakdown.reduce((s, x) => s + x.value, 0);
                            return (
                              <tr key={c.name} className="border-b last:border-0">
                                <td className="p-3 flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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
                ) : (
                  <div className="p-8 text-center text-muted-foreground">لا توجد بيانات</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
