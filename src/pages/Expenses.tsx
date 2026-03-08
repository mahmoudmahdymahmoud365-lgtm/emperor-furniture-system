import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Search, Receipt, Zap, Droplets, UtensilsCrossed, Coffee,
  Building2, Users, Wrench, Truck, ShoppingBag, MoreHorizontal,
  Edit2, Trash2, TrendingDown, Calendar,
} from "lucide-react";
import { useExpenses, useBranches } from "@/data/hooks";
import type { Expense, ExpenseCategory } from "@/data/types";
import { EXPENSE_CATEGORY_LABELS } from "@/data/types";

const CATEGORY_ICONS: Record<ExpenseCategory, React.ElementType> = {
  electricity: Zap,
  water: Droplets,
  food: UtensilsCrossed,
  drinks: Coffee,
  rent: Building2,
  salaries: Users,
  maintenance: Wrench,
  transport: Truck,
  supplies: ShoppingBag,
  other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  electricity: "bg-warning/15 text-warning",
  water: "bg-info/15 text-info",
  food: "bg-accent/15 text-accent",
  drinks: "bg-primary/15 text-primary",
  rent: "bg-destructive/15 text-destructive",
  salaries: "bg-success/15 text-success",
  maintenance: "bg-muted text-muted-foreground",
  transport: "bg-info/15 text-info",
  supplies: "bg-accent/15 text-accent",
  other: "bg-muted text-muted-foreground",
};

const ALL_CATEGORIES: ExpenseCategory[] = ["electricity", "water", "food", "drinks", "rent", "salaries", "maintenance", "transport", "supplies", "other"];

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const { branches } = useBranches();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: "electricity" as ExpenseCategory,
    description: "",
    amount: "",
    date: new Date().toISOString().substring(0, 10),
    branch: "",
    paidBy: "",
    recurring: false,
    notes: "",
  });

  const resetForm = () => {
    setForm({ category: "electricity", description: "", amount: "", date: new Date().toISOString().substring(0, 10), branch: "", paidBy: "", recurring: false, notes: "" });
    setEditId(null);
  };

  const handleOpen = (expense?: Expense) => {
    if (expense) {
      setEditId(expense.id);
      setForm({ category: expense.category, description: expense.description, amount: String(expense.amount), date: expense.date, branch: expense.branch, paidBy: expense.paidBy, recurring: expense.recurring, notes: expense.notes });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    const data = { ...form, amount };
    if (editId) {
      updateExpense(editId, data);
    } else {
      addExpense(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteExpense(deleteId);
      setDeleteId(null);
    }
  };

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = !search || e.description.includes(search) || EXPENSE_CATEGORY_LABELS[e.category].includes(search) || e.branch.includes(search);
      const matchCat = filterCategory === "all" || e.category === filterCategory;
      const matchMonth = !filterMonth || e.date.startsWith(filterMonth);
      return matchSearch && matchCat && matchMonth;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, search, filterCategory, filterMonth]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const totalThisMonth = expenses.filter(e => e.date.startsWith(new Date().toISOString().substring(0, 7))).reduce((s, e) => s + e.amount, 0);

  // Category totals for stats
  const categoryTotals = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    filtered.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center shadow-lg shadow-destructive/20">
              <Receipt className="h-6 w-6 text-destructive-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">المصروفات</h1>
              <p className="text-sm text-muted-foreground">تسجيل ومتابعة جميع المدفوعات والمصروفات</p>
            </div>
          </div>
          <Button onClick={() => handleOpen()} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            إضافة مصروف
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-destructive/20 bg-gradient-to-br from-destructive/15 to-destructive/5 p-5 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
            </div>
            <p className="text-lg font-extrabold text-foreground">{totalFiltered.toLocaleString()} ج.م</p>
            <p className="text-xs text-muted-foreground">إجمالي المصروفات (المعروض)</p>
          </div>
          <div className="rounded-2xl border border-warning/20 bg-gradient-to-br from-warning/15 to-warning/5 p-5 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
            </div>
            <p className="text-lg font-extrabold text-foreground">{totalThisMonth.toLocaleString()} ج.م</p>
            <p className="text-xs text-muted-foreground">مصروفات الشهر الحالي</p>
          </div>
          <div className="rounded-2xl border border-info/20 bg-gradient-to-br from-info/15 to-info/5 p-5 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-info" />
              </div>
            </div>
            <p className="text-lg font-extrabold text-foreground">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">عدد المصروفات</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 p-5 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <MoreHorizontal className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-lg font-extrabold text-foreground">{categoryTotals.length}</p>
            <p className="text-xs text-muted-foreground">عدد الفئات المستخدمة</p>
          </div>
        </div>

        {/* Category breakdown */}
        {categoryTotals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {categoryTotals.map(([cat, total]) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <div key={cat} className="section-card p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[cat]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{EXPENSE_CATEGORY_LABELS[cat]}</p>
                    <p className="text-sm font-bold">{total.toLocaleString()} ج.م</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="section-card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث في المصروفات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 rounded-xl" />
            </div>
            <select className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">كل الفئات</option>
              {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{EXPENSE_CATEGORY_LABELS[cat]}</option>)}
            </select>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} dir="ltr" className="w-44 rounded-xl" placeholder="فلترة بالشهر" />
            <ExportButtons
              data={filtered.map(e => ({ ...e, categoryLabel: EXPENSE_CATEGORY_LABELS[e.category], recurring: e.recurring ? "نعم" : "لا" }))}
              headers={[{ key: "date", label: "التاريخ" }, { key: "categoryLabel", label: "الفئة" }, { key: "description", label: "الوصف" }, { key: "amount", label: "المبلغ" }, { key: "branch", label: "الفرع" }, { key: "paidBy", label: "دفعها" }]}
              fileName="المصروفات"
              title="تقرير المصروفات"
            />
          </div>
        </div>

        {/* Table */}
        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">التاريخ</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفئة</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الوصف</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">المبلغ</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الفرع</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">دفعها</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs">متكرر</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-xs w-20">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(expense => {
                  const Icon = CATEGORY_ICONS[expense.category];
                  return (
                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-3 text-muted-foreground text-xs">{expense.date}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[expense.category]}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium">{EXPENSE_CATEGORY_LABELS[expense.category]}</span>
                        </div>
                      </td>
                      <td className="p-3 font-medium">{expense.description}</td>
                      <td className="p-3 font-bold text-destructive">{expense.amount.toLocaleString()} ج.م</td>
                      <td className="p-3 text-xs">{expense.branch || "-"}</td>
                      <td className="p-3 text-xs">{expense.paidBy || "-"}</td>
                      <td className="p-3">
                        {expense.recurring && <span className="badge-status bg-info/10 text-info">متكرر</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleOpen(expense)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => setDeleteId(expense.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>لا توجد مصروفات مسجلة</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{filtered.length} مصروف</span>
              <span className="text-sm font-bold text-destructive">الإجمالي: {totalFiltered.toLocaleString()} ج.م</span>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل مصروف" : "إضافة مصروف جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group sm:col-span-2">
              <Label>الفئة</Label>
              <div className="grid grid-cols-5 gap-2">
                {ALL_CATEGORIES.map(cat => {
                  const Icon = CATEGORY_ICONS[cat];
                  const selected = form.category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${selected ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/30"}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate w-full text-center">{EXPENSE_CATEGORY_LABELS[cat]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-group sm:col-span-2">
              <Label>الوصف</Label>
              <Input placeholder="مثال: فاتورة كهرباء شهر يناير" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <Label>المبلغ (ج.م)</Label>
              <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="form-group">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} dir="ltr" />
            </div>
            <div className="form-group">
              <Label>الفرع</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                <option value="">-- اختر الفرع --</option>
                {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <Label>دفعها</Label>
              <Input placeholder="اسم الشخص" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} />
            </div>
            <div className="form-group sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea placeholder="ملاحظات إضافية..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
              <Label className="cursor-pointer">مصروف متكرر (شهري)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.amount || parseFloat(form.amount) <= 0}>
              {editId ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={handleDelete}
        title="حذف المصروف"
        description="هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء."
      />
    </AppLayout>
  );
}
