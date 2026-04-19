import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Tag, Percent, Calendar, DollarSign, Search } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useOffers, useProducts } from "@/data/hooks";
import type { Offer, OfferType } from "@/data/types";
import { OFFER_TYPE_LABELS } from "@/data/types";

const emptyOffer: Omit<Offer, "id"> = {
  name: "", type: "percentage", value: 0, productId: "", productName: "",
  startDate: "", endDate: "", active: true, notes: "",
};

export default function Offers() {
  const { offers, activeOffers, addOffer, updateOffer, deleteOffer } = useOffers();
  const { products } = useProducts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyOffer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = offers.filter(o => o.name.includes(search) || o.productName.includes(search));

  const handleSave = () => {
    if (!form.name) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم العرض", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateOffer(editingId, form);
      toast({ title: "تم التحديث" });
    } else {
      addOffer(form);
      toast({ title: "تمت الإضافة", description: `تم إضافة العرض "${form.name}"` });
    }
    setForm(emptyOffer);
    setEditingId(null);
    setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteOffer(deleteId); toast({ title: "تم الحذف" }); setDeleteId(null); }
  };

  const typeIcon = (t: OfferType) => {
    if (t === "percentage") return <Percent className="h-3.5 w-3.5" />;
    if (t === "fixed") return <DollarSign className="h-3.5 w-3.5" />;
    return <Calendar className="h-3.5 w-3.5" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">العروض والخصومات</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyOffer); setEditingId(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة عرض</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "تعديل العرض" : "إضافة عرض جديد"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>اسم العرض *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>نوع الخصم</Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as OfferType })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(Object.keys(OFFER_TYPE_LABELS) as OfferType[]).map(t => (
                      <option key={t} value={t}>{OFFER_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{form.type === "fixed" ? "المبلغ (ج.م)" : "النسبة %"}</Label>
                  <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} dir="ltr" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>المنتج (اتركه فارغاً لجميع المنتجات)</Label>
                  <select
                    value={form.productName}
                    onChange={(e) => {
                      const p = products.find(pr => pr.name === e.target.value);
                      setForm({ ...form, productName: e.target.value, productId: p?.id || "" });
                    }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">جميع المنتجات</option>
                    {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ البداية</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ النهاية</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} dir="ltr" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>ملاحظات</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} id="offerActive" />
                  <Label htmlFor="offerActive">عرض نشط</Label>
                </div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Active offers summary */}
        {activeOffers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOffers.map(o => (
              <Card key={o.id} className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">{o.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      {typeIcon(o.type)}
                      <span>{o.type === "fixed" ? `${o.value.toLocaleString()} ج.م` : `${o.value}%`}</span>
                    </div>
                    <div>{o.productName || "جميع المنتجات"}</div>
                    {o.endDate && <div className="text-xs">حتى {o.endDate}</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو المنتج..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <ExportButtons
            data={filtered as any}
            headers={[{ key: "id", label: "الكود" }, { key: "name", label: "العرض" }, { key: "type", label: "النوع" }, { key: "value", label: "القيمة" }, { key: "productName", label: "المنتج" }, { key: "startDate", label: "البداية" }, { key: "endDate", label: "النهاية" }]}
            fileName="العروض" title="العروض والخصومات"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">العرض</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">النوع</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">القيمة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المنتج</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الفترة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{o.name}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full w-fit">
                          {typeIcon(o.type)} {OFFER_TYPE_LABELS[o.type]}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-primary">{o.type === "fixed" ? `${o.value.toLocaleString()} ج.م` : `${o.value}%`}</td>
                      <td className="p-3">{o.productName || "الكل"}</td>
                      <td className="p-3 text-xs">{o.startDate ? `${o.startDate} → ${o.endDate}` : "-"}</td>
                      <td className="p-3">
                        {o.active ? (
                          <span className="text-success text-xs font-medium">نشط</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">معطل</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setForm({ name: o.name, type: o.type, value: o.value, productId: o.productId, productName: o.productName, startDate: o.startDate, endDate: o.endDate, active: o.active, notes: o.notes });
                            setEditingId(o.id);
                            setOpen(true);
                          }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(o.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد عروض بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا العرض؟" />
      </div>
    </AppLayout>
  );
}
