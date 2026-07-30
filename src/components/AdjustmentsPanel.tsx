// ==============================
// AdjustmentsPanel — Customer balance adjustments (financial settlements)
// Real data: /api/adjustments (PostgreSQL). Every change is audit-logged server-side.
// ==============================
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdjustments } from "@/data/hooks";
import { getCurrentUser } from "@/data/store";
import type { AdjustmentType } from "@/data/types";
import { ADJUSTMENT_TYPE_LABELS } from "@/data/types";

interface Props {
  customerId: string;
  customerName: string;
  invoiceId?: string;
  title?: string;
  defaultType?: AdjustmentType;
  compact?: boolean;
}

export default function AdjustmentsPanel({
  customerId, customerName, invoiceId, title = "التسويات المالية", defaultType = "manual", compact = false,
}: Props) {
  const { adjustments, addAdjustment, deleteAdjustment } = useAdjustments();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<AdjustmentType>(defaultType);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const rows = useMemo(() => adjustments.filter(a =>
    invoiceId ? a.invoiceId === invoiceId : (a.customerId === customerId || a.customerName === customerName)
  ), [adjustments, invoiceId, customerId, customerName]);

  const total = rows.reduce((s, a) => s + Number(a.amount || 0), 0);

  const reset = () => { setType(defaultType); setAmount(0); setReason(""); setNotes(""); };

  const save = async () => {
    if (!amount || isNaN(amount)) {
      toast({ title: "أدخل قيمة التسوية", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await addAdjustment({
        customerId, customerName, invoiceId: invoiceId || "",
        adjustmentType: type, amount: Number(amount),
        reason, notes, createdBy: getCurrentUser()?.name || "",
      });
      toast({ title: "تم حفظ التسوية" });
      reset(); setOpen(false);
    } catch (e: any) {
      toast({ title: "فشل حفظ التسوية", description: e?.message || "", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try { await deleteAdjustment(id); toast({ title: "تم حذف التسوية" }); }
    catch (e: any) { toast({ title: "فشل الحذف", description: e?.message || "", variant: "destructive" }); }
  };

  const dialog = (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3 w-3 ml-1" />إضافة تسوية</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="text-right">تسوية مالية {invoiceId ? `— فاتورة ${invoiceId}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">نوع التسوية</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as AdjustmentType)}
            >
              {(Object.keys(ADJUSTMENT_TYPE_LABELS) as AdjustmentType[]).map(t => (
                <option key={t} value={t}>{ADJUSTMENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">القيمة (موجب = يزيد المستحق، سالب = يقلل)</Label>
            <Input type="number" dir="ltr" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">السبب</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التسوية" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {dialog}
        {total !== 0 && (
          <Badge variant="outline" className={total > 0 ? "text-destructive" : "text-success"}>
            تسويات: {total.toLocaleString()} ج.م
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" />{title}</CardTitle>
        {dialog}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد تسويات</p>
        ) : (
          <div className="space-y-2">
            {rows.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ADJUSTMENT_TYPE_LABELS[a.adjustmentType] || a.adjustmentType}</Badge>
                    {a.invoiceId && <span className="text-xs text-muted-foreground">{a.invoiceId}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{a.reason || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${Number(a.amount) > 0 ? "text-destructive" : "text-success"}`}>
                    {Number(a.amount).toLocaleString()} ج.م
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(a.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>إجمالي التسويات</span>
              <span className={total > 0 ? "text-destructive" : "text-success"}>{total.toLocaleString()} ج.م</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
