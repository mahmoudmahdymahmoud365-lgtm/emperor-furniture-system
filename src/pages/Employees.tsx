import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Clock, CalendarCheck, Search, Users, Timer } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useEmployees, useShifts, useAttendance, useBranches } from "@/data/hooks";
import type { AttendanceStatus } from "@/data/types";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/data/types";

const emptyForm = { name: "", nationalId: "", phone: "", branch: "", monthlySalary: 0, role: "مبيعات" };
const emptyShiftForm = { name: "", startTime: "08:00", endTime: "16:00", hours: 8, branch: "", active: true, notes: "" };

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { shifts, addShift, updateShift, deleteShift } = useShifts();
  const { attendance, addAttendance, deleteAttendance } = useAttendance();
  const { branches } = useBranches();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);

  const [attOpen, setAttOpen] = useState(false);
  const [attForm, setAttForm] = useState({
    employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0],
    checkIn: "", checkOut: "", status: "present" as AttendanceStatus, notes: "",
  });
  const [attSearch, setAttSearch] = useState("");
  const [deleteAttId, setDeleteAttId] = useState<string | null>(null);

  const filteredEmployees = useMemo(() =>
    employees.filter(e => !empSearch || e.name.includes(empSearch) || e.phone.includes(empSearch) || e.branch.includes(empSearch)),
    [employees, empSearch]
  );

  const filteredAttendance = useMemo(() =>
    attendance.filter(a => !attSearch || a.employeeName.includes(attSearch) || a.shiftName.includes(attSearch) || a.date.includes(attSearch)),
    [attendance, attSearch]
  );

  const handleSave = () => {
    if (!form.name) { toast({ title: "خطأ", description: "يرجى إدخال الاسم", variant: "destructive" }); return; }
    if (editingId) { updateEmployee(editingId, { ...form, active: true }); } else { addEmployee({ ...form, active: true }); }
    toast({ title: editingId ? "✅ تم التحديث" : "✅ تمت الإضافة" });
    setForm(emptyForm); setEditingId(null); setOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) { deleteEmployee(deleteId); toast({ title: "✅ تم الحذف" }); setDeleteId(null); }
  };

  const handleShiftSave = () => {
    if (!shiftForm.name) { toast({ title: "خطأ", description: "يرجى إدخال اسم الشفت", variant: "destructive" }); return; }
    const hours = calcHours(shiftForm.startTime, shiftForm.endTime);
    if (editingShiftId) { updateShift(editingShiftId, { ...shiftForm, hours }); }
    else { addShift({ ...shiftForm, hours }); }
    toast({ title: editingShiftId ? "✅ تم التحديث" : "✅ تمت الإضافة" });
    setShiftForm(emptyShiftForm); setEditingShiftId(null); setShiftOpen(false);
  };

  const confirmDeleteShift = () => {
    if (deleteShiftId) { deleteShift(deleteShiftId); toast({ title: "✅ تم الحذف" }); setDeleteShiftId(null); }
  };

  const handleAttSave = () => {
    if (!attForm.employeeId || !attForm.date) {
      toast({ title: "خطأ", description: "يرجى اختيار الموظف والتاريخ", variant: "destructive" }); return;
    }
    const emp = employees.find(e => e.id === attForm.employeeId);
    const shift = shifts.find(s => s.id === attForm.shiftId);
    const hoursWorked = attForm.checkIn && attForm.checkOut ? calcHours(attForm.checkIn, attForm.checkOut) : 0;
    const overtimeHours = shift ? Math.max(0, hoursWorked - shift.hours) : 0;

    addAttendance({
      employeeId: attForm.employeeId, employeeName: emp?.name || "",
      shiftId: attForm.shiftId, shiftName: shift?.name || "-",
      date: attForm.date, checkIn: attForm.checkIn, checkOut: attForm.checkOut,
      hoursWorked, status: attForm.status, overtimeHours, notes: attForm.notes,
    });
    toast({ title: "✅ تم التسجيل", description: `تم تسجيل حضور ${emp?.name}` });
    setAttForm({ employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0], checkIn: "", checkOut: "", status: "present", notes: "" });
    setAttOpen(false);
  };

  const confirmDeleteAtt = () => {
    if (deleteAttId) { deleteAttendance(deleteAttId); toast({ title: "✅ تم الحذف" }); setDeleteAttId(null); }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === "present" || a.status === "late").length;
  const absentToday = todayAttendance.filter(a => a.status === "absent").length;
  const totalSalaries = employees.filter(e => e.active).reduce((s, e) => s + e.monthlySalary, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            إدارة الموظفين
          </h1>
          <p className="text-sm text-muted-foreground">{employees.length} موظف — إجمالي المرتبات: {totalSalaries.toLocaleString()} ج.م</p>
        </div>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="employees" className="flex items-center gap-2"><Users className="h-4 w-4" />الموظفين</TabsTrigger>
            <TabsTrigger value="shifts" className="flex items-center gap-2"><Clock className="h-4 w-4" />الشفتات</TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" />الحضور والانصراف</TabsTrigger>
          </TabsList>

          {/* ===== EMPLOYEES TAB ===== */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم أو الهاتف أو الفرع..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="pr-10" />
              </div>
              <div className="flex gap-2">
                <ExportButtons data={filteredEmployees as any} headers={[{ key: "id", label: "الكود" }, { key: "name", label: "الاسم" }, { key: "nationalId", label: "الرقم القومي" }, { key: "phone", label: "الهاتف" }, { key: "branch", label: "الفرع" }, { key: "monthlySalary", label: "المرتب" }, { key: "role", label: "الدور" }]} fileName="الموظفين" title="الموظفين" />
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditingId(null); } }}>
                  <DialogTrigger asChild><Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />إضافة موظف</Button></DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editingId ? "تعديل الموظف" : "إضافة موظف جديد"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="form-group"><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                      <div className="form-group"><Label>الرقم القومي</Label><Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" /></div>
                      <div className="form-group"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
                      <div className="form-group">
                        <Label>الفرع</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                          <option value="">اختر الفرع</option>
                          {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group"><Label>المرتب الشهري</Label><Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })} dir="ltr" /></div>
                      <div className="form-group"><Label>الدور الوظيفي</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
                    </div>
                    <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الكود</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الاسم</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">الرقم القومي</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الهاتف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الفرع</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">المرتب</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">الدور</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-3.5 font-mono text-xs font-semibold text-primary">{e.id}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {e.name.charAt(0)}
                            </div>
                            <span className="font-medium">{e.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 hidden md:table-cell font-mono text-xs" dir="ltr">{e.nationalId || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3.5 text-xs" dir="ltr">{e.phone}</td>
                        <td className="p-3.5"><span className="badge-status bg-secondary text-secondary-foreground">{e.branch || "—"}</span></td>
                        <td className="p-3.5 font-medium">{e.monthlySalary.toLocaleString()} ج.م</td>
                        <td className="p-3.5 hidden lg:table-cell text-muted-foreground text-xs">{e.role}</td>
                        <td className="p-3.5">
                          <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setForm({ name: e.name, nationalId: e.nationalId || "", phone: e.phone, branch: e.branch, monthlySalary: e.monthlySalary, role: e.role }); setEditingId(e.id); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>لا توجد نتائج</p>
                    </td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ===== SHIFTS TAB ===== */}
          <TabsContent value="shifts" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">إدارة الشفتات وساعات العمل لكل فرع</p>
              <Dialog open={shiftOpen} onOpenChange={(v) => { setShiftOpen(v); if (!v) { setShiftForm(emptyShiftForm); setEditingShiftId(null); } }}>
                <DialogTrigger asChild><Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />إضافة شفت</Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>{editingShiftId ? "تعديل الشفت" : "إضافة شفت جديد"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="form-group"><Label>اسم الشفت *</Label><Input value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} placeholder="مثال: صباحي، مسائي" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group"><Label>وقت البداية</Label><Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} dir="ltr" /></div>
                      <div className="form-group"><Label>وقت النهاية</Label><Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} dir="ltr" /></div>
                    </div>
                    <div className="form-group"><Label>عدد الساعات (تلقائي)</Label><Input value={calcHours(shiftForm.startTime, shiftForm.endTime)} readOnly className="bg-muted" dir="ltr" /></div>
                    <div className="form-group">
                      <Label>الفرع</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={shiftForm.branch} onChange={(e) => setShiftForm({ ...shiftForm, branch: e.target.value })}>
                        <option value="">كل الفروع</option>
                        {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><Label>ملاحظات</Label><Input value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} /></div>
                  </div>
                  <Button onClick={handleShiftSave} className="w-full mt-4">{editingShiftId ? "تحديث" : "حفظ"}</Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shifts.map(s => (
                <div key={s.id} className={`section-card p-5 ${!s.active ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Timer className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">{s.branch || "كل الفروع"}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShiftForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, hours: s.hours, branch: s.branch, active: s.active, notes: s.notes }); setEditingShiftId(s.id); setShiftOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteShiftId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">من</span><span dir="ltr" className="font-medium">{s.startTime}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">إلى</span><span dir="ltr" className="font-medium">{s.endTime}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">عدد الساعات</span><span className="font-bold text-primary">{s.hours} ساعة</span></div>
                  </div>
                </div>
              ))}
              {shifts.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                لا توجد شفتات مُعرّفة بعد
              </p>}
            </div>
          </TabsContent>

          {/* ===== ATTENDANCE TAB ===== */}
          <TabsContent value="attendance" className="space-y-4">
            {/* Summary cards */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              <div className="stat-card text-center">
                <p className="text-2xl font-bold text-primary">{employees.length}</p>
                <p className="text-xs text-muted-foreground">إجمالي الموظفين</p>
              </div>
              <div className="stat-card text-center">
                <p className="text-2xl font-bold text-success">{presentToday}</p>
                <p className="text-xs text-muted-foreground">حاضرون اليوم</p>
              </div>
              <div className="stat-card text-center">
                <p className="text-2xl font-bold text-destructive">{absentToday}</p>
                <p className="text-xs text-muted-foreground">غائبون اليوم</p>
              </div>
              <div className="stat-card text-center">
                <p className="text-2xl font-bold">{todayAttendance.length}</p>
                <p className="text-xs text-muted-foreground">سجلات اليوم</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم أو التاريخ أو الشفت..." value={attSearch} onChange={(e) => setAttSearch(e.target.value)} className="pr-10" />
              </div>
              <Dialog open={attOpen} onOpenChange={(v) => { setAttOpen(v); if (!v) setAttForm({ employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0], checkIn: "", checkOut: "", status: "present", notes: "" }); }}>
                <DialogTrigger asChild><Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />تسجيل حضور</Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>تسجيل حضور وانصراف</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="form-group">
                      <Label>الموظف *</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={attForm.employeeId} onChange={(e) => setAttForm({ ...attForm, employeeId: e.target.value })}>
                        <option value="">اختر الموظف</option>
                        {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name} — {e.branch}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <Label>الشفت</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={attForm.shiftId} onChange={(e) => setAttForm({ ...attForm, shiftId: e.target.value })}>
                        <option value="">بدون شفت</option>
                        {shifts.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}
                      </select>
                    </div>
                    <div className="form-group"><Label>التاريخ *</Label><Input type="date" value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} dir="ltr" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group"><Label>وقت الحضور</Label><Input type="time" value={attForm.checkIn} onChange={(e) => setAttForm({ ...attForm, checkIn: e.target.value })} dir="ltr" /></div>
                      <div className="form-group"><Label>وقت الانصراف</Label><Input type="time" value={attForm.checkOut} onChange={(e) => setAttForm({ ...attForm, checkOut: e.target.value })} dir="ltr" /></div>
                    </div>
                    <div className="form-group">
                      <Label>الحالة</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={attForm.status} onChange={(e) => setAttForm({ ...attForm, status: e.target.value as AttendanceStatus })}>
                        {(Object.entries(ATTENDANCE_STATUS_LABELS) as [AttendanceStatus, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><Label>ملاحظات</Label><Input value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} /></div>
                  </div>
                  <Button onClick={handleAttSave} className="w-full mt-4">حفظ</Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">التاريخ</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الموظف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الشفت</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحضور</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الانصراف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الساعات</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">إضافي</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحالة</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAttendance.map(a => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-3.5 text-xs text-muted-foreground">{a.date}</td>
                        <td className="p-3.5 font-medium">{a.employeeName}</td>
                        <td className="p-3.5 text-xs">{a.shiftName}</td>
                        <td className="p-3.5 font-mono text-xs" dir="ltr">{a.checkIn || "—"}</td>
                        <td className="p-3.5 font-mono text-xs" dir="ltr">{a.checkOut || "—"}</td>
                        <td className="p-3.5 font-medium">{a.hoursWorked > 0 ? `${a.hoursWorked} س` : "—"}</td>
                        <td className="p-3.5 hidden md:table-cell">{a.overtimeHours > 0 ? <span className="badge-status bg-warning/10 text-warning">{a.overtimeHours} س</span> : "—"}</td>
                        <td className="p-3.5"><span className={`badge-status ${ATTENDANCE_STATUS_COLORS[a.status]}`}>{ATTENDANCE_STATUS_LABELS[a.status]}</span></td>
                        <td className="p-3.5">
                          <Button variant="ghost" size="icon" onClick={() => setDeleteAttId(a.id)} className="h-8 w-8 text-destructive hover:text-destructive opacity-70 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))}
                    {filteredAttendance.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">
                      <CalendarCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>لا توجد سجلات حضور</p>
                    </td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا الموظف؟" />
        <DeleteConfirmDialog open={!!deleteShiftId} onOpenChange={(v) => !v && setDeleteShiftId(null)} onConfirm={confirmDeleteShift} description="هل أنت متأكد من حذف هذا الشفت؟" />
        <DeleteConfirmDialog open={!!deleteAttId} onOpenChange={(v) => !v && setDeleteAttId(null)} onConfirm={confirmDeleteAtt} description="هل أنت متأكد من حذف هذا السجل؟" />
      </div>
    </AppLayout>
  );
}
