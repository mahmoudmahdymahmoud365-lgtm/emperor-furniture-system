import { useState, useMemo, useRef } from "react";
import {
  TrendingUp, Users, FileText, DollarSign, AlertTriangle, Printer, Phone,
  CalendarDays, BarChart3, ArrowUpRight, ArrowDownRight, Package, Download,
  Activity, Wallet, Clock, ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
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
  "hsl(142, 71%, 35%)", "hsl(340, 65%, 47%)",
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

const CustomTooltipStyle = {
  borderRadius: "12px",
  border: "none",
  fontFamily: "Cairo",
  fontSize: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  padding: "10px 14px",
};

export default function Dashboard() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { receipts } = useReceipts();
  const { settings } = useCompanySettings();
  const { products } = useProducts();
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("monthly");
  const dashboardRef = useRef<HTMLDivElement>(null);

  const outOfStock = products.filter(p => p.stock <= 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock);

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

  // Previous week for comparison
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = formatDate(twoWeeksAgo);
  const prevWeekSales = invoices
    .filter((inv) => inv.date >= twoWeeksAgoStr && inv.date < weekAgoStr)
    .reduce((s, inv) => s + getInvoiceTotal(inv), 0);
  const weeklyChange = prevWeekSales > 0 ? Math.round(((weeklySales - prevWeekSales) / prevWeekSales) * 100) : 0;

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
      gradient: "from-info/20 to-info/5",
      iconBg: "bg-info/15",
      iconColor: "text-info",
      borderColor: "border-info/20",
    },
    {
      title: "مبيعات الأسبوع",
      value: `${weeklySales.toLocaleString()} ج.م`,
      sub: weeklyChange !== 0 ? `${weeklyChange > 0 ? "+" : ""}${weeklyChange}% عن الأسبوع الماضي` : "آخر 7 أيام",
      icon: BarChart3,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      trend: weeklyChange,
    },
    {
      title: "إجمالي المبيعات",
      value: `${totalSales.toLocaleString()} ج.م`,
      sub: `${invoices.length} فاتورة`,
      icon: DollarSign,
      gradient: "from-success/20 to-success/5",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      borderColor: "border-success/20",
    },
    {
      title: "المحصل",
      value: `${totalPaid.toLocaleString()} ج.م`,
      sub: `${collectionRate}% نسبة التحصيل`,
      icon: Wallet,
      gradient: "from-accent/20 to-accent/5",
      iconBg: "bg-accent/15",
      iconColor: "text-accent",
      borderColor: "border-accent/20",
    },
    {
      title: "الأرصدة المعلقة",
      value: `${totalPending.toLocaleString()} ج.م`,
      sub: `${overdueCustomers.length} عميل متأخر`,
      icon: Clock,
      gradient: "from-destructive/20 to-destructive/5",
      iconBg: "bg-destructive/15",
      iconColor: "text-destructive",
      borderColor: "border-destructive/20",
    },
    {
      title: "عدد العملاء",
      value: String(customers.length),
      sub: "عميل مسجل",
      icon: Users,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
  ];

  const totalProductsValue = topProducts.reduce((s, p) => s + p.value, 0);

  return (
    <AppLayout>
      <div className="space-y-6" ref={dashboardRef}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
              <p className="text-sm text-muted-foreground">
                مرحباً بك في {settings.name} — {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleExportDashboardPDF}>
            <Download className="h-4 w-4" />
            تصدير PDF
          </Button>
        </div>

        {/* Stock Alerts */}
        {(outOfStock.length > 0 || lowStock.length > 0) && (
          <div className="section-card border-destructive/30 bg-gradient-to-l from-destructive/5 to-transparent">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <Package className="h-4 w-4 text-destructive" />
                </div>
                <h3 className="font-bold text-foreground">تنبيهات المخزون</h3>
                <span className="badge-status bg-destructive/10 text-destructive">{outOfStock.length + lowStock.length} منتج</span>
              </div>
              <div className="grid gap-2">
                {outOfStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-destructive/20 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="badge-status bg-destructive/10 text-destructive">نفد</span>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-muted-foreground text-xs">({p.category})</span>
                    </div>
                    <span className="text-destructive font-bold">0 {p.unit}</span>
                  </div>
                ))}
                {lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-warning/20 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="badge-status bg-warning/10 text-warning">منخفض</span>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-muted-foreground text-xs">({p.category})</span>
                    </div>
                    <span className="text-warning font-bold">{p.stock} / {p.minStock} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Overdue Alerts */}
        {overdueCustomers.length > 0 && (
          <div className="section-card border-warning/30 bg-gradient-to-l from-warning/5 to-transparent">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </div>
                  <h3 className="font-bold text-foreground">عملاء متأخرون عن الدفع</h3>
                  <span className="badge-status bg-warning/10 text-warning">أكثر من 30 يوم</span>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={handlePrintOverdue}>
                  <Printer className="h-3.5 w-3.5" />
                  طباعة
                </Button>
              </div>
              <div className="grid gap-2">
                {overdueCustomers.map((c, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background rounded-xl border gap-2">
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
                        الفواتير: {c.invoiceIds.join(", ")} — آخر دفعة: {c.lastPayment || "لم يدفع"} — {c.daysSince === 999 ? "لم يدفع أبداً" : `منذ ${c.daysSince} يوم`}
                      </div>
                    </div>
                    <span className="text-destructive font-bold whitespace-nowrap">{c.balance.toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className={`relative overflow-hidden rounded-2xl border ${stat.borderColor} bg-gradient-to-br ${stat.gradient} p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                {stat.trend !== undefined && stat.trend !== 0 && (
                  <div className={`flex items-center gap-0.5 text-xs font-semibold ${stat.trend > 0 ? "text-success" : "text-destructive"}`}>
                    {stat.trend > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {Math.abs(stat.trend)}%
                  </div>
                )}
              </div>
              <p className="text-lg font-extrabold text-foreground leading-tight">{stat.value}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">{stat.title}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
              {/* Decorative circle */}
              <div className={`absolute -left-4 -bottom-4 w-20 h-20 rounded-full ${stat.iconBg} opacity-20 blur-xl`} />
            </div>
          ))}
        </div>

        {/* Sales Chart + Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 section-card">
            <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">تحليل المبيعات</h3>
                  <p className="text-xs text-muted-foreground">مقارنة أداء المبيعات حسب الفترة</p>
                </div>
              </div>
              <Tabs value={salesPeriod} onValueChange={(v) => setSalesPeriod(v as SalesPeriod)}>
                <TabsList className="h-9 rounded-xl bg-muted/50">
                  <TabsTrigger value="daily" className="text-xs px-3 h-7 rounded-lg">يومي</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs px-3 h-7 rounded-lg">أسبوعي</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs px-3 h-7 rounded-lg">شهري</TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs px-3 h-7 rounded-lg">سنوي</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(172, 66%, 26%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(172, 66%, 26%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" strokeOpacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CustomTooltipStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, "المبيعات"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(172, 66%, 26%)"
                    strokeWidth={2.5}
                    fill="url(#salesGradient)"
                    dot={{ r: 4, fill: "hsl(172, 66%, 26%)", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "hsl(172, 66%, 26%)", strokeWidth: 3, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="section-card">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <ShoppingCart className="h-4.5 w-4.5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">أعلى المنتجات</h3>
                  <p className="text-xs text-muted-foreground">الأكثر مبيعاً</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {topProducts.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CustomTooltipStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {topProducts.map((product, i) => (
                <div key={product.name} className="flex items-center gap-2.5 text-sm group">
                  <div
                    className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                    style={{ backgroundColor: COLORS[i] }}
                  />
                  <span className="text-muted-foreground truncate flex-1 text-xs">{product.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${totalProductsValue > 0 ? (product.value / totalProductsValue) * 100 : 0}%`,
                          backgroundColor: COLORS[i],
                        }}
                      />
                    </div>
                    <span className="font-bold text-xs whitespace-nowrap">{product.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payments + Branch Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="section-card">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                  <Wallet className="h-4.5 w-4.5 text-success" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">التحصيل مقابل المستحق</h3>
                  <p className="text-xs text-muted-foreground">تحليل شهري للتدفقات المالية</p>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={paymentsData}>
                  <defs>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 35%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 35%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CustomTooltipStyle}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} ج.م`,
                      name === "paid" ? "المحصل" : "المعلق",
                    ]}
                  />
                  <Area type="monotone" dataKey="paid" stroke="hsl(142, 71%, 35%)" strokeWidth={2} fill="url(#paidGrad)" dot={false} />
                  <Area type="monotone" dataKey="pending" stroke="hsl(0, 72%, 51%)" strokeWidth={2} fill="url(#pendingGrad)" dot={false} />
                  <Legend
                    formatter={(value: string) => (value === "paid" ? "المحصل" : "المعلق")}
                    wrapperStyle={{ fontFamily: "Cairo", fontSize: "12px", paddingTop: "8px" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="section-card">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <BarChart3 className="h-4.5 w-4.5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">أداء الفروع</h3>
                  <p className="text-xs text-muted-foreground">مقارنة إيرادات الفروع</p>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={branchData} layout="vertical" barSize={20}>
                  <defs>
                    <linearGradient id="branchGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="hsl(38, 92%, 60%)" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fontFamily: "Cairo" }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CustomTooltipStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, "المبيعات"]}
                  />
                  <Bar dataKey="value" fill="url(#branchGrad)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="section-card">
          <div className="p-5 pb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-info/10 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-info" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">آخر الفواتير</h3>
              <p className="text-xs text-muted-foreground">أحدث العمليات المسجلة</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs">رقم الفاتورة</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs">العميل</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs">التاريخ</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs">المبلغ</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs">المدفوع</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices
                    .slice(-6)
                    .reverse()
                    .map((inv) => {
                      const total = getInvoiceTotal(inv);
                      const remaining = total - inv.paidTotal;
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-primary">{inv.id}</td>
                          <td className="py-3 px-4">{inv.customer}</td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">{inv.date}</td>
                          <td className="py-3 px-4 font-medium">{total.toLocaleString()} ج.م</td>
                          <td className="py-3 px-4">
                            <span className={`font-semibold ${remaining > 0 ? "text-destructive" : "text-success"}`}>
                              {inv.paidTotal.toLocaleString()} ج.م
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`badge-status ${statusColors[inv.status] || ""}`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {invoices.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد فواتير بعد</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
