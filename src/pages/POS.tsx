// ==============================
// POS — Quick-sale workflow: Top-20 grid → cart → payment sheet → save+print
// ==============================
import { useState, useMemo, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Plus, Minus, Trash2, Search, X, Printer, CreditCard, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProducts, useInvoices, useReceipts, useCustomers, useCompanySettings, useEmployees } from "@/data/hooks";
import InvoicePrint from "@/components/InvoicePrint";
import type { Invoice, InvoiceItem, Product } from "@/data/types";

const PAYMENT_METHODS = ["نقدي", "تحويل بنكي", "فيزا", "فودافون كاش", "إنستاباي", "شيك"];

type CartLine = InvoiceItem & { stockAvailable?: number; isAgency?: boolean };

export default function POS() {
  const { products } = useProducts();
  const { invoices, addInvoice } = useInvoices();
  const { addReceipt } = useReceipts();
  const { customers } = useCustomers();
  const { employees } = useEmployees();
  const { settings } = useCompanySettings();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");
  const [customerFocus, setCustomerFocus] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState("نقدي");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ---- Top 20 best-sellers (by total qty across all invoices) ----
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
    // If no sales yet, fall back to first 20 products
    return sorted.length ? sorted : products.slice(0, 20);
  }, [products, invoices]);

  const filteredProducts = useMemo(() => {
    const s = search.trim();
    if (!s) return top20;
    return products.filter((p) => p.name.includes(s) || (p.category || "").includes(s)).slice(0, 40);
  }, [search, products, top20]);

  const customerSuggestions = useMemo(
    () => customers.filter((c) => !customer || c.fullName.includes(customer)).slice(0, 6),
    [customers, customer]
  );

  // ---- Cart ops ----
  const addToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productName === p.name);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          productName: p.name,
          qty: 1,
          unitPrice: p.defaultPrice || 0,
          lineDiscount: 0,
          color: (p.colors && p.colors[0]) || "",
          stockAvailable: p.stock,
          isAgency: p.isAgency,
        },
      ];
    });
  };
  const setQty = (i: number, q: number) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, qty: Math.max(1, q) } : l)));
  const setPrice = (i: number, v: number) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, unitPrice: Math.max(0, v) } : l)));
  const removeLine = (i: number) => setCart((c) => c.filter((_, idx) => idx !== i));
  const clearCart = () => setCart([]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.qty * l.unitPrice - (l.lineDiscount || 0), 0),
    [cart]
  );
  const remaining = Math.max(0, subtotal - paid);
  const change = Math.max(0, paid - subtotal);

  // ---- Save & print ----
  const handleSave = async (printAfter: boolean) => {
    if (saving) return; // prevent double-submit
    if (!customer.trim()) {
      toast({ title: "العميل مطلوب", description: "أدخل اسم العميل قبل الحفظ", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "السلة فارغة", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const items: InvoiceItem[] = cart.map((l) => ({
        productName: l.productName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineDiscount: l.lineDiscount || 0,
        color: l.color,
      }));
      const created: Invoice = await addInvoice({
        customer: customer.trim(),
        branch: "",
        employee: employee.trim(),
        date: new Date().toISOString().split("T")[0],
        deliveryDate: "",
        items,
        status: "مؤكدة",
        paidTotal: 0,
        commissionPercent: 0,
        appliedOfferName: "",
        appliedDiscount: 0,
        notes,
      });
      if (paid > 0 && created?.id) {
        await addReceipt({
          invoiceId: created.id,
          customer: customer.trim(),
          amount: Math.min(paid, subtotal),
          date: new Date().toISOString().split("T")[0],
          method,
          notes: notes || "دفعة POS",
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
        setTimeout(() => doPrint(created), 80);
      }
      // Reset
      setCart([]); setPaid(0); setNotes(""); setPaymentOpen(false);
    } catch (e: any) {
      toast({ title: "فشل الحفظ", description: e?.message || "خطأ غير معروف", variant: "destructive" });
    } finally {
      setSaving(false);
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

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
        {/* ---------- Products / Top 20 ---------- */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-primary" />
                نقطة البيع (POS)
              </h1>
              <p className="text-xs text-muted-foreground">
                {search ? `نتائج البحث (${filteredProducts.length})` : "أعلى 20 منتجاً مبيعاً"}
              </p>
            </div>
            <div className="relative w-1/2 max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن منتج..."
                className="pr-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>لا توجد منتجات. أضف منتجات من صفحة المنتجات أولاً.</p>
              </div>
            )}
            {filteredProducts.map((p) => {
              const inCart = cart.find((l) => l.productName === p.name);
              const lowStock = !p.isAgency && p.stock <= (p.minStock || 0);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-right p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors relative group"
                >
                  {inCart && (
                    <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5">{inCart.qty}</Badge>
                  )}
                  <div className="font-semibold text-sm line-clamp-2 mb-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.category || "—"}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-primary font-bold text-sm">
                      {(p.defaultPrice || 0).toLocaleString()} ج.م
                    </span>
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
        </div>

        {/* ---------- Cart ---------- */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-4 space-y-3">
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
                      <button
                        key={c.id}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-accent"
                        onMouseDown={() => setCustomer(c.fullName)}
                      >
                        {c.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>الموظف (اختياري)</Label>
                <Input
                  list="pos-employees"
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  placeholder="اسم الموظف..."
                />
                <datalist id="pos-employees">
                  {employees.filter((e) => e.active).map((e) => (
                    <option key={e.id} value={e.name} />
                  ))}
                </datalist>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  السلة ({cart.length})
                </h3>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 text-destructive">
                    <X className="h-3 w-3 ml-1" /> تفريغ
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[300px] pr-2">
                {cart.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">السلة فارغة. اضغط على منتج لإضافته.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((line, i) => (
                      <div key={i} className="border rounded-md p-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm flex-1 line-clamp-2">{line.productName}</div>
                          <button
                            onClick={() => removeLine(i)}
                            className="text-destructive hover:text-destructive/80"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i, line.qty - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={line.qty}
                            onChange={(e) => setQty(i, Number(e.target.value) || 1)}
                            className="h-7 text-center w-14 px-1"
                            dir="ltr"
                          />
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i, line.qty + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <span className="text-muted-foreground text-xs">×</span>
                          <Input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) => setPrice(i, Number(e.target.value))}
                            className="h-7 w-20 text-center"
                            dir="ltr"
                          />
                        </div>
                        <div className="text-left text-sm font-bold text-primary">
                          {(line.qty * line.unitPrice).toLocaleString()} ج.م
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">المجموع</span>
                <span className="text-2xl font-extrabold text-primary">{subtotal.toLocaleString()} ج.م</span>
              </div>

              <Sheet open={paymentOpen} onOpenChange={setPaymentOpen}>
                <SheetTrigger asChild>
                  <Button className="w-full h-11" disabled={cart.length === 0}>
                    <CreditCard className="h-4 w-4 ml-2" /> التالي للدفع
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:max-w-md flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="text-right">شاشة الدفع</SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto space-y-4 mt-4">
                    {/* Summary */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                      <div className="flex justify-between"><span>العميل:</span><span className="font-semibold">{customer || "—"}</span></div>
                      <div className="flex justify-between"><span>عدد الأصناف:</span><span>{cart.length}</span></div>
                      <Separator className="my-2" />
                      <div className="flex justify-between text-base">
                        <span>المجموع:</span>
                        <span className="font-bold text-primary">{subtotal.toLocaleString()} ج.م</span>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="space-y-2">
                      <Label>طريقة الدفع</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMethod(m)}
                            className={`text-xs p-2 rounded-md border transition-colors ${
                              method === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Paid amount */}
                    <div className="space-y-2">
                      <Label>المبلغ المدفوع</Label>
                      <Input
                        type="number"
                        value={paid || ""}
                        onChange={(e) => setPaid(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="h-12 text-xl text-center font-bold"
                        dir="ltr"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPaid(subtotal)}>المبلغ كاملاً</Button>
                        <Button variant="outline" size="sm" onClick={() => setPaid(Math.round(subtotal / 2))}>النصف</Button>
                        <Button variant="outline" size="sm" onClick={() => setPaid(0)}>صفر (آجل)</Button>
                      </div>
                    </div>

                    {/* Remaining / Change */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">المتبقي</div>
                        <div className="text-lg font-bold text-amber-600">{remaining.toLocaleString()}</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">الباقي للعميل</div>
                        <div className="text-lg font-bold text-emerald-600">{change.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>ملاحظات</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات على الفاتورة..." />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" className="flex-1" disabled={saving} onClick={() => handleSave(false)}>
                      حفظ فقط
                    </Button>
                    <Button className="flex-1" disabled={saving} onClick={() => handleSave(true)}>
                      <Printer className="h-4 w-4 ml-2" />
                      {saving ? "جاري الحفظ..." : "حفظ وطباعة"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden printable area */}
      {printInvoice && (
        <div style={{ position: "absolute", left: -99999, top: 0 }}>
          <div ref={printRef}>
            <InvoicePrint invoice={printInvoice} settings={settings} template="modern" />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
