import { useState, useMemo, useRef } from "react";
import {
  TrendingUp, Users, FileText, DollarSign, AlertTriangle, Printer, Phone,
  CalendarDays, BarChart3, ArrowUpRight, ArrowDownRight, Package, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInvoices, useCustomers, useReceipts, useCompanySettings, useProducts } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const calcItemsTotal = (items: InvoiceItem[]) =>
  items.reduce((s, i) => s + (i.qty * i.unitPrice - i.lineDiscount), 0);

const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) =>
  calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

const COLORS = [
  "hsl(172, 66%, 26%)", "hsl(38, 92%, 50%)", "hsl(205, 79%, 52%)",
  "hsl(142, 71%, 35%)", "hsl(0, 72%, 51%)",
];

const statusColors: Record<string, string> = {
  "مسودة": "bg-muted text-muted-foreground",
  "مؤكدة": "bg-info/10 text-info",
  "تم التسليم": "bg-success/10 text-success",
  "مغلقة": "bg-muted text-muted-foreground",
};

function formatDate(d: Date) {
  return d.toISOString().substring(0, 10);
}

function getDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

type SalesPeriod = "daily" | "weekly" | "monthly" | "yearly";

export default function Dashboard() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("monthly");
  const dashboardRef = useRef<HTMLDivElement>(null);

  const totalSales = invoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
  const totalPaid = invoices.reduce((s, inv) => s + inv.paidTotal, 0);
  const totalPending = totalSales - totalPaid;
  const collectionRate = totalSales > 0 ? Math.round((totalPaid / totalSales) * 100) : 0;

  const now = new Date();
  const today = formatDate(now);
  const todaySales = invoices
    .filter((inv) => inv.date === today)
    .reduce((s, inv) => s + getInvoiceTotal(inv), 0);
  const todayInvoices = invoices.filter((inv) => inv.date === today).length;

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = formatDate(weekAgo);
  const weeklySales = invoices
    .filter((inv) => inv.date >= weekAgoStr)
    .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

  const salesChartData = useMemo(() => {
    if (salesPeriod === "daily") {
      const dayMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap.set(formatDate(d), 0);
      }
      invoices.forEach((inv) => {
        if (dayMap.has(inv.date)) {
          dayMap.set(inv.date, (dayMap.get(inv.date) || 0) + getInvoiceTotal(inv));
        }
      });
      return Array.from(dayMap.entries()).map(([date, sales]) => ({
        label: getDayLabel(date),
        sales,
      }));
    }
    if (salesPeriod === "weekly") {
      const weeks: { label: string; start: Date; end: Date; sales: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        weeks.push({
          label: `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`,
          start, end, sales: 0,
        });
      }
      invoices.forEach((inv) => {
        const invDate = new Date(inv.date);
        weeks.forEach((w) => {
          if (invDate >= w.start && invDate <= w.end) {
            w.sales += getInvoiceTotal(inv);
          }
        });
      });
      return weeks.map((w) => ({ label: w.label, sales: w.sales }));
    }
    if (salesPeriod === "yearly") {
      const yearMap = new Map<string, number>();
      invoices.forEach((inv) => {
        const y = inv.date.substring(0, 4);
        yearMap.set(y, (yearMap.get(y) || 0) + getInvoiceTotal(inv));
      });
      return Array.from(yearMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([year, sales]) => ({ label: year, sales }));
    }
    // monthly
    const monthMap = new Map<string, number>();
    invoices.forEach((inv) => {
      const m = inv.date.substring(0, 7);
      monthMap.set(m, (monthMap.get(m) || 0) + getInvoiceTotal(inv));
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, sales]) => ({ label: month, sales }));
  }, [invoices, salesPeriod]);

  const paymentsData = useMemo(() => {
    const monthMap = new Map<string, { paid: number; pending: number }>();
    invoices.forEach((inv) => {
      const m = inv.date.substring(0, 7);
      const total = getInvoiceTotal(inv);
      const existing = monthMap.get(m) || { paid: 0, pending: 0 };
      existing.paid += inv.paidTotal;
      existing.pending += total - inv.paidTotal;
      monthMap.set(m, existing);
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }));
  }, [invoices]);

  const topProducts = useMemo(() => {
    const productMap = new Map<string, number>();
    invoices.forEach((inv) =>
      inv.items.forEach((item) => {
        productMap.set(
          item.productName,
          (productMap.get(item.productName) || 0) + (item.qty * item.unitPrice - item.lineDiscount)
        );
      })
    );
    return Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const branchData = useMemo(() => {
    const branchMap = new Map<string, number>();
    invoices.forEach((inv) => {
      branchMap.set(inv.branch, (branchMap.get(inv.branch) || 0) + getInvoiceTotal(inv));
    });
    return Array.from(branchMap.entries()).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const overdueCustomers = useMemo(() => {
    const customerBalances = new Map<string, { balance: number; lastPayment: string | null; invoiceIds: string[]; phone: string }>();
    invoices.forEach((inv) => {
      const total = getInvoiceTotal(inv);
      const remaining = total - inv.paidTotal;
      if (remaining > 0) {
        const existing = customerBalances.get(inv.customer);
        const cust = customers.find((c) => c.fullName === inv.customer);
        customerBalances.set(inv.customer, {
          balance: (existing?.balance || 0) + remaining,
          lastPayment: existing?.lastPayment || null,
          invoiceIds: [...(existing?.invoiceIds || []), inv.id],
          phone: cust?.phone || existing?.phone || "",
        });
      }
    });
    receipts.forEach((r) => {
      const existing = customerBalances.get(r.customer);
      if (existing && (!existing.lastPayment || r.date > existing.lastPayment)) {
        existing.lastPayment = r.date;
      }
    });
    const overdue: { name: string; balance: number; lastPayment: string | null; daysSince: number; invoiceIds: string[]; phone: string }[] = [];
    customerBalances.forEach((data, name) => {
      const lastDate = data.lastPayment ? new Date(data.lastPayment) : null;
      const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      if (daysSince >= 30) {
        overdue.push({ name, balance: data.balance, lastPayment: data.lastPayment, daysSince, invoiceIds: data.invoiceIds, phone: data.phone });
      }
    });
    return overdue;
  }, [invoices, customers, receipts]);

  const periodLabels: Record<SalesPeriod, string> = {
    daily: "اليومي",
    weekly: "الأسبوعي",
    monthly: "الشهري",
    yearly: "السنوي",
  };

  const handleExportDashboardPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:#f0fdf4;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">مبيعات اليوم</div>
          <div style="font-size:18px;font-weight:800;color:#0d5c63;">${todaySales.toLocaleString()} ج.م</div>
        </div>
        <div style="background:#f0f9ff;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">مبيعات الأسبوع</div>
          <div style="font-size:18px;font-weight:800;color:#0d5c63;">${weeklySales.toLocaleString()} ج.م</div>
        </div>
        <div style="background:#fefce8;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">إجمالي المبيعات</div>
          <div style="font-size:18px;font-weight:800;color:#0d5c63;">${totalSales.toLocaleString()} ج.م</div>
        </div>
        <div style="background:#f0fdf4;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">المحصل</div>
          <div style="font-size:18px;font-weight:800;color:#166534;">${totalPaid.toLocaleString()} ج.م</div>
          <div style="font-size:10px;color:#666;">${collectionRate}% نسبة التحصيل</div>
        </div>
        <div style="background:#fef2f2;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">الأرصدة المعلقة</div>
          <div style="font-size:18px;font-weight:800;color:#dc2626;">${totalPending.toLocaleString()} ج.م</div>
        </div>
        <div style="background:#f0f9ff;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">عدد العملاء</div>
          <div style="font-size:18px;font-weight:800;color:#0d5c63;">${customers.length}</div>
        </div>
      </div>`;

    const salesRows = salesChartData.map((d) =>
      `<tr><td style="padding:8px;border:1px solid #ddd;">${d.label}</td><td style="padding:8px;border:1px solid #ddd;font-weight:600;">${d.sales.toLocaleString()} ج.م</td></tr>`
    ).join("");

    const productRows = topProducts.map((p, i) =>
      `<tr><td style="padding:8px;border:1px solid #ddd;">${i + 1}</td><td style="padding:8px;border:1px solid #ddd;">${p.name}</td><td style="padding:8px;border:1px solid #ddd;font-weight:600;">${p.value.toLocaleString()} ج.م</td></tr>`
    ).join("");

    const branchRows = branchData.map((b) =>
      `<tr><td style="padding:8px;border:1px solid #ddd;">${b.name}</td><td style="padding:8px;border:1px solid #ddd;font-weight:600;">${b.value.toLocaleString()} ج.م</td></tr>`
    ).join("");

    const recentInvRows = invoices.slice(-10).reverse().map((inv) => {
      const total = getInvoiceTotal(inv);
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${inv.id}</td>
        <td style="padding:8px;border:1px solid #ddd;">${inv.customer}</td>
        <td style="padding:8px;border:1px solid #ddd;">${inv.date}</td>
        <td style="padding:8px;border:1px solid #ddd;">${total.toLocaleString()} ج.م</td>
        <td style="padding:8px;border:1px solid #ddd;">${inv.paidTotal.toLocaleString()} ج.م</td>
        <td style="padding:8px;border:1px solid #ddd;">${inv.status}</td>
      </tr>`;
    }).join("");

    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير لوحة التحكم - ${periodLabels[salesPeriod]}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',sans-serif;padding:30px;color:#1a1a1a}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
  th{background:#0d5c63;color:#fff;padding:10px;text-align:right;font-weight:600;border:1px solid #0a4a50}
  h3{color:#0d5c63;font-size:16px;margin:20px 0 8px;border-bottom:2px solid #0d5c63;padding-bottom:4px}
  .header{text-align:center;margin-bottom:24px;border-bottom:2px solid #0d5c63;padding-bottom:16px}
  .header img{height:50px;margin-bottom:8px}
  .header h1{font-size:22px;color:#0d5c63}
  .header h2{font-size:16px;color:#333;font-weight:600}
  .footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:11px}
</style></head><body>
  <div class="header">
    ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="logo" onerror="this.style.display='none'" />` : ""}
    <h1>${settings.name}</h1>
    ${settings.address ? `<div style="font-size:11px;color:#666;">${settings.address} ${settings.phone ? `| ${settings.phone}` : ""}</div>` : ""}
    <h2>تقرير لوحة التحكم — التحليل ${periodLabels[salesPeriod]}</h2>
    <div style="font-size:11px;color:#999;margin-top:4px;">تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")} — ${new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</div>
  </div>

  ${statsHtml}

  <h3>تحليل المبيعات (${periodLabels[salesPeriod]})</h3>
  <table><thead><tr><th>الفترة</th><th>المبيعات</th></tr></thead><tbody>${salesRows}</tbody></table>

  <h3>أعلى 5 منتجات مبيعاً</h3>
  <table><thead><tr><th>#</th><th>المنتج</th><th>الإيرادات</th></tr></thead><tbody>${productRows}</tbody></table>

  <h3>أداء الفروع</h3>
  <table><thead><tr><th>الفرع</th><th>المبيعات</th></tr></thead><tbody>${branchRows}</tbody></table>

  <h3>آخر الفواتير</h3>
  <table><thead><tr><th>رقم</th><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>المدفوع</th><th>الحالة</th></tr></thead><tbody>${recentInvRows}</tbody></table>

  <div class="footer">تقرير صادر بواسطة ${settings.name} — ${new Date().toLocaleDateString("ar-EG")}</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const handlePrintOverdue = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = overdueCustomers
      .map(
        (c) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">${c.name}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;" dir="ltr">${c.phone || "-"}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${c.invoiceIds.join(", ")}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${c.lastPayment || "لم يدفع"}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${c.daysSince === 999 ? "لم يدفع أبداً" : `${c.daysSince} يوم`}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;color:#dc2626;font-weight:bold;">${c.balance.toLocaleString()} ج.م</td>
      </tr>`
      )
      .join("");
    win.document.write(`<html dir="rtl"><head><title>تقرير العملاء المتأخرين</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',sans-serif;padding:30px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
      <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #0d5c63;padding-bottom:16px;">
        ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="logo" style="height:50px;margin:0 auto 8px;" onerror="this.style.display='none'" />` : ""}
        <h1 style="font-size:22px;color:#0d5c63;">${settings.name}</h1>
        ${settings.address ? `<div style="font-size:11px;color:#666;">${settings.address} ${settings.phone ? `| ${settings.phone}` : ""}</div>` : ""}
        <h2 style="font-size:16px;color:#333;margin-top:4px;">تقرير العملاء المتأخرين عن الدفع</h2>
        <p style="font-size:12px;color:#999;margin-top:4px;">تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#0d5c63;color:#fff;">
          <th style="padding:10px;text-align:right;">العميل</th>
          <th style="padding:10px;text-align:right;">الهاتف</th>
          <th style="padding:10px;text-align:right;">أرقام الفواتير</th>
          <th style="padding:10px;text-align:right;">آخر دفعة</th>
          <th style="padding:10px;text-align:right;">المدة</th>
          <th style="padding:10px;text-align:right;">المبلغ المستحق</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f5f5f5;font-weight:bold;">
          <td colspan="5" style="padding:10px;">الإجمالي</td>
          <td style="padding:10px;color:#dc2626;">${overdueCustomers.reduce((s, c) => s + c.balance, 0).toLocaleString()} ج.م</td>
        </tr></tfoot>
      </table>
      <div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:11px;">
        تقرير صادر بواسطة ${settings.name} — ${new Date().toLocaleDateString("ar-EG")}
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const stats = [
    {
      title: "مبيعات اليوم",
      value: `${todaySales.toLocaleString()} ج.م`,
      sub: `${todayInvoices} فاتورة`,
      icon: CalendarDays,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      title: "مبيعات الأسبوع",
      value: `${weeklySales.toLocaleString()} ج.م`,
      sub: "آخر 7 أيام",
      icon: BarChart3,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "إجمالي المبيعات",
      value: `${totalSales.toLocaleString()} ج.م`,
      sub: `${invoices.length} فاتورة`,
      icon: DollarSign,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "المحصل",
      value: `${totalPaid.toLocaleString()} ج.م`,
      sub: `${collectionRate}% نسبة التحصيل`,
      icon: TrendingUp,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "الأرصدة المعلقة",
      value: `${totalPending.toLocaleString()} ج.م`,
      sub: `${overdueCustomers.length} عميل متأخر`,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      title: "عدد العملاء",
      value: String(customers.length),
      sub: "عميل مسجل",
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" ref={dashboardRef}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header">لوحة التحكم</h1>
            <p className="text-muted-foreground -mt-4 mb-6">
              مرحباً بك في {settings.name}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportDashboardPDF}>
            <Download className="h-4 w-4 ml-1" />
            تصدير PDF
          </Button>
        </div>

        {/* Overdue Alerts */}
        {overdueCustomers.length > 0 && (
          <Card className="border-warning bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  تنبيه: عملاء متأخرون عن الدفع (أكثر من 30 يوم)
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handlePrintOverdue}>
                  <Printer className="h-4 w-4 ml-1" />
                  طباعة
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueCustomers.map((c, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background rounded-lg border gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{c.name}</span>
                        {c.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        الفواتير: {c.invoiceIds.join(", ")} — آخر دفعة:{" "}
                        {c.lastPayment || "لم يدفع"} —{" "}
                        {c.daysSince === 999
                          ? "لم يدفع أبداً"
                          : `منذ ${c.daysSince} يوم`}
                      </div>
                    </div>
                    <span className="text-destructive font-bold whitespace-nowrap">
                      {c.balance.toLocaleString()} ج.م
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sales Chart with Period Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">تحليل المبيعات</CardTitle>
                <Tabs
                  value={salesPeriod}
                  onValueChange={(v) => setSalesPeriod(v as SalesPeriod)}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="daily" className="text-xs px-3 h-7">يومي</TabsTrigger>
                    <TabsTrigger value="weekly" className="text-xs px-3 h-7">أسبوعي</TabsTrigger>
                    <TabsTrigger value="monthly" className="text-xs px-3 h-7">شهري</TabsTrigger>
                    <TabsTrigger value="yearly" className="text-xs px-3 h-7">سنوي</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 20%, 88%)",
                      fontFamily: "Cairo",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, "المبيعات"]}
                  />
                  <Bar dataKey="sales" fill="hsl(172, 66%, 26%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Products Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                أعلى المنتجات مبيعاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {topProducts.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontFamily: "Cairo", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {topProducts.map((product, i) => (
                  <div key={product.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i] }}
                    />
                    <span className="text-muted-foreground truncate">{product.name}</span>
                    <span className="mr-auto font-medium whitespace-nowrap">
                      {product.value.toLocaleString()} ج.م
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Area Chart + Branch Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">التحصيل مقابل المستحق</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={paymentsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 20%, 88%)",
                      fontFamily: "Cairo",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} ج.م`,
                      name === "paid" ? "المحصل" : "المعلق",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    stackId="1"
                    stroke="hsl(142, 71%, 35%)"
                    fill="hsl(142, 71%, 35%)"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    stackId="1"
                    stroke="hsl(0, 72%, 51%)"
                    fill="hsl(0, 72%, 51%)"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">أداء الفروع</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={branchData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 20%, 88%)",
                      fontFamily: "Cairo",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, "المبيعات"]}
                  />
                  <Bar dataKey="value" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              آخر الفواتير
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-right pb-3 font-medium">رقم الفاتورة</th>
                    <th className="text-right pb-3 font-medium">العميل</th>
                    <th className="text-right pb-3 font-medium">التاريخ</th>
                    <th className="text-right pb-3 font-medium">المبلغ</th>
                    <th className="text-right pb-3 font-medium">المدفوع</th>
                    <th className="text-right pb-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .slice(-6)
                    .reverse()
                    .map((inv) => {
                      const total = getInvoiceTotal(inv);
                      const remaining = total - inv.paidTotal;
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-3 font-medium">{inv.id}</td>
                          <td className="py-3">{inv.customer}</td>
                          <td className="py-3 text-muted-foreground text-xs">{inv.date}</td>
                          <td className="py-3">{total.toLocaleString()} ج.م</td>
                          <td className="py-3">
                            <span className={remaining > 0 ? "text-destructive" : "text-success"}>
                              {inv.paidTotal.toLocaleString()} ج.م
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[inv.status] || ""}`}
                            >
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
