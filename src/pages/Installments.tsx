import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { useToast } from "@/hooks/use-toast";
import { useReceipts, useInvoices } from "@/data/hooks";

export default function Installments() {
  const { receipts, addReceipt } = useReceipts();
  const { invoices } = useInvoices();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId: "", customer: "", amount: 0, method: "نقدي", notes: "" });
  const { toast } = useToast();

  // Auto-fill customer when invoice selected
  const handleInvoiceChange = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    setForm({ ...form, invoiceId, customer: inv?.customer || form.customer });
  };

  const handleSave = () => {
    if (!form.invoiceId || !form.amount) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    addReceipt({ ...form, date: new Date().toISOString().split("T")[0] });
    toast({ title: "تم التسجيل", description: "تم تسجيل القسط بنجاح وتم تحديث الفاتورة" });
    setForm({ invoiceId: "", customer: "", amount: 0, method: "نقدي", notes: "" });
    setOpen(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">الأقساط</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />تسجيل قسط</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>تسجيل قسط جديد</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label>رقم الفاتورة *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.invoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                  >
                    <option value="">اختر الفاتورة</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.id} — {inv.customer}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>العميل</Label><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} readOnly className="bg-muted" /></div>
                <div className="space-y-1.5"><Label>المبلغ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>طريقة الدفع</Label><Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">حفظ</Button>
            </DialogContent>
          </Dialog>
        </div>

        <ExportButtons
          data={receipts as any}
          headers={[
            { key: "id", label: "الكود" },
            { key: "invoiceId", label: "رقم الفاتورة" },
            { key: "customer", label: "العميل" },
            { key: "amount", label: "المبلغ" },
            { key: "date", label: "التاريخ" },
            { key: "method", label: "طريقة الدفع" },
          ]}
          fileName="الأقساط"
          title="الأقساط"
        />

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
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-primary">{r.id}</td>
                      <td className="p-3">{r.invoiceId}</td>
                      <td className="p-3">{r.customer}</td>
                      <td className="p-3">{r.amount.toLocaleString()} ج.م</td>
                      <td className="p-3">{r.date}</td>
                      <td className="p-3">{r.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
