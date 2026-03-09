import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Edit, Trash2, Clock, CalendarCheck, Search, Users, Timer,
  UserCheck, UserX, TrendingUp, DollarSign, Building2, Phone,
  CreditCard, Briefcase, AlertCircle, CheckCircle2, XCircle, ClockIcon,
  Calendar, Filter, Download, BarChart3
} from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useEmployees, useShifts, useAttendance, useBranches } from "@/data/hooks";
import type { AttendanceStatus } from "@/data/types";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/data/types";

const emptyForm = { name: "", nationalId: "", phone: "", branch: "", monthlySalary: 0, role: "مبيعات" };
const emptyShiftForm = { name: "", startTime: "08:00", endTime: "16:00", hours: 8, branch: "", active: true, notes: "" };

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-EG", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

const STATUS_ICONS: Record<AttendanceStatus, React.ReactNode> = {
  present: <CheckCircle2 className="h-3.5 w-3.5" />,
  absent: <XCircle className="h-3.5 w-3.5" />,
  late: <AlertCircle className="h-3.5 w-3.5" />,
  leave: <Calendar className="h-3.5 w-3.5" />,
  "half-day": <ClockIcon className="h-3.5 w-3.5" />,
};

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { shifts, addShift, updateShift, deleteShift } = useShifts();
  const { attendance, addAttendance, updateAttendance, deleteAttendance } = useAttendance();
  const { branches } = useBranches();
  const { toast } = useToast();

  // Employee state
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [empBranchFilter, setEmpBranchFilter] = useState("all");

  // Shift state
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);

  // Attendance state
  const [attOpen, setAttOpen] = useState(false);
  const [attForm, setAttForm] = useState({
    employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0],
    checkIn: "", checkOut: "", status: "present" as AttendanceStatus, notes: "",
  });

  // Auto-fill times when shift changes
  const handleShiftChange = (selectedShiftId: string) => {
    const shiftId = selectedShiftId === "none" ? "" : selectedShiftId;
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      setAttForm({ ...attForm, shiftId, checkIn: shift.startTime, checkOut: shift.endTime });
    } else {
      setAttForm({ ...attForm, shiftId, checkIn: "", checkOut: "" });
    }
  };
  const [attSearch, setAttSearch] = useState("");
  const [attDateFilter, setAttDateFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [attBranchFilter, setAttBranchFilter] = useState("all");
  const [attStatusFilter, setAttStatusFilter] = useState("all");
  const [deleteAttId, setDeleteAttId] = useState<string | null>(null);
  const [editingAttId, setEditingAttId] = useState<string | null>(null);

  // Bulk attendance
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split("T")[0]);
  const [bulkShiftId, setBulkShiftId] = useState("");
  const [bulkRecords, setBulkRecords] = useState<Record<string, { status: AttendanceStatus; checkIn: string; checkOut: string }>>({});

  // === FILTERS ===
  const filteredEmployees = useMemo(() =>
    employees.filter(e => {
      const matchSearch = !empSearch || e.name.includes(empSearch) || e.phone.includes(empSearch) || e.nationalId?.includes(empSearch);
      const matchBranch = empBranchFilter === "all" || e.branch === empBranchFilter;
      return matchSearch && matchBranch;
    }),
    [employees, empSearch, empBranchFilter]
  );

  const filteredAttendance = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split("T")[0];

    return attendance.filter(a => {
      const matchSearch = !attSearch || a.employeeName.includes(attSearch) || a.shiftName.includes(attSearch);
      const matchBranch = attBranchFilter === "all" || employees.find(e => e.id === a.employeeId)?.branch === attBranchFilter;
      const matchStatus = attStatusFilter === "all" || a.status === attStatusFilter;
      let matchDate = true;
      if (attDateFilter === "today") matchDate = a.date === todayStr;
      else if (attDateFilter === "week") matchDate = a.date >= weekAgo;
      else if (attDateFilter === "month") matchDate = a.date >= monthAgo;
      return matchSearch && matchBranch && matchStatus && matchDate;
    });
  }, [attendance, attSearch, attDateFilter, attBranchFilter, attStatusFilter, employees]);

  // === HANDLERS ===
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

    const record = {
      employeeId: attForm.employeeId, employeeName: emp?.name || "",
      shiftId: attForm.shiftId, shiftName: shift?.name || "-",
      date: attForm.date, checkIn: attForm.checkIn, checkOut: attForm.checkOut,
      hoursWorked, status: attForm.status, overtimeHours, notes: attForm.notes,
    };

    if (editingAttId) {
      updateAttendance(editingAttId, record);
      toast({ title: "✅ تم تحديث السجل" });
    } else {
      addAttendance(record);
      toast({ title: "✅ تم التسجيل", description: `تم تسجيل حضور ${emp?.name}` });
    }
    setAttForm({ employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0], checkIn: "", checkOut: "", status: "present", notes: "" });
    setEditingAttId(null);
    setAttOpen(false);
  };

  const confirmDeleteAtt = () => {
    if (deleteAttId) { deleteAttendance(deleteAttId); toast({ title: "✅ تم الحذف" }); setDeleteAttId(null); }
  };

  const handleEditAtt = (a: typeof attendance[0]) => {
    setAttForm({
      employeeId: a.employeeId, shiftId: a.shiftId, date: a.date,
      checkIn: a.checkIn, checkOut: a.checkOut, status: a.status, notes: a.notes,
    });
    setEditingAttId(a.id);
    setAttOpen(true);
  };

  // Handle opening new attendance form
  const handleNewAttendance = () => {
    setAttForm({
      employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0],
      checkIn: "", checkOut: "", status: "present", notes: "",
    });
    setEditingAttId(null);
    setAttOpen(true);
  };

  // Bulk attendance
  const initBulk = () => {
    const shift = shifts.find(s => s.id === bulkShiftId);
    const records: typeof bulkRecords = {};
    const activeEmps = employees.filter(e => e.active);
    activeEmps.forEach(e => {
      const existing = attendance.find(a => a.employeeId === e.id && a.date === bulkDate);
      records[e.id] = existing
        ? { status: existing.status, checkIn: existing.checkIn, checkOut: existing.checkOut }
        : { status: "present", checkIn: shift?.startTime || "", checkOut: shift?.endTime || "" };
    });
    setBulkRecords(records);
    setBulkOpen(true);
  };

  const handleBulkSave = () => {
    const shift = shifts.find(s => s.id === bulkShiftId);
    let count = 0;
    Object.entries(bulkRecords).forEach(([empId, rec]) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      const existing = attendance.find(a => a.employeeId === empId && a.date === bulkDate);
      const hoursWorked = rec.checkIn && rec.checkOut ? calcHours(rec.checkIn, rec.checkOut) : 0;
      const overtimeHours = shift ? Math.max(0, hoursWorked - shift.hours) : 0;
      const data = {
        employeeId: empId, employeeName: emp.name,
        shiftId: bulkShiftId, shiftName: shift?.name || "-",
        date: bulkDate, checkIn: rec.checkIn, checkOut: rec.checkOut,
        hoursWorked, status: rec.status, overtimeHours, notes: "",
      };
      if (existing) {
        updateAttendance(existing.id, data);
      } else {
        addAttendance(data);
      }
      count++;
    });
    toast({ title: "✅ تم الحفظ", description: `تم تسجيل حضور ${count} موظف` });
    setBulkOpen(false);
  };

  // === STATS ===
  const todayStr = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === "present" || a.status === "late").length;
  const absentToday = todayAttendance.filter(a => a.status === "absent").length;
  const lateToday = todayAttendance.filter(a => a.status === "late").length;
  const onLeaveToday = todayAttendance.filter(a => a.status === "leave").length;
  const totalSalaries = employees.filter(e => e.active).reduce((s, e) => s + e.monthlySalary, 0);
  const activeCount = employees.filter(e => e.active).length;
  const attendanceRate = activeCount > 0 ? Math.round((presentToday / activeCount) * 100) : 0;

  // Monthly stats
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyAttendance = attendance.filter(a => a.date.startsWith(currentMonth));
  const totalOvertimeThisMonth = monthlyAttendance.reduce((s, a) => s + a.overtimeHours, 0);
  const totalHoursThisMonth = monthlyAttendance.reduce((s, a) => s + a.hoursWorked, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              إدارة الموظفين والحضور
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeCount} موظف نشط من {employees.length} — إجمالي المرتبات: {totalSalaries.toLocaleString()} ج.م
            </p>
          </div>
        </div>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="employees" className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">الموظفين</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{employees.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="shifts" className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">الشفتات</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{shifts.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2 text-sm">
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">الحضور</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{todayAttendance.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ===== EMPLOYEES TAB ===== */}
          <TabsContent value="employees" className="space-y-4 mt-4">
            {/* Employee Stats */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">موظف نشط</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <DollarSign className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalSalaries.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">إجمالي المرتبات</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <UserCheck className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{presentToday}</p>
                    <p className="text-xs text-muted-foreground">حاضرون اليوم</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <UserX className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{absentToday}</p>
                    <p className="text-xs text-muted-foreground">غائبون اليوم</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-1 gap-2 w-full sm:w-auto">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="بحث بالاسم أو الهاتف أو الرقم القومي..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="pr-10" />
                </div>
                <Select value={empBranchFilter} onValueChange={setEmpBranchFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Building2 className="h-4 w-4 ml-1 text-muted-foreground" />
                    <SelectValue placeholder="الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <ExportButtons data={filteredEmployees as any} headers={[{ key: "id", label: "الكود" }, { key: "name", label: "الاسم" }, { key: "nationalId", label: "الرقم القومي" }, { key: "phone", label: "الهاتف" }, { key: "branch", label: "الفرع" }, { key: "monthlySalary", label: "المرتب" }, { key: "role", label: "الدور" }]} fileName="الموظفين" title="الموظفين" />
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditingId(null); } }}>
                  <DialogTrigger asChild><Button className="gap-2 shadow-md"><Plus className="h-4 w-4" />إضافة موظف</Button></DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{editingId ? "تعديل الموظف" : "إضافة موظف جديد"}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div className="form-group sm:col-span-2"><Label>الاسم بالكامل *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="أدخل اسم الموظف" /></div>
                      <div className="form-group"><Label>الرقم القومي</Label><Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" placeholder="00000000000000" maxLength={14} /></div>
                      <div className="form-group"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="01xxxxxxxxx" /></div>
                      <div className="form-group">
                        <Label>الفرع</Label>
                        <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                          <SelectContent>
                            {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-group"><Label>المرتب الشهري</Label><Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })} dir="ltr" placeholder="0" /></div>
                      <div className="form-group sm:col-span-2">
                        <Label>الدور الوظيفي</Label>
                        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="مبيعات">مبيعات</SelectItem>
                            <SelectItem value="محاسب">محاسب</SelectItem>
                            <SelectItem value="مدير فرع">مدير فرع</SelectItem>
                            <SelectItem value="مخازن">مخازن</SelectItem>
                            <SelectItem value="سائق">سائق</SelectItem>
                            <SelectItem value="فني">فني</SelectItem>
                            <SelectItem value="أخرى">أخرى</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleSave} className="w-full mt-4">{editingId ? "تحديث" : "حفظ"}</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Employees Table */}
            <div className="table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الموظف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">الرقم القومي</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الهاتف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الفرع</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">المرتب</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">الدور</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحالة</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-24">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((e) => {
                      const empToday = todayAttendance.find(a => a.employeeId === e.id);
                      return (
                        <tr key={e.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                {e.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{e.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{e.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 hidden md:table-cell">
                            <span className="font-mono text-xs text-muted-foreground" dir="ltr">{e.nationalId || "—"}</span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-xs" dir="ltr">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {e.phone || "—"}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <Badge variant="secondary" className="gap-1">
                              <Building2 className="h-3 w-3" />
                              {e.branch || "—"}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-foreground">{e.monthlySalary.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground mr-1">ج.م</span>
                          </td>
                          <td className="p-3.5 hidden lg:table-cell">
                            <Badge variant="outline" className="gap-1">
                              <Briefcase className="h-3 w-3" />
                              {e.role}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            {empToday ? (
                              <span className={`badge-status ${ATTENDANCE_STATUS_COLORS[empToday.status]} gap-1`}>
                                {STATUS_ICONS[empToday.status]}
                                {ATTENDANCE_STATUS_LABELS[empToday.status]}
                              </span>
                            ) : (
                              <span className="badge-status bg-muted text-muted-foreground text-xs">لم يُسجل</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setForm({ name: e.name, nationalId: e.nationalId || "", phone: e.phone, branch: e.branch, monthlySalary: e.monthlySalary, role: e.role }); setEditingId(e.id); setOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEmployees.length === 0 && (
                      <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>لا توجد نتائج</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ===== SHIFTS TAB ===== */}
          <TabsContent value="shifts" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-sm">إدارة الشفتات وساعات العمل لكل فرع</p>
                <p className="text-xs text-muted-foreground mt-1">{shifts.filter(s => s.active).length} شفت نشط من {shifts.length}</p>
              </div>
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
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                      <span className="text-sm text-muted-foreground">عدد الساعات: </span>
                      <span className="text-lg font-bold text-primary">{calcHours(shiftForm.startTime, shiftForm.endTime)} ساعة</span>
                    </div>
                    <div className="form-group">
                      <Label>الفرع</Label>
                      <Select value={shiftForm.branch} onValueChange={(v) => setShiftForm({ ...shiftForm, branch: v === "all" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="كل الفروع" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الفروع</SelectItem>
                          {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>نشط</Label>
                      <Switch checked={shiftForm.active} onCheckedChange={(v) => setShiftForm({ ...shiftForm, active: v })} />
                    </div>
                    <div className="form-group"><Label>ملاحظات</Label><Textarea value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} rows={2} /></div>
                  </div>
                  <Button onClick={handleShiftSave} className="w-full mt-4">{editingShiftId ? "تحديث" : "حفظ"}</Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shifts.map(s => {
                const assignedCount = employees.filter(e => e.active && (!s.branch || e.branch === s.branch)).length;
                return (
                  <Card key={s.id} className={`transition-all hover:shadow-md ${!s.active ? "opacity-50" : ""}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Timer className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-foreground">{s.name}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {s.branch || "كل الفروع"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {s.active ? (
                            <Badge variant="secondary" className="bg-success/10 text-success text-xs">نشط</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">معطل</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5">البداية</p>
                            <p className="font-bold text-foreground" dir="ltr">{s.startTime}</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5">النهاية</p>
                            <p className="font-bold text-foreground" dir="ltr">{s.endTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5">
                          <span className="text-sm text-muted-foreground">المدة</span>
                          <span className="font-bold text-primary">{s.hours} ساعة</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{assignedCount} موظف مرتبط</span>
                          {s.notes && <span className="truncate max-w-[120px]">{s.notes}</span>}
                        </div>
                      </div>

                      <div className="flex gap-1 mt-4 pt-3 border-t border-border">
                        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setShiftForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, hours: s.hours, branch: s.branch, active: s.active, notes: s.notes }); setEditingShiftId(s.id); setShiftOpen(true); }}>
                          <Edit className="h-3.5 w-3.5 ml-1" />تعديل
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteShiftId(s.id)}>
                          <Trash2 className="h-3.5 w-3.5 ml-1" />حذف
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {shifts.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">لا توجد شفتات مُعرّفة بعد</p>
                  <p className="text-xs text-muted-foreground mt-1">أضف شفت جديد لبدء تنظيم ساعات العمل</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== ATTENDANCE TAB ===== */}
          <TabsContent value="attendance" className="space-y-4 mt-4">
            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xl font-bold text-foreground">{activeCount}</p>
                  <p className="text-[10px] text-muted-foreground">إجمالي</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center mx-auto mb-1">
                    <UserCheck className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-xl font-bold text-success">{presentToday}</p>
                  <p className="text-[10px] text-muted-foreground">حاضرون</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-1">
                    <UserX className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-xl font-bold text-destructive">{absentToday}</p>
                  <p className="text-[10px] text-muted-foreground">غائبون</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center mx-auto mb-1">
                    <AlertCircle className="h-4 w-4 text-warning" />
                  </div>
                  <p className="text-xl font-bold text-warning">{lateToday}</p>
                  <p className="text-[10px] text-muted-foreground">متأخرون</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center mx-auto mb-1">
                    <Calendar className="h-4 w-4 text-info" />
                  </div>
                  <p className="text-xl font-bold text-info">{onLeaveToday}</p>
                  <p className="text-[10px] text-muted-foreground">إجازة</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xl font-bold text-primary">{attendanceRate}%</p>
                  <p className="text-[10px] text-muted-foreground">نسبة الحضور</p>
                  <Progress value={attendanceRate} className="h-1 mt-1" />
                </CardContent>
              </Card>
            </div>

            {/* Monthly Summary */}
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="p-4 flex flex-wrap items-center gap-6 text-sm">
                <span className="text-muted-foreground font-medium">ملخص الشهر الحالي:</span>
                <span><strong className="text-foreground">{monthlyAttendance.length}</strong> <span className="text-muted-foreground">سجل</span></span>
                <span><strong className="text-foreground">{totalHoursThisMonth.toFixed(1)}</strong> <span className="text-muted-foreground">ساعة عمل</span></span>
                <span><strong className="text-warning">{totalOvertimeThisMonth.toFixed(1)}</strong> <span className="text-muted-foreground">ساعة إضافية</span></span>
              </CardContent>
            </Card>

            {/* Filters & Actions */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="بحث بالاسم أو الشفت..." value={attSearch} onChange={(e) => setAttSearch(e.target.value)} className="pr-10" />
                </div>
                <Select value={attDateFilter} onValueChange={(v: any) => setAttDateFilter(v)}>
                  <SelectTrigger className="w-[120px]">
                    <Calendar className="h-4 w-4 ml-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">اليوم</SelectItem>
                    <SelectItem value="week">هذا الأسبوع</SelectItem>
                    <SelectItem value="month">هذا الشهر</SelectItem>
                    <SelectItem value="all">الكل</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={attBranchFilter} onValueChange={setAttBranchFilter}>
                  <SelectTrigger className="w-[120px]">
                    <Building2 className="h-4 w-4 ml-1 text-muted-foreground" />
                    <SelectValue placeholder="الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={attStatusFilter} onValueChange={setAttStatusFilter}>
                  <SelectTrigger className="w-[110px]">
                    <Filter className="h-4 w-4 ml-1 text-muted-foreground" />
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {(Object.entries(ATTENDANCE_STATUS_LABELS) as [AttendanceStatus, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={initBulk}>
                  <Users className="h-4 w-4" />
                  تسجيل حضور جماعي
                </Button>
                <ExportButtons
                  data={filteredAttendance as any}
                  headers={[
                    { key: "date", label: "التاريخ" }, { key: "employeeName", label: "الموظف" },
                    { key: "shiftName", label: "الشفت" }, { key: "checkIn", label: "الحضور" },
                    { key: "checkOut", label: "الانصراف" }, { key: "hoursWorked", label: "الساعات" },
                    { key: "overtimeHours", label: "إضافي" }, { key: "status", label: "الحالة" },
                  ]}
                  fileName="الحضور_والانصراف"
                  title="سجل الحضور والانصراف"
                />
                <Dialog open={attOpen} onOpenChange={(v) => { setAttOpen(v); if (!v) { setAttForm({ employeeId: "", shiftId: "", date: new Date().toISOString().split("T")[0], checkIn: "", checkOut: "", status: "present", notes: "" }); setEditingAttId(null); } }}>
                  <DialogTrigger asChild><Button className="gap-2 shadow-md" onClick={handleNewAttendance}><Plus className="h-4 w-4" />تسجيل حضور</Button></DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editingAttId ? "تعديل سجل الحضور" : "تسجيل حضور وانصراف"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="form-group">
                        <Label>الموظف *</Label>
                        <Select value={attForm.employeeId} onValueChange={(v) => setAttForm({ ...attForm, employeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                          <SelectContent>
                            {employees.filter(e => e.active).map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.name} — {e.branch}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-group">
                        <Label>الشفت</Label>
                        <Select value={attForm.shiftId} onValueChange={handleShiftChange}>
                          <SelectTrigger><SelectValue placeholder="بدون شفت" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون شفت</SelectItem>
                            {shifts.filter(s => s.active).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          سيتم ملء أوقات الحضور والانصراف تلقائياً حسب وقت الشفت ويمكن تعديلها
                        </p>
                      </div>
                      <div className="form-group"><Label>التاريخ *</Label><Input type="date" value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} dir="ltr" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="form-group"><Label>وقت الحضور</Label><Input type="time" value={attForm.checkIn} onChange={(e) => setAttForm({ ...attForm, checkIn: e.target.value })} dir="ltr" /></div>
                        <div className="form-group"><Label>وقت الانصراف</Label><Input type="time" value={attForm.checkOut} onChange={(e) => setAttForm({ ...attForm, checkOut: e.target.value })} dir="ltr" /></div>
                      </div>
                      {attForm.checkIn && attForm.checkOut && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                          <span className="text-sm text-muted-foreground">ساعات العمل: </span>
                          <span className="text-lg font-bold text-primary">{calcHours(attForm.checkIn, attForm.checkOut)} ساعة</span>
                        </div>
                      )}
                      <div className="form-group">
                        <Label>الحالة</Label>
                        <Select value={attForm.status} onValueChange={(v) => setAttForm({ ...attForm, status: v as AttendanceStatus })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.entries(ATTENDANCE_STATUS_LABELS) as [AttendanceStatus, string][]).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-group"><Label>ملاحظات</Label><Textarea value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} rows={2} /></div>
                    </div>
                    <Button onClick={handleAttSave} className="w-full mt-4">{editingAttId ? "تحديث" : "حفظ"}</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="table-container">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">التاريخ</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الموظف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">الشفت</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحضور</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الانصراف</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الساعات</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">إضافي</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحالة</th>
                      <th className="text-right p-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-24">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAttendance.map(a => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-3.5">
                          <div>
                            <p className="text-xs font-medium text-foreground">{formatDate(a.date)}</p>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {a.employeeName.charAt(0)}
                            </div>
                            <span className="font-medium text-sm">{a.employeeName}</span>
                          </div>
                        </td>
                        <td className="p-3.5 hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{a.shiftName}</Badge>
                        </td>
                        <td className="p-3.5 font-mono text-xs font-medium" dir="ltr">
                          {a.checkIn ? (
                            <span className="text-success">{a.checkIn}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3.5 font-mono text-xs font-medium" dir="ltr">
                          {a.checkOut ? (
                            <span className="text-destructive">{a.checkOut}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3.5">
                          {a.hoursWorked > 0 ? (
                            <span className="font-semibold text-foreground">{a.hoursWorked} س</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3.5 hidden md:table-cell">
                          {a.overtimeHours > 0 ? (
                            <Badge className="bg-warning/10 text-warning border-warning/20 gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {a.overtimeHours} س
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="p-3.5">
                          <span className={`badge-status ${ATTENDANCE_STATUS_COLORS[a.status]} gap-1`}>
                            {STATUS_ICONS[a.status]}
                            {ATTENDANCE_STATUS_LABELS[a.status]}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAtt(a)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteAttId(a.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">
                        <CalendarCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">لا توجد سجلات حضور</p>
                        <p className="text-xs mt-1">جرب تغيير الفلاتر أو سجل حضور جديد</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bulk Attendance Dialog */}
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>تسجيل حضور جماعي</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <Label>التاريخ</Label>
                  <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} dir="ltr" />
                </div>
                <div className="form-group">
                  <Label>الشفت</Label>
                  <Select value={bulkShiftId} onValueChange={(v) => {
                    const shiftId = v === "none" ? "" : v;
                    setBulkShiftId(shiftId);
                    const shift = shifts.find(s => s.id === shiftId);
                    setBulkRecords(prev => {
                      const updated: typeof prev = {};
                      Object.entries(prev).forEach(([empId, rec]) => {
                        updated[empId] = shift
                          ? { ...rec, checkIn: shift.startTime, checkOut: shift.endTime }
                          : { ...rec, checkIn: "", checkOut: "" };
                      });
                      return updated;
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر الشفت" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون شفت</SelectItem>
                      {shifts.filter(s => s.active).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الموظف</th>
                      <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الحالة</th>
                      <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الحضور</th>
                      <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الانصراف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employees.filter(e => e.active).map(e => (
                      <tr key={e.id} className="hover:bg-muted/20">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{e.name.charAt(0)}</div>
                            <div>
                              <p className="font-medium text-sm">{e.name}</p>
                              <p className="text-xs text-muted-foreground">{e.branch}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={bulkRecords[e.id]?.status || "present"}
                            onValueChange={(v) => setBulkRecords(prev => ({ ...prev, [e.id]: { ...prev[e.id], status: v as AttendanceStatus } }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.entries(ATTENDANCE_STATUS_LABELS) as [AttendanceStatus, string][]).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            type="time" className="h-8 text-xs w-[100px]" dir="ltr"
                            value={bulkRecords[e.id]?.checkIn || ""}
                            onChange={(ev) => setBulkRecords(prev => ({ ...prev, [e.id]: { ...prev[e.id], checkIn: ev.target.value } }))}
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="time" className="h-8 text-xs w-[100px]" dir="ltr"
                            value={bulkRecords[e.id]?.checkOut || ""}
                            onChange={(ev) => setBulkRecords(prev => ({ ...prev, [e.id]: { ...prev[e.id], checkOut: ev.target.value } }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleBulkSave} className="flex-1">حفظ الكل</Button>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>إلغاء</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)} onConfirm={confirmDelete} description="هل أنت متأكد من حذف هذا الموظف؟" />
        <DeleteConfirmDialog open={!!deleteShiftId} onOpenChange={(v) => !v && setDeleteShiftId(null)} onConfirm={confirmDeleteShift} description="هل أنت متأكد من حذف هذا الشفت؟" />
        <DeleteConfirmDialog open={!!deleteAttId} onOpenChange={(v) => !v && setDeleteAttId(null)} onConfirm={confirmDeleteAtt} description="هل أنت متأكد من حذف هذا السجل؟" />
      </div>
    </AppLayout>
  );
}
