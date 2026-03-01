import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
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
    toast({ title: editingId ? "تم التحديث" : "تمت الإضافة" });
    setForm({ name: "", address: "", rent: 0, active: true }); setEditingId(null); setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteBranch(deleteId); toast({ title: "تم الحذف" }); setDeleteId(null); }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">إدارة الفروع</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ name: "", address: "", rent: 0, active: true }); setEditingId(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة فرع</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5"><Label>اسم الفرع *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الإيجار الشهري</Label><Input type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })} dir="ltr" /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        <ExportButtons data={branches as any} headers={[{ key: "id", label: "الكود" },{ key: "name", label: "الاسم" },{ key: "address", label: "العنوان" },{ key: "rent", label: "الإيجار" },{ key: "active", label: "الحالة" }]} fileName="الفروع" title="قائمة الفروع" />

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">العنوان</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الإيجار</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-primary">{b.id}</td>
                      <td className="p-3">{b.name}</td>
                      <td className="p-3">{b.address}</td>
                      <td className="p-3">{b.rent.toLocaleString()} ج.م</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {b.active ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setForm(b); setEditingId(b.id); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا الفرع؟" />
      </div>
    </AppLayout>
  );
}
