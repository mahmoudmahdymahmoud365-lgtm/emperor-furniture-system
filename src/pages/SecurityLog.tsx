import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Search, Trash2, LogIn, LogOut, ShieldAlert, ShieldCheck, Monitor } from "lucide-react";
import { useSecurityLog } from "@/data/hooks";
import { useToast } from "@/hooks/use-toast";
import type { SecurityEvent } from "@/data/types";

const EVENT_CONFIG: Record<SecurityEvent["type"], { label: string; icon: typeof LogIn; color: string }> = {
  login_success: { label: "دخول ناجح", icon: LogIn, color: "text-success bg-success/10" },
  login_failed: { label: "محاولة فاشلة", icon: ShieldAlert, color: "text-destructive bg-destructive/10" },
  logout: { label: "تسجيل خروج", icon: LogOut, color: "text-muted-foreground bg-muted" },
  password_change: { label: "تغيير كلمة المرور", icon: ShieldCheck, color: "text-info bg-info/10" },
  session_expired: { label: "انتهاء الجلسة", icon: Monitor, color: "text-warning bg-warning/10" },
};

export default function SecurityLog() {
  const { events, clearSecurityLog } = useSecurityLog();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<SecurityEvent["type"] | "all">("all");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        return e.email.toLowerCase().includes(s) || e.userName.toLowerCase().includes(s) || (e.ip || "").includes(s);
      }
      return true;
    });
  }, [events, search, filterType]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayEvents = events.filter(e => e.timestamp.startsWith(today));
    return {
      totalToday: todayEvents.length,
      failedToday: todayEvents.filter(e => e.type === "login_failed").length,
      successToday: todayEvents.filter(e => e.type === "login_success").length,
      uniqueUsers: new Set(todayEvents.filter(e => e.type === "login_success").map(e => e.email)).size,
    };
  }, [events]);

  const handleClear = () => {
    if (confirm("هل أنت متأكد من حذف جميع سجلات الأمان؟")) {
      clearSecurityLog();
      toast({ title: "تم المسح", description: "تم مسح سجل الأمان بالكامل" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="page-header">سجل الأمان والدخول</h1>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-destructive">
            <Trash2 className="h-4 w-4 ml-1" />مسح السجل
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">أحداث اليوم</p><p className="text-xl font-bold">{stats.totalToday}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><LogIn className="h-5 w-5 text-success" /></div>
              <div><p className="text-xs text-muted-foreground">دخول ناجح</p><p className="text-xl font-bold text-success">{stats.successToday}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><ShieldAlert className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground">محاولات فاشلة</p><p className="text-xl font-bold text-destructive">{stats.failedToday}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10"><Monitor className="h-5 w-5 text-info" /></div>
              <div><p className="text-xs text-muted-foreground">مستخدمين نشطين</p><p className="text-xl font-bold">{stats.uniqueUsers}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث بالبريد أو الاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">كل الأحداث</option>
                <option value="login_success">دخول ناجح</option>
                <option value="login_failed">محاولات فاشلة</option>
                <option value="logout">تسجيل خروج</option>
                <option value="password_change">تغيير كلمة المرور</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد أحداث أمنية مسجلة</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filtered.slice(0, 200).map((event) => {
                  const config = EVENT_CONFIG[event.type];
                  const Icon = config.icon;
                  return (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className={`p-1.5 rounded-md shrink-0 ${config.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{config.label}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${config.color}`}>{event.type === "login_failed" ? "⚠️" : "✓"}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-medium">{event.userName || event.email}</span>
                          <span>•</span>
                          <span dir="ltr">{event.email}</span>
                          <span>•</span>
                          <span dir="ltr">
                            {new Date(event.timestamp).toLocaleDateString("ar-EG")}{" "}
                            {new Date(event.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                          {event.userAgent && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[200px]" title={event.userAgent}>{event.userAgent.substring(0, 50)}...</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {filtered.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                عرض {Math.min(filtered.length, 200)} من {filtered.length} حدث
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
