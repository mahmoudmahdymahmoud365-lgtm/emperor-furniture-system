import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, Package, PackageX, AlertTriangle, History, ArrowUpCircle, ArrowDownCircle, QrCode } from "lucide-react";
import { ProductQRCode } from "@/components/ProductQRCode";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useProducts, useStockMovements, useCompanySettings } from "@/data/hooks";
import { MOVEMENT_TYPE_LABELS } from "@/data/types";
import type { Product } from "@/data/types";

const emptyProduct = { name: "", category: "", defaultPrice: 0, unit: "قطعة", stock: 0, minStock: 0, notes: "", colors: [] as string[], isAgency: false };

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { movements, addManualMovement } = useStockMovements();
  const { settings } = useCompanySettings();
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stockEditOpen, setStockEditOpen] = useState(false);
  const [stockEdit, setStockEdit] = useState<{ id: string; name: string; stock: number; minStock: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [showMovements, setShowMovements] = useState(false);
  const [movementFilter, setMovementFilter] = useState("");
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.name.includes(search) || p.category.includes(search));
    if (filter === "low") list = list.filter(p => p.stock > 0 && p.stock <= p.minStock);
    if (filter === "out") list = list.filter(p => p.stock <= 0);
    return list;
  }, [products, search, filter]);

  const filteredMovements = useMemo(() => {
    if (!movementFilter) return movements.slice(0, 50);
    return movements.filter(m => m.productName.includes(movementFilter) || m.reason.includes(movementFilter)).slice(0, 50);
  }, [movements, movementFilter]);

  const outOfStock = products.filter(p => p.stock <= 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const totalValue = products.reduce((s, p) => s + p.stock * p.defaultPrice, 0);

  const handleSave = () => {
    if (!formData.name) { toast({ title: "خطأ", description: "يرجى إدخال اسم المنتج", variant: "destructive" }); return; }
    if (editingId) { updateProduct(editingId, formData); toast({ title: "تم التحديث" }); }
    else { addProduct(formData); toast({ title: "تمت الإضافة" }); }
    setFormData(emptyProduct); setEditingId(null); setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteProduct(deleteId); toast({ title: "تم الحذف" }); setDeleteId(null); }
  };

  const handleUpdateStock = () => {
    if (!stockEdit) return;
    const product = products.find(p => p.id === stockEdit.id);
    if (product) {
      const diff = stockEdit.stock - product.stock;
      if (diff !== 0) {
        addManualMovement(stockEdit.id, stockEdit.name, diff > 0 ? "in" : "out", Math.abs(diff), "تعديل يدوي");
      }
      if (stockEdit.minStock !== product.minStock) {
        updateProduct(stockEdit.id, { minStock: stockEdit.minStock });
      }
    }
    toast({ title: "تم التحديث", description: "تم تحديث المخزون بنجاح" });
    setStockEditOpen(false); setStockEdit(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              إدارة المنتجات والمخزون
            </h1>
            <p className="text-sm text-muted-foreground">{products.length} منتج — قيمة المخزون: {totalValue.toLocaleString()} ج.م</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowMovements(!showMovements)} className="gap-2">
              <History className="h-4 w-4" />{showMovements ? "إخفاء الحركات" : "سجل الحركات"}
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFormData(emptyProduct); setEditingId(null); } }}>
              <DialogTrigger asChild><Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />إضافة منتج</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="sm:col-span-2 form-group"><Label>اسم المنتج *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="form-group"><Label>الفئة</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
                  <div className="form-group"><Label>وحدة القياس</Label><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} /></div>
                  <div className="form-group"><Label>السعر الافتراضي</Label><Input type="number" value={formData.defaultPrice} onChange={(e) => setFormData({ ...formData, defaultPrice: Number(e.target.value) })} dir="ltr" /></div>
                  <div className="form-group"><Label>الكمية المتاحة</Label><Input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} dir="ltr" /></div>
                  <div className="form-group"><Label>حد أدنى للتنبيه</Label><Input type="number" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })} dir="ltr" /></div>
                  <div className="sm:col-span-2 form-group"><Label>ملاحظات</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                  <div className="sm:col-span-2 form-group">
                    <Label>الألوان المتاحة (مفصولة بفاصلة)</Label>
                    <Input
                      placeholder="أحمر، أزرق، بني..."
                      value={(formData.colors || []).join("، ")}
                      onChange={(e) => setFormData({ ...formData, colors: e.target.value.split(/[,،]/).map(s => s.trim()).filter(Boolean) })}
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      id="isAgency"
                      type="checkbox"
                      checked={!!formData.isAgency}
                      onChange={(e) => setFormData({ ...formData, isAgency: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isAgency" className="cursor-pointer">منتج توكيل (لا يُخصم من المخزون)</Label>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`stat-card cursor-pointer ${filter === "all" ? "ring-2 ring-primary" : ""}`} onClick={() => setFilter("all")}>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">إجمالي المنتجات</p><p className="text-2xl font-bold">{products.length}</p></div>
            </div>
          </div>
          <div className={`stat-card cursor-pointer ${filter === "out" ? "ring-2 ring-destructive" : ""}`} onClick={() => setFilter("out")}>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center"><PackageX className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground">نفد من المخزون</p><p className="text-2xl font-bold text-destructive">{outOfStock}</p></div>
            </div>
          </div>
          <div className={`stat-card cursor-pointer ${filter === "low" ? "ring-2 ring-warning" : ""}`} onClick={() => setFilter("low")}>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-warning/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-warning" /></div>
              <div><p className="text-xs text-muted-foreground">مخزون منخفض</p><p className="text-2xl font-bold text-warning">{lowStock}</p></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-success/10 flex items-center justify-center"><Package className="h-5 w-5 text-success" /></div>
              <div><p className="text-xs text-muted-foreground">قيمة المخزون</p><p className="text-xl font-bold">{totalValue.toLocaleString()} ج.م</p></div>
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        {(outOfStock > 0 || lowStock > 0) && (
          <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">تنبيهات المخزون</span>
            </div>
            <div className="space-y-1.5 text-sm">
              {products.filter(p => p.stock <= 0).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-destructive"><PackageX className="h-3.5 w-3.5" /><span><strong>{p.name}</strong> — نفد من المخزون</span></div>
              ))}
              {products.filter(p => p.stock > 0 && p.stock <= p.minStock).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-warning"><AlertTriangle className="h-3.5 w-3.5" /><span><strong>{p.name}</strong> — متبقي {p.stock} {p.unit} (الحد الأدنى: {p.minStock})</span></div>
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

        {/* Products Table */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الكود</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">المنتج</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الفئة</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">السعر</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">الوحدة</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">المخزون</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحد الأدنى</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">قيمة المخزون</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const status = p.stock <= 0 ? "نفد" : p.stock <= p.minStock ? "منخفض" : "متاح";
                  const statusClass = p.stock <= 0 ? "bg-destructive/10 text-destructive" : p.stock <= p.minStock ? "bg-warning/10 text-warning" : "bg-success/10 text-success";
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-3.5 font-mono text-xs font-semibold text-primary">{p.id}</td>
                      <td className="p-3.5 font-medium">{p.name}</td>
                      <td className="p-3.5"><span className="badge-status bg-secondary text-secondary-foreground">{p.category || "—"}</span></td>
                      <td className="p-3.5 font-medium" dir="ltr">{p.defaultPrice.toLocaleString()} ج.م</td>
                      <td className="p-3.5 hidden md:table-cell text-muted-foreground">{p.unit}</td>
                      <td className="p-3.5"><span className={`badge-status ${statusClass}`}>{p.stock} {p.unit} — {status}</span></td>
                      <td className="p-3.5 text-muted-foreground">{p.minStock}</td>
                      <td className="p-3.5 hidden lg:table-cell font-medium">{(p.stock * p.defaultPrice).toLocaleString()} ج.م</td>
                      <td className="p-3.5">
                        <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" title="رمز QR" onClick={() => { setQrProduct(p); setQrOpen(true); }} className="h-8 w-8"><QrCode className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="تعديل المخزون" onClick={() => { setStockEdit({ id: p.id, name: p.name, stock: p.stock, minStock: p.minStock }); setStockEditOpen(true); }} className="h-8 w-8"><Package className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setFormData(p); setEditingId(p.id); setOpen(true); }} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (<tr><td colSpan={9} className="p-12 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>لا توجد نتائج</p>
                </td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Movement Log */}
        {showMovements && (
          <div className="section-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2"><History className="h-4 w-4 text-primary" />سجل حركات المخزون</h3>
              <div className="relative max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث في الحركات..." value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)} className="pr-10 h-8 text-sm" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">التاريخ</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">المنتج</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">النوع</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الكمية</th>
                    <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 text-xs text-muted-foreground">{new Date(m.date).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="p-3.5 font-medium">{m.productName}</td>
                      <td className="p-3.5">
                        <span className={`badge-status ${m.type === "in" || m.type === "return" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {m.type === "in" || m.type === "return" ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                          {MOVEMENT_TYPE_LABELS[m.type]}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium">{m.type === "in" || m.type === "return" ? "+" : "-"}{m.qty}</td>
                      <td className="p-3.5 text-muted-foreground text-xs">{m.reason}</td>
                    </tr>
                  ))}
                  {filteredMovements.length === 0 && (<tr><td colSpan={5} className="p-12 text-center text-muted-foreground">لا توجد حركات مخزون</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Stock Dialog */}
        <Dialog open={stockEditOpen} onOpenChange={(v) => { setStockEditOpen(v); if (!v) setStockEdit(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>تعديل المخزون</DialogTitle></DialogHeader>
            {stockEdit && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm font-medium">{stockEdit.name}</div>
                <div className="space-y-1.5"><Label>الكمية المتاحة</Label><Input type="number" value={stockEdit.stock} onChange={(e) => setStockEdit({ ...stockEdit, stock: Number(e.target.value) })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>حد أدنى للتنبيه</Label><Input type="number" value={stockEdit.minStock} onChange={(e) => setStockEdit({ ...stockEdit, minStock: Number(e.target.value) })} dir="ltr" /></div>
                <Button onClick={handleUpdateStock} className="w-full">حفظ</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا المنتج؟" />
        <ProductQRCode product={qrProduct} open={qrOpen} onOpenChange={setQrOpen} companyName={settings.name} />
      </div>
    </AppLayout>
  );
}
