import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, FileBarChart } from "lucide-react";
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
      toast({ title: "تم التحديث", description: "تم تحديث بيانات العميل بنجاح" });
    } else {
      addCustomer(formData);
      toast({ title: "تمت الإضافة", description: "تم إضافة العميل بنجاح" });
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
      toast({ title: "تم الحذف", description: "تم حذف العميل بنجاح" });
      setDeleteId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">إدارة العملاء</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFormData(emptyForm); setEditingId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-2" />إضافة عميل</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="col-span-2 space-y-1.5"><Label>الاسم الكامل *</Label><Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الرقم القومي</Label><Input value={formData.nationalId} onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>الهاتف *</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>المحافظة</Label><Input value={formData.governorate} onChange={(e) => setFormData({ ...formData, governorate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الوظيفة</Label><Input value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label>العنوان</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label>ملاحظات</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف أو الرقم القومي..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <ExportButtons data={filtered as any} headers={[{ key: "id", label: "الكود" },{ key: "fullName", label: "الاسم" },{ key: "phone", label: "الهاتف" },{ key: "governorate", label: "المحافظة" },{ key: "jobTitle", label: "الوظيفة" },{ key: "address", label: "العنوان" }]} fileName="العملاء" title="قائمة العملاء" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الهاتف</th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">المحافظة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">الوظيفة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-primary">{c.id}</td>
                      <td className="p-3">{c.fullName}</td>
                      <td className="p-3" dir="ltr">{c.phone}</td>
                      <td className="p-3 hidden md:table-cell">{c.governorate}</td>
                      <td className="p-3 hidden lg:table-cell">{c.jobTitle}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/customer-report/${c.id}`)} title="تقرير العميل"><FileBarChart className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء." />
      </div>
    </AppLayout>
  );
}
