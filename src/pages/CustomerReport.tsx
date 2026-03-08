import { useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Printer, ArrowRight, FileText, CreditCard, RotateCcw, TrendingUp,
  Phone, MapPin, Briefcase, User, DollarSign,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useCustomers, useInvoices, useReceipts, useCompanySettings, useReturns } from "@/data/hooks";
import type { InvoiceItem } from "@/data/types";

const calcLineTotal = (item: InvoiceItem) => item.qty * item.unitPrice - item.lineDiscount;
const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((sum, i) => sum + calcLineTotal(i), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

const COLORS = ["hsl(172, 66%, 26%)", "hsl(38, 92%, 50%)", "hsl(205, 79%, 52%)", "hsl(142, 71%, 35%)", "hsl(0, 72%, 51%)"];

const statusColors: Record<string, string> = {
  "مسودة": "bg-muted text-muted-foreground",
  "مؤكدة": "bg-info/10 text-info",
  "تم التسليم": "bg-success/10 text-success",
  "مغلقة": "bg-muted text-muted-foreground",
};

export default function CustomerReport() {
  const { customerId } = useParams<{ customerId: string }>();
  const { customers } = useCustomers();
  const { invoices } = useInvoices();
  const { receipts } = useReceipts();
  const { returns } = useReturns();
  const { settings } = useCompanySettings();
  const printRef = useRef<HTMLDivElement>(null);

  const customer = customers.find((c) => c.id === customerId);

  const custInvoices = useMemo(() => customer ? invoices.filter((inv) => inv.customer === customer.fullName) : [], [invoices, customer]);
  const custReceipts = useMemo(() => customer ? receipts.filter((r) => r.customer === customer.fullName) : [], [receipts, customer]);
  const custReturns = useMemo(() => customer ? returns.filter((r) => r.customer === customer.fullName) : [], [returns, customer]);
  const totalInvoices = custInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
  const totalPaid = custReceipts.reduce((s, r) => s + r.amount, 0);
  const totalReturns = custReturns.reduce((s, r) => s + r.totalAmount, 0);
  const remaining = totalInvoices - totalPaid - totalReturns;

  // Monthly payment chart data
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; paid: number; invoiced: number }> = {};
    custInvoices.forEach((inv) => {
      const m = inv.date.substring(0, 7);
      if (!months[m]) months[m] = { month: m, paid: 0, invoiced: 0 };
      months[m].invoiced += getInvoiceTotal(inv);
    });
    custReceipts.forEach((r) => {
      const m = r.date.substring(0, 7);
      if (!months[m]) months[m] = { month: m, paid: 0, invoiced: 0 };
      months[m].paid += r.amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [custInvoices, custReceipts]);

  // Product breakdown for pie chart
  const productBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    custInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        map[item.productName] = (map[item.productName] || 0) + calcLineTotal(item);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [custInvoices]);

  // Payment timeline
  const paymentTimeline = useMemo(() => {
    const events: { date: string; type: "invoice" | "payment" | "return"; desc: string; amount: number }[] = [];
    custInvoices.forEach((inv) => events.push({ date: inv.date, type: "invoice", desc: `فاتورة ${inv.id}`, amount: getInvoiceTotal(inv) }));
    custReceipts.forEach((r) => events.push({ date: r.date, type: "payment", desc: `دفعة — ${r.method}`, amount: r.amount }));
    custReturns.forEach((r) => events.push({ date: r.date, type: "return", desc: `مرتجع — ${r.reason}`, amount: r.totalAmount }));
    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [custInvoices, custReceipts, custReturns]);

  if (!customer) {
    return (
      <AppLayout>
        <div className="text-center p-8 text-muted-foreground">العميل غير موجود</div>
      </AppLayout>
    );
  }

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
            .summary { display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
            .summary-item { background: #f8f9fa; padding: 12px 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 120px; }
            .summary-value { font-size: 20px; font-weight: 800; color: #0d5c63; }
            .summary-label { font-size: 12px; color: #666; }
            .text-danger { color: #dc3545; }
            .text-success { color: #28a745; }
            .text-warning { color: #e5a100; }
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/customers"><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link>
            <h1 className="page-header mb-0">لوحة تحكم العميل</h1>
          </div>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 ml-2" />طباعة التقرير</Button>
        </div>

        {/* Customer Info Card */}
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{customer.fullName}</h2>
                  <p className="text-sm text-muted-foreground">{customer.nationalId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.governorate || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.jobTitle || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.address || "—"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="pt-5 text-center">
            <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">عدد الفواتير</p>
            <p className="text-2xl font-bold text-primary">{custInvoices.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-info" />
            <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
            <p className="text-xl font-bold text-foreground">{totalInvoices.toLocaleString()} ج.م</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <CreditCard className="h-5 w-5 mx-auto mb-1 text-success" />
            <p className="text-xs text-muted-foreground">المدفوع</p>
            <p className="text-xl font-bold text-success">{totalPaid.toLocaleString()} ج.م</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <RotateCcw className="h-5 w-5 mx-auto mb-1 text-warning" />
            <p className="text-xs text-muted-foreground">المرتجعات</p>
            <p className="text-xl font-bold text-warning">{totalReturns.toLocaleString()} ج.م</p>
          </CardContent></Card>
          <Card className={remaining > 0 ? "border-destructive/30" : "border-success/30"}><CardContent className="pt-5 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-xs text-muted-foreground">المتبقي</p>
            <p className={`text-xl font-bold ${remaining > 0 ? "text-destructive" : "text-success"}`}>{remaining.toLocaleString()} ج.م</p>
          </CardContent></Card>
        </div>

        {/* Charts */}
        {monthlyData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">الفوترة والتحصيل الشهري</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                    <Area type="monotone" dataKey="invoiced" name="فواتير" fill="hsl(205, 79%, 52%)" fillOpacity={0.2} stroke="hsl(205, 79%, 52%)" />
                    <Area type="monotone" dataKey="paid" name="مدفوع" fill="hsl(142, 71%, 35%)" fillOpacity={0.2} stroke="hsl(142, 71%, 35%)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {productBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">المنتجات المشتراة</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={productBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {productBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.م`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>
            <TabsTrigger value="invoices">الفواتير ({custInvoices.length})</TabsTrigger>
            <TabsTrigger value="payments">المدفوعات ({custReceipts.length})</TabsTrigger>
            {custReturns.length > 0 && <TabsTrigger value="returns">المرتجعات ({custReturns.length})</TabsTrigger>}
          </TabsList>

          {/* Timeline */}
          <TabsContent value="timeline">
            <Card>
              <CardContent className="pt-6">
                {paymentTimeline.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">لا توجد عمليات</p>
                ) : (
                  <div className="space-y-0">
                    {paymentTimeline.map((ev, i) => (
                      <div key={i} className="flex items-start gap-4 py-3 border-b last:border-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          ev.type === "invoice" ? "bg-info/10" : ev.type === "payment" ? "bg-success/10" : "bg-warning/10"
                        }`}>
                          {ev.type === "invoice" && <FileText className="h-4 w-4 text-info" />}
                          {ev.type === "payment" && <CreditCard className="h-4 w-4 text-success" />}
                          {ev.type === "return" && <RotateCcw className="h-4 w-4 text-warning" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ev.desc}</p>
                          <p className="text-xs text-muted-foreground">{ev.date}</p>
                        </div>
                        <span className={`text-sm font-bold ${
                          ev.type === "invoice" ? "text-foreground" : ev.type === "payment" ? "text-success" : "text-warning"
                        }`}>
                          {ev.type === "invoice" ? "" : ev.type === "payment" ? "-" : "+"}{ev.amount.toLocaleString()} ج.م
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices */}
          <TabsContent value="invoices">
            <Card>
              <CardContent className="pt-6">
                {custInvoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">لا توجد فواتير</p>
                ) : (
                  <div className="space-y-4">
                    {custInvoices.map((inv) => {
                      const invTotal = getInvoiceTotal(inv);
                      const invReceipts = receipts.filter((r) => r.invoiceId === inv.id);
                      const invPaid = invReceipts.reduce((s, r) => s + r.amount, 0);
                      const invRemaining = invTotal - invPaid;
                      const paidPercent = invTotal > 0 ? Math.min(100, (invPaid / invTotal) * 100) : 0;
                      return (
                        <div key={inv.id} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-bold text-primary">{inv.id}</span>
                              <span className="text-xs text-muted-foreground">{inv.date}</span>
                              <Badge variant="outline" className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span>الإجمالي: <strong>{invTotal.toLocaleString()}</strong></span>
                              <span className="text-success">مدفوع: {invPaid.toLocaleString()}</span>
                              {invRemaining > 0 && <span className="text-destructive">متبقي: {invRemaining.toLocaleString()}</span>}
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1 bg-muted">
                            <div className="h-full bg-success transition-all" style={{ width: `${paidPercent}%` }} />
                          </div>
                          <div className="overflow-x-auto">
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <Card>
              <CardContent className="pt-6">
                {custReceipts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">لا توجد مدفوعات</p>
                ) : (
                  <div className="overflow-x-auto">
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
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-3 font-medium text-primary">{r.id}</td>
                            <td className="p-3">{r.invoiceId}</td>
                            <td className="p-3 font-bold">{r.amount.toLocaleString()} ج.م</td>
                            <td className="p-3">{r.date}</td>
                            <td className="p-3"><Badge variant="secondary">{r.method}</Badge></td>
                            <td className="p-3 text-muted-foreground">{r.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Returns */}
          {custReturns.length > 0 && (
            <TabsContent value="returns">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {custReturns.map((ret) => (
                      <div key={ret.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-primary">{ret.id}</span>
                            <span className="text-sm text-muted-foreground">{ret.date}</span>
                            <Badge variant="outline">فاتورة: {ret.invoiceId}</Badge>
                          </div>
                          <span className="font-bold text-warning">{ret.totalAmount.toLocaleString()} ج.م</span>
                        </div>
                        <p className="text-sm text-muted-foreground">السبب: {ret.reason}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {ret.items.map((item, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {item.productName} × {item.qty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
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
            <div className="summary-item"><div className="summary-label">المرتجعات</div><div className="summary-value text-warning">{totalReturns.toLocaleString()} ج.م</div></div>
            <div className="summary-item"><div className="summary-label">المتبقي</div><div className="summary-value text-danger">{remaining.toLocaleString()} ج.م</div></div>
          </div>

          <h2>الفواتير والمنتجات</h2>
          {custInvoices.map((inv) => {
            const invTotal = getInvoiceTotal(inv);
            const invReceipts = receipts.filter((r) => r.invoiceId === inv.id);
            const invPaid = invReceipts.reduce((s, r) => s + r.amount, 0);
            return (
              <div key={inv.id} style={{ marginBottom: "20px" }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{inv.id} — {inv.date} — الفرع: {inv.branch} — الإجمالي: {invTotal.toLocaleString()} ج.م — المدفوع: {invPaid.toLocaleString()} ج.م — المتبقي: {(invTotal - invPaid).toLocaleString()} ج.م</p>
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

          <h2>سجل المدفوعات</h2>
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

          {custReturns.length > 0 && (
            <>
              <h2>المرتجعات</h2>
              <table>
                <thead><tr><th>الكود</th><th>الفاتورة</th><th>التاريخ</th><th>المبلغ</th><th>السبب</th></tr></thead>
                <tbody>
                  {custReturns.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td><td>{r.invoiceId}</td><td>{r.date}</td>
                      <td>{r.totalAmount.toLocaleString()} ج.م</td><td>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ marginTop: 30, textAlign: "center", color: "#999", fontSize: 11, borderTop: "1px solid #ddd", paddingTop: 12 }}>
            تقرير صادر بتاريخ {new Date().toLocaleDateString("ar-EG")} — {settings.name}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
