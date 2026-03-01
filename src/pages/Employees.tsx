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
import { useEmployees } from "@/data/hooks";

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", branch: "", monthlySalary: 0, role: "مبيعات" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSave = () => {
    if (!form.name) { toast({ title: "خطأ", description: "يرجى إدخال الاسم", variant: "destructive" }); return; }
    if (editingId) { updateEmployee(editingId, { ...form, active: true }); } else { addEmployee({ ...form, active: true }); }
    toast({ title: editingId ? "تم التحديث" : "تمت الإضافة" });
    setForm({ name: "", phone: "", branch: "", monthlySalary: 0, role: "مبيعات" }); setEditingId(null); setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteEmployee(deleteId); toast({ title: "تم الحذف" }); setDeleteId(null); }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="page-header mb-0">إدارة الموظفين</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ name: "", phone: "", branch: "", monthlySalary: 0, role: "مبيعات" }); setEditingId(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة موظف</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "تعديل الموظف" : "إضافة موظف جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5"><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>الفرع</Label><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>المرتب الشهري</Label><Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>الدور الوظيفي</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
            </DialogContent>
          </Dialog>
        </div>

        <ExportButtons data={employees as any} headers={[{ key: "id", label: "الكود" },{ key: "name", label: "الاسم" },{ key: "phone", label: "الهاتف" },{ key: "branch", label: "الفرع" },{ key: "monthlySalary", label: "المرتب الشهري" },{ key: "role", label: "الدور" }]} fileName="الموظفين" title="قائمة الموظفين" />

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الكود</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الهاتف</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الفرع</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">المرتب الشهري</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الدور</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-primary">{e.id}</td>
                      <td className="p-3">{e.name}</td>
                      <td className="p-3" dir="ltr">{e.phone}</td>
                      <td className="p-3">{e.branch}</td>
                      <td className="p-3">{e.monthlySalary.toLocaleString()} ج.م</td>
                      <td className="p-3">{e.role}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setForm({ name: e.name, phone: e.phone, branch: e.branch, monthlySalary: e.monthlySalary, role: e.role }); setEditingId(e.id); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا الموظف؟" />
      </div>
    </AppLayout>
  );
}
