import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, Package, PackageX, AlertTriangle } from "lucide-react";
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
  const [stockEditOpen, setStockEditOpen] = useState(false);
  const [stockEdit, setStockEdit] = useState<{ id: string; stock: number; minStock: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.name.includes(search) || p.category.includes(search));
    if (filter === "low") list = list.filter(p => p.stock > 0 && p.stock <= p.minStock);
    if (filter === "out") list = list.filter(p => p.stock <= 0);
    return list;
  }, [products, search, filter]);

  const outOfStock = products.filter(p => p.stock <= 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const totalValue = products.reduce((s, p) => s + p.stock * p.defaultPrice, 0);

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

  const handleUpdateStock = () => {
    if (!stockEdit) return;
    updateProduct(stockEdit.id, { stock: stockEdit.stock, minStock: stockEdit.minStock });
    toast({ title: "تم التحديث", description: "تم تحديث المخزون بنجاح" });
    setStockEditOpen(false);
    setStockEdit(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">إدارة المنتجات والمخزون</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFormData(emptyProduct); setEditingId(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة منتج</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="col-span-2 space-y-1.5"><Label>اسم المنتج *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الفئة</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>وحدة القياس</Label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>السعر الافتراضي</Label><Input type="number" value={formData.defaultPrice} onChange={(e) => setFormData({ ...formData, defaultPrice: Number(e.target.value) })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>الكمية المتاحة</Label><Input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>حد أدنى للتنبيه</Label><Input type="number" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })} dir="ltr" /></div>
                <div className="col-span-2 space-y-1.5"><Label>ملاحظات</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("out")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><PackageX className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">نفد من المخزون</p>
                <p className="text-2xl font-bold text-destructive">{outOfStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("low")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><AlertTriangle className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-sm text-muted-foreground">مخزون منخفض</p>
                <p className="text-2xl font-bold text-warning">{lowStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><Package className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-sm text-muted-foreground">قيمة المخزون</p>
                <p className="text-xl font-bold">{totalValue.toLocaleString()} ج.م</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alerts */}
        {(outOfStock > 0 || lowStock > 0) && (
          <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">تنبيهات المخزون</span>
            </div>
            <div className="space-y-1 text-sm">
              {products.filter(p => p.stock <= 0).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-destructive">
                  <PackageX className="h-3 w-3" />
                  <span><strong>{p.name}</strong> — نفد من المخزون</span>
                </div>
              ))}
              {products.filter(p => p.stock > 0 && p.stock <= p.minStock).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span><strong>{p.name}</strong> — متبقي {p.stock} {p.unit} فقط (الحد الأدنى: {p.minStock})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الفئة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>الكل</Button>
            <Button variant={filter === "low" ? "default" : "outline"} size="sm" onClick={() => setFilter("low")}>منخفض</Button>
            <Button variant={filter === "out" ? "default" : "outline"} size="sm" onClick={() => setFilter("out")}>نفد</Button>
          </div>
          <ExportButtons data={filtered as any} headers={[{ key: "id", label: "الكود" },{ key: "name", label: "المنتج" },{ key: "category", label: "الفئة" },{ key: "defaultPrice", label: "السعر" },{ key: "unit", label: "الوحدة" },{ key: "stock", label: "المخزون" },{ key: "minStock", label: "الحد الأدنى" }]} fileName="المنتجات" title="قائمة المنتجات" />
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
                    <th className="text-right p-3 font-medium text-muted-foreground">المخزون</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحد الأدنى</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">قيمة المخزون</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const status = p.stock <= 0 ? "نفد" : p.stock <= p.minStock ? "منخفض" : "متاح";
                    const statusClass = p.stock <= 0 ? "bg-destructive/10 text-destructive" : p.stock <= p.minStock ? "bg-warning/10 text-warning" : "bg-success/10 text-success";
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-primary">{p.id}</td>
                        <td className="p-3">{p.name}</td>
                        <td className="p-3">{p.category}</td>
                        <td className="p-3" dir="ltr">{p.defaultPrice.toLocaleString()} ج.م</td>
                        <td className="p-3 hidden md:table-cell">{p.unit}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                            {p.stock} {p.unit} — {status}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{p.minStock}</td>
                        <td className="p-3">{(p.stock * p.defaultPrice).toLocaleString()} ج.م</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title="تعديل المخزون" onClick={() => { setStockEdit({ id: p.id, stock: p.stock, minStock: p.minStock }); setStockEditOpen(true); }}>
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setFormData(p); setEditingId(p.id); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Stock Dialog */}
        <Dialog open={stockEditOpen} onOpenChange={(v) => { setStockEditOpen(v); if (!v) setStockEdit(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>تعديل المخزون</DialogTitle></DialogHeader>
            {stockEdit && (
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label>الكمية المتاحة</Label>
                  <Input type="number" value={stockEdit.stock} onChange={(e) => setStockEdit({ ...stockEdit, stock: Number(e.target.value) })} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حد أدنى للتنبيه</Label>
                  <Input type="number" value={stockEdit.minStock} onChange={(e) => setStockEdit({ ...stockEdit, minStock: Number(e.target.value) })} dir="ltr" />
                </div>
                <Button onClick={handleUpdateStock} className="w-full">حفظ</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا المنتج؟" />
      </div>
    </AppLayout>
  );
}
