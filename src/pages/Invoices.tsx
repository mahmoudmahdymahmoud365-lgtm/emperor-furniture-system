import { useState, useRef, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Printer, Edit, DollarSign, PackagePlus, Search, Tag } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import InvoicePrint from "@/components/InvoicePrint";
import { useInvoices, useCustomers, useEmployees, useProducts, useBranches, useReceipts, useCompanySettings, useOffers } from "@/data/hooks";
import type { InvoiceItem, Invoice } from "@/data/types";

const PAYMENT_METHODS = ["نقدي", "تحويل بنكي", "فيزا", "فودافون كاش", "إنستاباي", "شيك"];
const STATUSES = ["مسودة", "مؤكدة", "تم التسليم", "مغلقة"];

const calcLineTotal = (item: InvoiceItem) => item.qty * item.unitPrice - item.lineDiscount;
const calcTotal = (items: InvoiceItem[]) => items.reduce((sum, item) => sum + calcLineTotal(item), 0);

const statusColors: Record<string, string> = {
  "مسودة": "bg-muted text-muted-foreground",
  "مؤكدة": "bg-info/10 text-info",
  "تم التسليم": "bg-success/10 text-success",
  "مغلقة": "bg-muted text-muted-foreground",
};

export default function Invoices() {
  const { invoices, addInvoice, updateInvoice, deleteInvoice } = useInvoices();
  const { customers, lastAddedCustomer } = useCustomers();
  const { employees } = useEmployees();
  const { products, addProduct } = useProducts();
  const { branches } = useBranches();
  const { addReceipt } = useReceipts();
  const { settings } = useCompanySettings();
  const { activeOffers } = useOffers();

  const [selectedOfferId, setSelectedOfferId] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState("");
  const [employee, setEmployee] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ productName: "", qty: 1, unitPrice: 0, lineDiscount: 0 }]);
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("نقدي");
  const [payNotes, setPayNotes] = useState("");

  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [newProductUnit, setNewProductUnit] = useState("قطعة");
  const [newProductNotes, setNewProductNotes] = useState("");
  const [newProductItemIdx, setNewProductItemIdx] = useState<number>(0);

  const [customerFocus, setCustomerFocus] = useState(false);
  const [employeeFocus, setEmployeeFocus] = useState(false);
  const [branchFocus, setBranchFocus] = useState(false);
  const [productFocusIdx, setProductFocusIdx] = useState<number | null>(null);
  const [payMethodFocus, setPayMethodFocus] = useState(false);

  const customerSuggestions = useMemo(() => {
    const list = customers.map(c => c.fullName);
    if (lastAddedCustomer && list.includes(lastAddedCustomer)) {
      return [lastAddedCustomer, ...list.filter(n => n !== lastAddedCustomer)];
    }
    return list;
  }, [customers, lastAddedCustomer]);

  const filteredCustomers = customerSuggestions.filter(n => n.includes(customer));
  const filteredEmployees = employees.filter(e => e.active && e.name.includes(employee)).map(e => e.name);
  const activeBranches = branches.filter(b => b.active).map(b => b.name);
  const filteredBranches = activeBranches.filter(n => n.includes(branch));

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = !search || inv.id.includes(search) || inv.customer.includes(search) || inv.employee.includes(search);
      const matchStatus = !filterStatus || inv.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, filterStatus]);

  const handlePrint = (inv: Invoice) => {
    setPrintInvoice(inv);
    setTimeout(() => {
      const content = printRef.current;
      if (!content) return;
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`<html dir="rtl"><head><title>فاتورة ${inv.id}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Cairo', sans-serif; } @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }</style></head><body>${content.innerHTML}</body></html>`);
      win.document.close(); win.focus(); win.print(); win.close();
      setPrintInvoice(null);
    }, 100);
  };

  const addItem = () => setItems([...items, { productName: "", qty: 1, unitPrice: 0, lineDiscount: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof InvoiceItem, value: string | number) =>
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const selectProduct = (i: number, productName: string) => {
    const p = products.find(pr => pr.name === productName);
    setItems(items.map((item, idx) => idx === i ? { ...item, productName, unitPrice: p?.defaultPrice || item.unitPrice } : item));
    setProductFocusIdx(null);
  };

  const selectedOffer = activeOffers.find(o => o.id === selectedOfferId) || null;

  const calcOfferDiscount = () => {
    if (!selectedOffer) return 0;
    const subtotal = calcTotal(items);
    if (selectedOffer.type === "fixed") return selectedOffer.value;
    // percentage or timed
    return Math.round(subtotal * selectedOffer.value / 100);
  };

  const offerDiscount = calcOfferDiscount();
  const finalTotal = calcTotal(items) - offerDiscount;

  const resetForm = () => {
    setCustomer(""); setBranch(""); setEmployee(""); setCommissionPercent(0); setDeliveryDate("");
    setItems([{ productName: "", qty: 1, unitPrice: 0, lineDiscount: 0 }]);
    setEditingId(null); setSelectedOfferId("");
  };

  const handleEdit = (inv: Invoice) => {
    setEditingId(inv.id); setCustomer(inv.customer); setBranch(inv.branch);
    setEmployee(inv.employee); setCommissionPercent(inv.commissionPercent);
    setDeliveryDate(inv.deliveryDate || "");
    setItems([...inv.items]); setOpen(true);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteInvoice(deleteId); toast({ title: "تم الحذف", description: "تم حذف الفاتورة بنجاح" }); setDeleteId(null); }
  };

  const handleStatusChange = (invId: string, newStatus: string) => {
    updateInvoice(invId, { status: newStatus });
    toast({ title: "تم التحديث", description: `تم تغيير حالة الفاتورة إلى "${newStatus}"` });
  };

  const handleSave = () => {
    if (!customer || items.some((i) => !i.productName)) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" }); return;
    }
    if (editingId) {
      updateInvoice(editingId, { customer, branch, employee, items: [...items], commissionPercent, deliveryDate });
      toast({ title: "تم التحديث", description: "تم تحديث الفاتورة بنجاح" });
    } else {
      addInvoice({ customer, branch, employee, date: new Date().toISOString().split("T")[0], deliveryDate, items: [...items], status: "مسودة", paidTotal: 0, commissionPercent, appliedOfferName: selectedOffer?.name || "", appliedDiscount: offerDiscount || 0 });
      toast({ title: "تمت الإضافة", description: "تم إنشاء الفاتورة بنجاح" });
    }
    resetForm(); setOpen(false);
  };

  const handlePay = () => {
    if (!payInvoice || !payAmount) return;
    const payTotal = calcTotal(payInvoice.items) - (payInvoice.appliedDiscount || 0);
    const remaining = payTotal - payInvoice.paidTotal;
    if (payAmount > remaining) {
      toast({ title: "خطأ", description: `المبلغ أكبر من المتبقي (${remaining.toLocaleString()} ج.م)`, variant: "destructive" }); return;
    }
    addReceipt({ invoiceId: payInvoice.id, customer: payInvoice.customer, amount: payAmount, date: new Date().toISOString().split("T")[0], method: payMethod, notes: payNotes });
    toast({ title: "تم الدفع", description: `تم تسجيل دفعة ${payAmount.toLocaleString()} ج.م` });
    setPayOpen(false); setPayInvoice(null); setPayAmount(0); setPayMethod("نقدي"); setPayNotes("");
  };

  const handleAddNewProduct = () => {
    if (!newProductName) return;
    addProduct({ name: newProductName, category: newProductCategory, defaultPrice: newProductPrice, unit: newProductUnit, notes: newProductNotes });
    selectProduct(newProductItemIdx, newProductName);
    setNewProductOpen(false); setNewProductName(""); setNewProductCategory(""); setNewProductPrice(0); setNewProductUnit("قطعة"); setNewProductNotes("");
    toast({ title: "تمت الإضافة", description: "تم إضافة المنتج الجديد وحفظه" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">فواتير المبيعات</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />فاتورة جديدة</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "تعديل الفاتورة" : "إنشاء فاتورة جديدة"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {/* Customer */}
                <div className="space-y-1.5 relative">
                  <Label>العميل *</Label>
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} onFocus={() => setCustomerFocus(true)} onBlur={() => setTimeout(() => setCustomerFocus(false), 200)} />
                  {customerFocus && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {filteredCustomers.map((name, i) => (
                        <button key={i} className={`w-full text-right px-3 py-2 text-sm hover:bg-accent ${i === 0 && name === lastAddedCustomer ? "font-bold text-primary" : ""}`} onMouseDown={() => setCustomer(name)}>
                          {name} {i === 0 && name === lastAddedCustomer && <span className="text-xs text-muted-foreground">(آخر عميل)</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Branch */}
                <div className="space-y-1.5 relative">
                  <Label>الفرع</Label>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} onFocus={() => setBranchFocus(true)} onBlur={() => setTimeout(() => setBranchFocus(false), 200)} />
                  {branchFocus && filteredBranches.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {filteredBranches.map((name, i) => (
                        <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent" onMouseDown={() => setBranch(name)}>{name}</button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Employee */}
                <div className="space-y-1.5 relative">
                  <Label>الموظف</Label>
                  <Input value={employee} onChange={(e) => setEmployee(e.target.value)} onFocus={() => setEmployeeFocus(true)} onBlur={() => setTimeout(() => setEmployeeFocus(false), 200)} />
                  {employeeFocus && filteredEmployees.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {filteredEmployees.map((name, i) => (
                        <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent" onMouseDown={() => setEmployee(name)}>{name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5"><Label>نسبة العمولة %</Label><Input type="number" value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} dir="ltr" /></div>
              </div>

              {/* Delivery Date */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-1.5">
                  <Label>تاريخ التسليم المتوقع</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} dir="ltr" />
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">بنود الفاتورة</h3>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 ml-1" />إضافة بند</Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, i) => {
                    const fp = products.filter(p => p.name.includes(item.productName));
                    return (
                      <div key={i} className="grid grid-cols-5 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                        <div className="space-y-1 relative">
                          <Label className="text-xs">المنتج</Label>
                          <Input value={item.productName} onChange={(e) => updateItem(i, "productName", e.target.value)} onFocus={() => setProductFocusIdx(i)} onBlur={() => setTimeout(() => setProductFocusIdx(null), 200)} className="text-sm" />
                          {productFocusIdx === i && (
                            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                              {fp.map((p, pi) => (
                                <button key={pi} className="w-full text-right px-3 py-2 text-sm hover:bg-accent" onMouseDown={() => selectProduct(i, p.name)}>
                                  {p.name} <span className="text-xs text-muted-foreground">({p.defaultPrice.toLocaleString()} ج.م)</span>
                                </button>
                              ))}
                              <button className="w-full text-right px-3 py-2 text-sm hover:bg-accent text-primary font-medium border-t" onMouseDown={() => { setNewProductItemIdx(i); setNewProductName(item.productName); setNewProductOpen(true); }}>
                                <PackagePlus className="h-3 w-3 inline ml-1" />إضافة منتج جديد
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1"><Label className="text-xs">الكمية</Label><Input type="number" value={item.qty} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} dir="ltr" className="text-sm" /></div>
                        <div className="space-y-1"><Label className="text-xs">السعر</Label><Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))} dir="ltr" className="text-sm" /></div>
                        <div className="space-y-1"><Label className="text-xs">الخصم</Label><Input type="number" value={item.lineDiscount} onChange={(e) => updateItem(i, "lineDiscount", Number(e.target.value))} dir="ltr" className="text-sm" /></div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium whitespace-nowrap">{calcLineTotal(item).toLocaleString()}</span>
                          {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive h-8 w-8"><Trash2 className="h-3 w-3" /></Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Offer selector */}
                {activeOffers.length > 0 && (
                  <div className="mt-4 p-3 border border-dashed border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <Label className="font-semibold text-primary">تطبيق عرض / خصم</Label>
                    </div>
                    <select
                      value={selectedOfferId}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">بدون عرض</option>
                      {activeOffers.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name} — {o.type === "fixed" ? `${o.value.toLocaleString()} ج.م` : `${o.value}%`} {o.productName ? `(${o.productName})` : "(الكل)"}
                        </option>
                      ))}
                    </select>
                    {selectedOffer && (
                      <div className="mt-2 text-sm text-primary font-medium">
                        خصم: {offerDiscount.toLocaleString()} ج.م
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end mt-4 p-3 bg-primary/5 rounded-lg">
                  <div className="text-left space-y-1">
                    <div>
                      <span className="text-muted-foreground text-sm">المجموع: </span>
                      <span className={`text-sm font-semibold ${selectedOffer ? "line-through text-muted-foreground" : "text-xl text-primary"}`}>{calcTotal(items).toLocaleString()} ج.م</span>
                    </div>
                    {selectedOffer && (
                      <div>
                        <span className="text-muted-foreground text-sm">بعد الخصم: </span>
                        <span className="text-xl font-bold text-primary">{finalTotal.toLocaleString()} ج.م</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث الفاتورة" : "حفظ الفاتورة"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالرقم أو العميل أو الموظف..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">كل الحالات</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ExportButtons
            data={filteredInvoices.map((inv) => {
              const total = calcTotal(inv.items);
              return { id: inv.id, customer: inv.customer, date: inv.date, deliveryDate: inv.deliveryDate || "-", total, commissionPercent: inv.commissionPercent + "%", paidTotal: inv.paidTotal, remaining: total - inv.paidTotal, status: inv.status };
            })}
            headers={[
              { key: "id", label: "رقم الفاتورة" }, { key: "customer", label: "العميل" }, { key: "date", label: "التاريخ" },
              { key: "deliveryDate", label: "تاريخ التسليم" },
              { key: "total", label: "الإجمالي" }, { key: "commissionPercent", label: "العمولة %" },
              { key: "paidTotal", label: "المدفوع" }, { key: "remaining", label: "المتبقي" }, { key: "status", label: "الحالة" },
            ]}
            fileName="الفواتير" title="فواتير المبيعات"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">التاريخ</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">التسليم</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الإجمالي</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الخصم/العرض</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">العمولة %</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">مبلغ العمولة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المدفوع</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المتبقي</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const subtotal = calcTotal(inv.items);
                    const discount = inv.appliedDiscount || 0;
                    const total = subtotal - discount;
                    const commissionAmount = total * (inv.commissionPercent / 100);
                    const remaining = total - inv.paidTotal;
                    return (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-primary">{inv.id}</td>
                        <td className="p-3">{inv.customer}</td>
                        <td className="p-3">{inv.date}</td>
                        <td className="p-3 text-xs">{inv.deliveryDate || "-"}</td>
                        <td className="p-3">{total.toLocaleString()} ج.م</td>
                        <td className="p-3 text-xs">
                          {inv.appliedOfferName ? (
                            <span className="text-primary font-medium">{inv.appliedOfferName} ({discount.toLocaleString()} ج.م)</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3">{inv.commissionPercent}%</td>
                        <td className="p-3 font-semibold" style={{ color: "hsl(30, 90%, 50%)" }}>{commissionAmount.toLocaleString()} ج.م</td>
                        <td className="p-3 text-success">{inv.paidTotal.toLocaleString()} ج.م</td>
                        <td className="p-3 text-destructive">{remaining.toLocaleString()} ج.م</td>
                        <td className="p-3">
                          <select
                            className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${statusColors[inv.status] || ""}`}
                            value={inv.status}
                            onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {remaining > 0 && (
                              <Button variant="ghost" size="icon" onClick={() => { setPayInvoice(inv); setPayOpen(true); }} title="دفع"><DollarSign className="h-4 w-4 text-success" /></Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(inv)} title="تعديل"><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handlePrint(inv)} title="طباعة"><Printer className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(inv.id)} title="حذف" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInvoices.length === 0 && (
                    <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={payOpen} onOpenChange={(v) => { setPayOpen(v); if (!v) { setPayInvoice(null); setPayAmount(0); setPayMethod("نقدي"); setPayNotes(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>تسجيل دفعة — {payInvoice?.id}</DialogTitle></DialogHeader>
            {payInvoice && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between"><span>العميل:</span><span className="font-medium">{payInvoice.customer}</span></div>
                  <div className="flex justify-between"><span>الإجمالي:</span><span>{calcTotal(payInvoice.items).toLocaleString()} ج.م</span></div>
                  <div className="flex justify-between"><span>المدفوع:</span><span className="text-success">{payInvoice.paidTotal.toLocaleString()} ج.م</span></div>
                  <div className="flex justify-between font-bold"><span>المتبقي:</span><span className="text-destructive">{(calcTotal(payInvoice.items) - payInvoice.paidTotal).toLocaleString()} ج.م</span></div>
                </div>
                <div className="space-y-1.5"><Label>المبلغ *</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} dir="ltr" /></div>
                <div className="space-y-1.5 relative">
                  <Label>طريقة الدفع</Label>
                  <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} onFocus={() => setPayMethodFocus(true)} onBlur={() => setTimeout(() => setPayMethodFocus(false), 200)} />
                  {payMethodFocus && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {PAYMENT_METHODS.filter(m => m.includes(payMethod)).map((m, i) => (
                        <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent" onMouseDown={() => setPayMethod(m)}>{m}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5"><Label>ملاحظات</Label><Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} /></div>
                <Button onClick={handlePay} className="w-full">تسجيل الدفعة</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New Product Dialog */}
        <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>إضافة منتج جديد</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1.5"><Label>اسم المنتج *</Label><Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>الفئة</Label><Input value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>وحدة القياس</Label><Input value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>السعر الافتراضي</Label><Input type="number" value={newProductPrice} onChange={(e) => setNewProductPrice(Number(e.target.value))} dir="ltr" /></div>
              <div className="space-y-1.5"><Label>ملاحظات</Label><Input value={newProductNotes} onChange={(e) => setNewProductNotes(e.target.value)} /></div>
              <Button onClick={handleAddNewProduct} className="w-full">إضافة المنتج وحفظه</Button>
            </div>
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذه الفاتورة؟ سيتم حذف جميع بياناتها." />

        <div className="hidden">
          {printInvoice && <InvoicePrint ref={printRef} invoice={printInvoice} settings={settings} />}
        </div>
      </div>
    </AppLayout>
  );
}
