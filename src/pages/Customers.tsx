import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, FileBarChart, Users, Phone, MapPin } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useCustomers } from "@/data/hooks";
import type { Customer } from "@/data/types";

const emptyForm: Omit<Customer, "id"> = {
  fullName: "", nationalId: "", phone: "", address: "", governorate: "", jobTitle: "", notes: "",
};

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = customers.filter(
    (c) => c.fullName.includes(search) || c.phone.includes(search) || c.nationalId.includes(search)
  );

  const handleSave = () => {
    if (!formData.fullName || !formData.phone) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateCustomer(editingId, formData);
      toast({ title: "✅ تم التحديث", description: "تم تحديث بيانات العميل بنجاح" });
    } else {
      addCustomer(formData);
      toast({ title: "✅ تمت الإضافة", description: "تم إضافة العميل بنجاح" });
    }
    setFormData(emptyForm);
    setEditingId(null);
    setOpen(false);
  };

  const handleEdit = (customer: Customer) => {
    setFormData({ fullName: customer.fullName, nationalId: customer.nationalId, phone: customer.phone, address: customer.address, governorate: customer.governorate, jobTitle: customer.jobTitle, notes: customer.notes });
    setEditingId(customer.id);
    setOpen(true);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteCustomer(deleteId);
      toast({ title: "✅ تم الحذف", description: "تم حذف العميل بنجاح" });
      setDeleteId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              إدارة العملاء
            </h1>
            <p className="text-sm text-muted-foreground">{customers.length} عميل مسجل</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFormData(emptyForm); setEditingId(null); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />إضافة عميل</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="sm:col-span-2 form-group"><Label>الاسم الكامل *</Label><Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div>
                <div className="form-group"><Label>الرقم القومي</Label><Input value={formData.nationalId} onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })} dir="ltr" /></div>
                <div className="form-group"><Label>الهاتف *</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" /></div>
                <div className="form-group"><Label>المحافظة</Label><Input value={formData.governorate} onChange={(e) => setFormData({ ...formData, governorate: e.target.value })} /></div>
                <div className="form-group"><Label>الوظيفة</Label><Input value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} /></div>
                <div className="sm:col-span-2 form-group"><Label>العنوان</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                <div className="sm:col-span-2 form-group"><Label>ملاحظات</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف أو الرقم القومي..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <ExportButtons data={filtered as any} headers={[{ key: "id", label: "الكود" },{ key: "fullName", label: "الاسم" },{ key: "phone", label: "الهاتف" },{ key: "governorate", label: "المحافظة" },{ key: "jobTitle", label: "الوظيفة" },{ key: "address", label: "العنوان" }]} fileName="العملاء" title="قائمة العملاء" />
        </div>

        {/* Table */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الكود</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الاسم</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الرقم القومي</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الهاتف</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">المحافظة</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">الوظيفة</th>
                  <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-3.5 font-mono text-xs font-semibold text-primary">{c.id}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {c.fullName.charAt(0)}
                        </div>
                        <span className="font-medium">{c.fullName}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-xs" dir="ltr">{c.nationalId || <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3.5" dir="ltr">
                      <span className="inline-flex items-center gap-1 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{c.phone}</span>
                    </td>
                    <td className="p-3.5 hidden md:table-cell">
                      {c.governorate ? <span className="inline-flex items-center gap-1 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" />{c.governorate}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3.5 hidden lg:table-cell text-muted-foreground text-xs">{c.jobTitle || "—"}</td>
                    <td className="p-3.5">
                      <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/customer-report/${c.id}`)} title="تقرير العميل" className="h-8 w-8"><FileBarChart className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>لا توجد نتائج</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء." />
      </div>
    </AppLayout>
  );
}
