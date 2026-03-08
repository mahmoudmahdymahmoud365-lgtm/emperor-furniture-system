import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Printer, Search } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useReceipts, useInvoices, useCompanySettings } from "@/data/hooks";
import type { Receipt, InvoiceItem } from "@/data/types";

const PAYMENT_METHODS = ["نقدي", "تحويل بنكي", "فيزا", "فودافون كاش", "إنستاباي", "شيك"];
const calcItemsTotal = (items: InvoiceItem[]) => items.reduce((s, i) => s + (i.qty * i.unitPrice - i.lineDiscount), 0);
const getInvoiceTotal = (inv: { items: InvoiceItem[]; appliedDiscount?: number }) => calcItemsTotal(inv.items) - (inv.appliedDiscount || 0);

export default function Installments() {
  const { receipts, addReceipt, updateReceipt, deleteReceipt } = useReceipts();
  const { invoices } = useInvoices();
  const { settings } = useCompanySettings();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ invoiceId: "", customer: "", amount: 0, method: "نقدي", notes: "" });
  const [methodFocus, setMethodFocus] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => !search || r.id.includes(search) || r.invoiceId.includes(search) || r.customer.includes(search) || r.method.includes(search));
  }, [receipts, search]);

  const handleInvoiceChange = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    setForm({ ...form, invoiceId, customer: inv?.customer || form.customer });
  };

  const resetForm = () => { setForm({ invoiceId: "", customer: "", amount: 0, method: "نقدي", notes: "" }); setEditingId(null); };

  const handleSave = () => {
    if (!form.invoiceId || !form.amount) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" }); return;
    }
    const inv = invoices.find(i => i.id === form.invoiceId);
    if (inv && !editingId) {
      const remaining = getInvoiceTotal(inv) - inv.paidTotal;
      if (form.amount > remaining) {
        toast({ title: "خطأ", description: `المبلغ أكبر من المتبقي (${remaining.toLocaleString()} ج.م)`, variant: "destructive" }); return;
      }
    }
    if (editingId) {
      updateReceipt(editingId, form);
      toast({ title: "تم التحديث", description: "تم تحديث القسط بنجاح" });
    } else {
      addReceipt({ ...form, date: new Date().toISOString().split("T")[0] });
      toast({ title: "تم التسجيل", description: "تم تسجيل القسط بنجاح وتم تحديث الفاتورة" });
    }
    resetForm(); setOpen(false);
  };

  const handleEdit = (r: Receipt) => {
    setEditingId(r.id);
    setForm({ invoiceId: r.invoiceId, customer: r.customer, amount: r.amount, method: r.method, notes: r.notes });
    setOpen(true);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteReceipt(deleteId); toast({ title: "تم الحذف", description: "تم حذف القسط وتحديث الفاتورة" }); setDeleteId(null); }
  };

  const handlePrint = (r: Receipt) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><title>إيصال ${r.id}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',sans-serif;padding:40px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
      <div style="max-width:500px;margin:0 auto;border:2px solid #0d5c63;border-radius:12px;overflow:hidden;">
        <div style="background:#0d5c63;color:#fff;padding:16px 24px;text-align:center;">
          ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="logo" style="height:36px;margin:0 auto 8px;display:block;" />` : ""}
          <h1 style="font-size:20px;margin:0;">${settings.name} — إيصال قسط</h1>
          <p style="font-size:14px;margin:4px 0 0;">${r.id}</p>
        </div>
          <p style="font-size:14px;margin:4px 0 0;">${r.id}</p>
        </div>
        <div style="padding:24px;">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;"><span>العميل:</span><strong>${r.customer}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;"><span>رقم الفاتورة:</span><strong>${r.invoiceId}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;"><span>التاريخ:</span><strong>${r.date}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;"><span>طريقة الدفع:</span><strong>${r.method}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;"><span>المبلغ:</span><strong style="color:#0d5c63;">${r.amount.toLocaleString()} ج.م</strong></div>
          ${r.notes ? `<div style="padding:8px 0;color:#666;font-size:13px;">ملاحظات: ${r.notes}</div>` : ""}
        </div>
        <div style="text-align:center;padding:12px;border-top:1px solid #eee;font-size:11px;color:#999;">${settings.name} — إيصال إلكتروني</div>
      </div>
    </body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">الأقساط/المدفوعات</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />تسجيل قسط</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "تعديل القسط" : "تسجيل قسط جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label>رقم الفاتورة *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.invoiceId} onChange={(e) => handleInvoiceChange(e.target.value)}>
                    <option value="">اختر الفاتورة</option>
                    {invoices.map((inv) => {
                      const total = getInvoiceTotal(inv);
                      const remaining = total - inv.paidTotal;
                      return <option key={inv.id} value={inv.id}>{inv.id} — {inv.customer} (متبقي: {remaining.toLocaleString()} ج.م)</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>العميل</Label><Input value={form.customer} readOnly className="bg-muted" /></div>
                <div className="space-y-1.5"><Label>المبلغ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} dir="ltr" /></div>
                <div className="space-y-1.5 relative">
                  <Label>طريقة الدفع</Label>
                  <Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} onFocus={() => setMethodFocus(true)} onBlur={() => setTimeout(() => setMethodFocus(false), 200)} />
                  {methodFocus && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {PAYMENT_METHODS.filter(m => m.includes(form.method)).map((m, i) => (
                        <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent" onMouseDown={() => setForm({ ...form, method: m })}>{m}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالكود أو الفاتورة أو العميل..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <ExportButtons data={filteredReceipts as any} headers={[{ key: "id", label: "الكود" },{ key: "invoiceId", label: "رقم الفاتورة" },{ key: "customer", label: "العميل" },{ key: "amount", label: "المبلغ" },{ key: "date", label: "التاريخ" },{ key: "method", label: "طريقة الدفع" }]} fileName="الأقساط" title="الأقساط" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المبلغ</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">التاريخ</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">طريقة الدفع</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-primary">{r.id}</td>
                      <td className="p-3">{r.invoiceId}</td>
                      <td className="p-3">{r.customer}</td>
                      <td className="p-3">{r.amount.toLocaleString()} ج.م</td>
                      <td className="p-3">{r.date}</td>
                      <td className="p-3">{r.method}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handlePrint(r)} title="طباعة"><Printer className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} title="تعديل"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} title="حذف" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredReceipts.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا القسط؟ سيتم تحديث الفاتورة تلقائياً." />
      </div>
    </AppLayout>
  );
}
