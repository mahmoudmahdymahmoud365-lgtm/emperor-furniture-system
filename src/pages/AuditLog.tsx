import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, Search, Trash2, FileText, Plus, Pencil, Trash } from "lucide-react";
import { useAuditLog } from "@/data/hooks";
import { useToast } from "@/hooks/use-toast";
import type { AuditAction, AuditEntity } from "@/data/types";

const ACTION_LABELS: Record<AuditAction, { label: string; icon: typeof Plus; color: string }> = {
  create: { label: "إنشاء", icon: Plus, color: "text-success bg-success/10" },
  update: { label: "تعديل", icon: Pencil, color: "text-info bg-info/10" },
  delete: { label: "حذف", icon: Trash, color: "text-destructive bg-destructive/10" },
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
  customer: "عميل",
  product: "منتج",
  invoice: "فاتورة",
  employee: "موظف",
  branch: "فرع",
  receipt: "قسط",
  settings: "إعدادات",
  offer: "عرض",
  return: "مرتجع",
  stock: "مخزون",
  shift: "شفت",
  attendance: "حضور",
  expense: "مصروف",
};

export default function AuditLog() {
  const { log, clearAuditLog } = useAuditLog();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");
  const [filterEntity, setFilterEntity] = useState<AuditEntity | "all">("all");

  const filtered = useMemo(() => {
    return log.filter((entry) => {
      if (filterAction !== "all" && entry.action !== filterAction) return false;
      if (filterEntity !== "all" && entry.entity !== filterEntity) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          entry.details.toLowerCase().includes(s) ||
          entry.user.toLowerCase().includes(s) ||
          entry.entityName.toLowerCase().includes(s) ||
          entry.entityId.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [log, search, filterAction, filterEntity]);

  const handleClear = () => {
    if (confirm("هل أنت متأكد من حذف جميع سجلات العمليات؟")) {
      clearAuditLog();
      toast({ title: "تم المسح", description: "تم مسح سجل العمليات بالكامل" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="page-header">سجل العمليات</h1>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-destructive">
            <Trash2 className="h-4 w-4 ml-1" />
            مسح السجل
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في السجل..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value as AuditAction | "all")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">كل العمليات</option>
                <option value="create">إنشاء</option>
                <option value="update">تعديل</option>
                <option value="delete">حذف</option>
              </select>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value as AuditEntity | "all")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">كل الأقسام</option>
                <option value="customer">عملاء</option>
                <option value="product">منتجات</option>
                <option value="invoice">فواتير</option>
                <option value="employee">موظفين</option>
                <option value="branch">فروع</option>
                <option value="receipt">أقساط</option>
                <option value="settings">إعدادات</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد عمليات مسجلة</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filtered.slice(0, 200).map((entry) => {
                  const actionInfo = ACTION_LABELS[entry.action];
                  const ActionIcon = actionInfo.icon;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className={`p-1.5 rounded-md shrink-0 ${actionInfo.color}`}>
                        <ActionIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.details}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="bg-muted px-1.5 py-0.5 rounded">{ENTITY_LABELS[entry.entity]}</span>
                          <span>•</span>
                          <span>{entry.user}</span>
                          <span>•</span>
                          <span dir="ltr">
                            {new Date(entry.timestamp).toLocaleDateString("ar-EG")} {new Date(entry.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{entry.entityId}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {filtered.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                عرض {Math.min(filtered.length, 200)} من {filtered.length} عملية
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
