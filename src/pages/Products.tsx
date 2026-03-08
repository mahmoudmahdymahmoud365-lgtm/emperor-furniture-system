import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/data/hooks";

const emptyProduct = { name: "", category: "", defaultPrice: 0, unit: "قطعة", stock: 0, minStock: 0, notes: "" };

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = products.filter((p) => p.name.includes(search) || p.category.includes(search));

  const handleSave = () => {
    if (!formData.name) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المنتج", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateProduct(editingId, formData);
      toast({ title: "تم التحديث" });
    } else {
      addProduct(formData);
      toast({ title: "تمت الإضافة" });
    }
    setFormData(emptyProduct);
    setEditingId(null);
    setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteProduct(deleteId);
      toast({ title: "تم الحذف" });
      setDeleteId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">إدارة المنتجات</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFormData(emptyProduct); setEditingId(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة منتج</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="col-span-2 space-y-1.5"><Label>اسم المنتج *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الفئة</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>وحدة القياس</Label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label>السعر الافتراضي</Label><Input type="number" value={formData.defaultPrice} onChange={(e) => setFormData({ ...formData, defaultPrice: Number(e.target.value) })} dir="ltr" /></div>
                <div className="col-span-2 space-y-1.5"><Label>ملاحظات</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الفئة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <ExportButtons data={filtered as any} headers={[{ key: "id", label: "الكود" },{ key: "name", label: "المنتج" },{ key: "category", label: "الفئة" },{ key: "defaultPrice", label: "السعر" },{ key: "unit", label: "الوحدة" }]} fileName="المنتجات" title="قائمة المنتجات" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المنتج</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الفئة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">السعر</th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">الوحدة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-primary">{p.id}</td>
                      <td className="p-3">{p.name}</td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3" dir="ltr">{p.defaultPrice.toLocaleString()} ج.م</td>
                      <td className="p-3 hidden md:table-cell">{p.unit}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setFormData(p); setEditingId(p.id); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا المنتج؟" />
      </div>
    </AppLayout>
  );
}
