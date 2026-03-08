import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Building2, MapPin } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/data/hooks";

export default function Branches() {
  const { branches, addBranch, updateBranch, deleteBranch } = useBranches();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", rent: 0, active: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSave = () => {
    if (!form.name) { toast({ title: "خطأ", description: "يرجى إدخال اسم الفرع", variant: "destructive" }); return; }
    if (editingId) { updateBranch(editingId, form); } else { addBranch(form); }
    toast({ title: editingId ? "✅ تم التحديث" : "✅ تمت الإضافة" });
    setForm({ name: "", address: "", rent: 0, active: true }); setEditingId(null); setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteBranch(deleteId); toast({ title: "✅ تم الحذف" }); setDeleteId(null); }
  };

  const totalRent = branches.filter(b => b.active).reduce((s, b) => s + b.rent, 0);
  const activeCount = branches.filter(b => b.active).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              إدارة الفروع
            </h1>
            <p className="text-sm text-muted-foreground">{activeCount} فرع نشط — إجمالي الإيجارات: {totalRent.toLocaleString()} ج.م</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ name: "", address: "", rent: 0, active: true }); setEditingId(null); } }}>
            <DialogTrigger asChild><Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />إضافة فرع</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="form-group"><Label>اسم الفرع *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="form-group"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="form-group"><Label>الإيجار الشهري</Label><Input type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })} dir="ltr" /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        <ExportButtons data={branches as any} headers={[{ key: "id", label: "الكود" },{ key: "name", label: "الاسم" },{ key: "address", label: "العنوان" },{ key: "rent", label: "الإيجار" },{ key: "active", label: "الحالة" }]} fileName="الفروع" title="قائمة الفروع" />

        {/* Table */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الكود</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الاسم</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">العنوان</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الإيجار</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحالة</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-3.5 font-mono text-xs font-semibold text-primary">{b.id}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {b.address ? <span className="inline-flex items-center gap-1 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" />{b.address}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3.5 font-medium">{b.rent.toLocaleString()} ج.م</td>
                    <td className="p-3.5">
                      <span className={`badge-status ${b.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {b.active ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => { setForm(b); setEditingId(b.id); setOpen(true); }} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>لا توجد فروع</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا الفرع؟" />
      </div>
    </AppLayout>
  );
}
