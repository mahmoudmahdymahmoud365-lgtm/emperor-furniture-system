import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Package, AlertTriangle, PackageX, Edit } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { useProducts } from "@/data/hooks";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const { products, updateProduct } = useProducts();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<{ id: string; stock: number; minStock: number } | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let list = products.filter(p => p.name.includes(search) || p.category.includes(search));
    if (filter === "low") list = list.filter(p => p.stock > 0 && p.stock <= p.minStock);
    if (filter === "out") list = list.filter(p => p.stock <= 0);
    return list;
  }, [products, search, filter]);

  const outOfStock = products.filter(p => p.stock <= 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const totalValue = products.reduce((s, p) => s + p.stock * p.defaultPrice, 0);

  const handleUpdateStock = () => {
    if (!editProduct) return;
    updateProduct(editProduct.id, { stock: editProduct.stock, minStock: editProduct.minStock });
    toast({ title: "تم التحديث", description: "تم تحديث المخزون بنجاح" });
    setEditOpen(false);
    setEditProduct(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-header">إدارة المخزون</h1>

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

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الفئة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>الكل</Button>
            <Button variant={filter === "low" ? "default" : "outline"} size="sm" onClick={() => setFilter("low")}>منخفض</Button>
            <Button variant={filter === "out" ? "default" : "outline"} size="sm" onClick={() => setFilter("out")}>نفد</Button>
          </div>
          <ExportButtons
            data={filtered.map(p => ({ id: p.id, name: p.name, category: p.category, stock: p.stock, minStock: p.minStock, unit: p.unit, value: p.stock * p.defaultPrice }))}
            headers={[{ key: "id", label: "الكود" }, { key: "name", label: "المنتج" }, { key: "category", label: "الفئة" }, { key: "stock", label: "المخزون" }, { key: "minStock", label: "الحد الأدنى" }, { key: "unit", label: "الوحدة" }, { key: "value", label: "القيمة" }]}
            fileName="المخزون" title="تقرير المخزون"
          />
        </div>

        {/* Alerts */}
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المنتج</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الفئة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الكمية المتاحة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحد الأدنى</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الوحدة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">قيمة المخزون</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحالة</th>
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
                        <td className="p-3 font-semibold">{p.stock}</td>
                        <td className="p-3 text-muted-foreground">{p.minStock}</td>
                        <td className="p-3">{p.unit}</td>
                        <td className="p-3">{(p.stock * p.defaultPrice).toLocaleString()} ج.م</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>{status}</span>
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" onClick={() => { setEditProduct({ id: p.id, stock: p.stock, minStock: p.minStock }); setEditOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
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
        <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditProduct(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>تعديل المخزون</DialogTitle></DialogHeader>
            {editProduct && (
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label>الكمية المتاحة</Label>
                  <Input type="number" value={editProduct.stock} onChange={(e) => setEditProduct({ ...editProduct, stock: Number(e.target.value) })} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حد أدنى للتنبيه</Label>
                  <Input type="number" value={editProduct.minStock} onChange={(e) => setEditProduct({ ...editProduct, minStock: Number(e.target.value) })} dir="ltr" />
                </div>
                <Button onClick={handleUpdateStock} className="w-full">حفظ</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
