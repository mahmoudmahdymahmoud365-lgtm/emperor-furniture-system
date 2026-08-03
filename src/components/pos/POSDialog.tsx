// ==============================
// POS Dialog — full point-of-sale workflow rendered as an overlay.
// Opens over any page (no route change) and closes back to it.
// ==============================
import { useState, useMemo, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Plus, Minus, Trash2, Search, X, Printer, Package, PackagePlus, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProducts, useInvoices, useReceipts, useCustomers, useCompanySettings, useEmployees, useOffers } from "@/data/hooks";
import InvoicePrint from "@/components/InvoicePrint";
import { usePosDialog, closePOS } from "./posDialogState";
import type { Invoice, InvoiceItem, Product } from "@/data/types";

const PAYMENT_METHODS = ["نقدي", "تحويل بنكي", "فيزا", "فودافون كاش", "إنستاباي", "شيك"];

type CartLine = InvoiceItem & { stockAvailable?: number; isAgency?: boolean; colors?: string[] };

export function POSDialog() {
  const { open, customer: initialCustomer } = usePosDialog();
  const { products, addProduct } = useProducts();
  const { invoices, addInvoice } = useInvoices();
  const { addReceipt } = useReceipts();
  const { customers } = useCustomers();
  const { employees } = useEmployees();
  const { activeOffers } = useOffers();
  const { settings } = useCompanySettings();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");
  const [customerFocus, setCustomerFocus] = useState(false);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState("نقدي");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // New product (created without leaving the POS)
  const [npOpen, setNpOpen] = useState(false);
  const [npName, setNpName] = useState("");
  const [npCategory, setNpCategory] = useState("");
  const [npPrice, setNpPrice] = useState(0);
  const [npUnit, setNpUnit] = useState("قطعة");
  const [npStock, setNpStock] = useState(0);
  const [npAgency, setNpAgency] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomer(initialCustomer || "");
      setCart([]); setPaid(0); setNotes(""); setSearch(""); setShowAll(false);
    }
  }, [open, initialCustomer]);

  // ---- Top 20 best-sellers (by total qty sold) ----
  const top20 = useMemo<Product[]>(() => {
    const counts = new Map<string, number>();
    for (const inv of invoices) {
      for (const it of inv.items || []) {
        counts.set(it.productName, (counts.get(it.productName) || 0) + (it.qty || 0));
      }
    }
    const sorted = [...products]
      .map((p) => ({ p, score: counts.get(p.name) || 0 }))
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
      .slice(0, 20)
      .map((x) => x.p);
    return sorted.length ? sorted : products.slice(0, 20);
  }, [products, invoices]);

  const visibleProducts = useMemo(() => {
    const s = search.trim();
    if (s) return products.filter((p) => p.name.includes(s) || (p.category || "").includes(s));
    return showAll ? products : top20;
  }, [search, showAll, products, top20]);

  const customerSuggestions = useMemo(
    () => customers.filter((c) => !customer || c.fullName.includes(customer)).slice(0, 6),
    [customers, customer]
  );

  const priceFor = (p: Product) => {
    const fixedOffer = activeOffers.find(
      (o) => o.type === "fixed_price" && (!o.productName || o.productName === p.name)
    );
    return fixedOffer ? fixedOffer.value : (p.defaultPrice || 0);
  };

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productName === p.name);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      const hasColors = p.hasColorVariants !== false && (p.colors?.length || 0) > 0;
      return [
        ...prev,
        {
          productName: p.name,
          qty: 1,
          unitPrice: priceFor(p),
          lineDiscount: 0,
          color: hasColors ? (p.colors as string[])[0] : "",
          unit: p.unit || "",
          stockAvailable: p.stock,
          isAgency: p.isAgency,
          colors: hasColors ? p.colors : [],
        },
      ];
    });
  };

  const setQty = (i: number, q: number) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, qty: Math.max(1, q) } : l)));
  const setPrice = (i: number, v: number) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, unitPrice: Math.max(0, v) } : l)));
  const setColor = (i: number, v: string) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, color: v } : l)));
  const removeLine = (i: number) => setCart((c) => c.filter((_, idx) => idx !== i));

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.qty * l.unitPrice - (l.lineDiscount || 0), 0),
    [cart]
  );
  const remaining = Math.max(0, subtotal - paid);
  const change = Math.max(0, paid - subtotal);

  const handleCreateProduct = async () => {
    if (!npName.trim()) return;
    try {
      const created: any = await addProduct({
        name: npName.trim(), category: npCategory, defaultPrice: npPrice, unit: npUnit,
        stock: npStock, minStock: 0, notes: "", colors: [], isAgency: npAgency, hasColorVariants: false,
      } as any);
      toast({ title: "تم إنشاء المنتج", description: npName });
      if (created?.name) addToCart(created as Product);
      setNpOpen(false);
      setNpName(""); setNpCategory(""); setNpPrice(0); setNpUnit("قطعة"); setNpStock(0); setNpAgency(false);
    } catch (e: any) {
      toast({ title: "فشل إنشاء المنتج", description: e?.message || "خطأ غير معروف", variant: "destructive" });
    }
  };

  const doPrint = (inv: Invoice) => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html dir="rtl"><head><title>فاتورة ${inv.id}</title>` +
        `<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">` +
        `<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',sans-serif}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>` +
        `</head><body>${content.innerHTML}</body></html>`
    );
    win.document.close(); win.focus(); win.print(); win.close();
    setPrintInvoice(null);
  };

  const handleSave = async (printAfter: boolean) => {
    if (saving) return;
    if (!customer.trim()) {
      toast({ title: "العميل مطلوب", description: "أدخل اسم العميل قبل الحفظ", variant: "destructive" });
      return;
    }
    if (cart.length === 0) { toast({ title: "السلة فارغة", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const items: InvoiceItem[] = cart.map((l) => ({
        productName: l.productName, qty: l.qty, unitPrice: l.unitPrice,
        lineDiscount: l.lineDiscount || 0, color: l.color, unit: l.unit,
      }));
      const created: Invoice = await addInvoice({
        customer: customer.trim(), branch: "", employee: employee.trim(),
        date: new Date().toISOString().split("T")[0], deliveryDate: "",
        items, status: "مؤكدة", paidTotal: 0, commissionPercent: 0,
        appliedOfferName: "", appliedDiscount: 0, notes,
      });
      if (paid > 0 && created?.id) {
        await addReceipt({
          invoiceId: created.id, customer: customer.trim(),
          amount: Math.min(paid, subtotal), date: new Date().toISOString().split("T")[0],
          method, notes: notes || "دفعة POS",
        });
      }
      toast({
        title: "تم الحفظ",
        description: `فاتورة ${created?.id || ""} — المجموع ${subtotal.toLocaleString()} ج.م${
          change > 0 ? ` — الباقي للعميل ${change.toLocaleString()} ج.م` : ""
        }`,
      });
      if (printAfter && created) {
        setPrintInvoice(created);
        setTimeout(() => { doPrint(created); closePOS(); }, 120);
      } else {
        closePOS();
      }
    } catch (e: any) {
      toast({ title: "فشل الحفظ", description: e?.message || "خطأ غير معروف", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) closePOS(); }}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[94vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-right">
              <ShoppingCart className="h-5 w-5 text-primary" />
              نقطة البيع
            </DialogTitle>
            <DialogDescription className="text-right">
              اختر المنتجات لإضافتها للفاتورة، ثم سجّل الدفع واحفظ.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
            {/* ---------- Products ---------- */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث سريع عن منتج..." className="pr-9" />
                </div>
                <Button variant={showAll ? "default" : "outline"} size="sm" onClick={() => setShowAll((v) => !v)}>
                  <LayoutGrid className="h-4 w-4 ml-1" />
                  {showAll ? "أعلى 20 مبيعاً" : "عرض جميع المنتجات"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setNpName(search); setNpOpen(true); }}>
                  <PackagePlus className="h-4 w-4 ml-1" /> منتج جديد
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {search ? `نتائج البحث (${visibleProducts.length})` : showAll ? `جميع المنتجات (${visibleProducts.length})` : "أكثر 20 منتجاً مبيعاً"}
              </p>

              <ScrollArea className="flex-1 min-h-0 pl-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 pb-4">
                  {visibleProducts.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>لا توجد منتجات مطابقة.</p>
                    </div>
                  )}
                  {visibleProducts.map((p) => {
                    const inCart = cart.find((l) => l.productName === p.name);
                    const lowStock = !p.isAgency && p.stock <= (p.minStock || 0);
                    const colors = p.hasColorVariants !== false ? (p.colors || []) : [];
                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="text-right p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors relative"
                      >
                        {inCart && <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5">{inCart.qty}</Badge>}
                        <div className="font-semibold text-sm line-clamp-2 mb-1">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.category || "—"}</div>
                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                          {p.unit && <Badge variant="secondary" className="text-[10px]">{p.unit}</Badge>}
                          {colors.slice(0, 3).map((c) => (
                            <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                          ))}
                          {colors.length > 3 && <span className="text-[10px] text-muted-foreground">+{colors.length - 3}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-primary font-bold text-sm">{priceFor(p).toLocaleString()} ج.م</span>
                          {p.isAgency ? (
                            <Badge variant="outline" className="text-[10px]">توكيل</Badge>
                          ) : (
                            <span className={`text-[10px] ${lowStock ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                              مخزون: {p.stock}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* ---------- Cart + payment ---------- */}
            <div className="lg:col-span-1 flex flex-col min-h-0 border rounded-lg p-3">
              <div className="space-y-1.5 relative">
                <Label>العميل *</Label>
                <Input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  onFocus={() => setCustomerFocus(true)}
                  onBlur={() => setTimeout(() => setCustomerFocus(false), 150)}
                  placeholder="اسم العميل..."
                />
                {customerFocus && customerSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                    {customerSuggestions.map((c) => (
                      <button key={c.id} className="w-full text-right px-3 py-2 text-sm hover:bg-accent" onMouseDown={() => setCustomer(c.fullName)}>
                        {c.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 mt-2">
                <Label>الموظف (اختياري)</Label>
                <Input list="posdlg-employees" value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="اسم الموظف..." />
                <datalist id="posdlg-employees">
                  {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.name} />)}
                </datalist>
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4" /> السلة ({cart.length})
                </h3>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCart([])} className="h-7 text-destructive">
                    <X className="h-3 w-3 ml-1" /> تفريغ
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 min-h-0 pl-2">
                {cart.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">السلة فارغة. اضغط على منتج لإضافته.</p>
                ) : (
                  <div className="space-y-2 pb-2">
                    {cart.map((line, i) => (
                      <div key={i} className="border rounded-md p-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm flex-1 line-clamp-2">
                            {line.productName}
                            {line.unit && <span className="text-xs text-muted-foreground mr-1">({line.unit})</span>}
                            {line.isAgency && <Badge variant="outline" className="text-[10px] mr-1">توكيل</Badge>}
                          </div>
                          <button onClick={() => removeLine(i)} className="text-destructive hover:text-destructive/80" aria-label="حذف">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(line.colors?.length || 0) > 0 && (
                          <select
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            value={line.color || ""}
                            onChange={(e) => setColor(i, e.target.value)}
                          >
                            {line.colors!.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i, line.qty - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input type="number" value={line.qty} onChange={(e) => setQty(i, Number(e.target.value) || 1)} className="h-7 text-center w-14 px-1" dir="ltr" />
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i, line.qty + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <span className="text-muted-foreground text-xs">×</span>
                          <Input type="number" value={line.unitPrice} onChange={(e) => setPrice(i, Number(e.target.value))} className="h-7 w-20 text-center" dir="ltr" />
                        </div>
                        <div className="text-left text-sm font-bold text-primary">
                          {(line.qty * line.unitPrice).toLocaleString()} ج.م
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator className="my-2" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">المجموع</span>
                  <span className="text-xl font-extrabold text-primary">{subtotal.toLocaleString()} ج.م</span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`text-[11px] p-1.5 rounded-md border transition-colors ${
                        method === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number" value={paid || ""} onChange={(e) => setPaid(Number(e.target.value) || 0)}
                    placeholder="المدفوع" className="h-10 text-center font-bold" dir="ltr"
                  />
                  <Button variant="outline" size="sm" onClick={() => setPaid(subtotal)}>كامل</Button>
                  <Button variant="outline" size="sm" onClick={() => setPaid(0)}>آجل</Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2">
                    <div className="text-muted-foreground">المتبقي</div>
                    <div className="text-base font-bold text-amber-600">{remaining.toLocaleString()}</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2">
                    <div className="text-muted-foreground">الباقي للعميل</div>
                    <div className="text-base font-bold text-emerald-600">{change.toLocaleString()}</div>
                  </div>
                </div>

                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات..." className="h-9" />

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={saving || cart.length === 0} onClick={() => handleSave(false)}>
                    حفظ فقط
                  </Button>
                  <Button className="flex-1" disabled={saving || cart.length === 0} onClick={() => handleSave(true)}>
                    <Printer className="h-4 w-4 ml-2" />
                    {saving ? "جاري الحفظ..." : "حفظ وطباعة"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New product — created without closing the POS */}
      <Dialog open={npOpen} onOpenChange={setNpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة منتج جديد</DialogTitle>
            <DialogDescription className="text-right">سيُحفظ في قاعدة البيانات ويُضاف للسلة مباشرة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>الاسم *</Label><Input value={npName} onChange={(e) => setNpName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>الفئة</Label><Input value={npCategory} onChange={(e) => setNpCategory(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>وحدة القياس</Label><Input value={npUnit} onChange={(e) => setNpUnit(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>السعر</Label><Input type="number" dir="ltr" value={npPrice} onChange={(e) => setNpPrice(Number(e.target.value) || 0)} /></div>
              <div className="space-y-1.5"><Label>المخزون</Label><Input type="number" dir="ltr" value={npStock} onChange={(e) => setNpStock(Number(e.target.value) || 0)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={npAgency} onChange={(e) => setNpAgency(e.target.checked)} />
              منتج توكيل (لا يُخصم من المخزون)
            </label>
            <Button className="w-full" onClick={handleCreateProduct} disabled={!npName.trim()}>حفظ المنتج</Button>
          </div>
        </DialogContent>
      </Dialog>

      {printInvoice && (
        <div style={{ position: "absolute", left: -99999, top: 0 }}>
          <InvoicePrint ref={printRef} invoice={printInvoice as any} settings={settings as any} template="modern" />
        </div>
      )}
    </>
  );
}

export default POSDialog;
