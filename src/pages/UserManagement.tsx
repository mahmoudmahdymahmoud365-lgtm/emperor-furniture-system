import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Plus, Pencil, Trash2, User, Check, X } from "lucide-react";
import { useUsers } from "@/data/hooks";
import { useToast } from "@/hooks/use-toast";
import type { UserAccount, UserRole } from "@/data/types";
import { ROLE_LABELS, DEFAULT_PERMISSIONS } from "@/data/types";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

const emptyForm = { name: "", email: "", password: "", role: "sales" as UserRole, active: true };

export default function UserManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useUsers();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (u: UserAccount) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: u.password, role: u.role, active: u.active });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.email || !form.password) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    if (editing) {
      updateUser(editing.id, form);
      toast({ title: "تم التحديث", description: `تم تحديث المستخدم ${form.name}` });
    } else {
      addUser(form);
      toast({ title: "تم الإضافة", description: `تم إضافة المستخدم ${form.name}` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      if (deleteId === currentUser?.id) {
        toast({ title: "خطأ", description: "لا يمكن حذف المستخدم الحالي", variant: "destructive" });
        return;
      }
      deleteUser(deleteId);
      toast({ title: "تم الحذف", description: "تم حذف المستخدم بنجاح" });
      setDeleteId(null);
    }
  };

  const rolePermissions = DEFAULT_PERMISSIONS;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="page-header">إدارة المستخدمين</h1>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 ml-1" />
            إضافة مستخدم
          </Button>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5" />
              المستخدمون والصلاحيات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">البريد</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الدور</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {u.name}
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">أنت</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground" dir="ltr">{u.email}</td>
                      <td className="p-3">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.active ? (
                          <span className="text-success flex items-center gap-1 text-xs"><Check className="h-3 w-3" />نشط</span>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1 text-xs"><X className="h-3 w-3" />معطل</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(u.id)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">جدول الصلاحيات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-2 font-medium">الصلاحية</th>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <th key={role} className="text-center p-2 font-medium">{ROLE_LABELS[role]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries({
                    dashboard: "لوحة التحكم", customers: "العملاء", products: "المنتجات",
                    invoices: "الفواتير", installments: "الأقساط", employees: "الموظفين",
                    branches: "الفروع", reports: "التقارير", settings: "الإعدادات",
                    auditLog: "سجل العمليات", users: "المستخدمين", backup: "النسخ الاحتياطي",
                  }).map(([key, label]) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="p-2">{label}</td>
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                        <td key={role} className="text-center p-2">
                          {rolePermissions[role][key as keyof typeof rolePermissions.admin] ? (
                            <Check className="h-4 w-4 text-success mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>الاسم</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>كلمة المرور</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>الدور</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} id="active" />
                <Label htmlFor="active">مستخدم نشط</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleSave}>{editing ? "تحديث" : "إضافة"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={handleDelete}
          title="حذف المستخدم"
          description="هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء."
        />
      </div>
    </AppLayout>
  );
}
