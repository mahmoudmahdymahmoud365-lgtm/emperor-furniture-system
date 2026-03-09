import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Database, Download, Upload, Clock, Trash2, RotateCcw, Cloud, CloudOff,
  HardDrive, RefreshCw, Shield, Calendar, FolderSync
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  exportBackup, importBackup, getAutoBackupList, createManualBackup,
  restoreFromBackupId, deleteBackup, getAutoBackupInterval, setAutoBackupInterval,
  getLastAutoBackupTime, checkAndRunAutoBackup, getCloudConfig,
  type BackupMeta, type CloudConfig,
} from "@/data/store";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function BackupManager() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [interval, setIntervalVal] = useState(24);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [, setCloudConfig] = useState<CloudConfig>({ enabled: false, provider: "none", autoSync: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [manualLabel, setManualLabel] = useState("");
  const [showManualDialog, setShowManualDialog] = useState(false);

  const refreshData = () => {
    setBackups(getAutoBackupList());
    setIntervalVal(getAutoBackupInterval());
    setLastBackup(getLastAutoBackupTime());
    setCloudConfig(getCloudConfig());
  };

  useEffect(() => { refreshData(); }, []);

  // Auto-backup check on mount
  useEffect(() => {
    checkAndRunAutoBackup();
  }, []);

  const handleExport = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "✅ تم التصدير", description: "تم تصدير النسخة الاحتياطية بنجاح" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (importBackup(result)) {
        toast({ title: "✅ تم الاستعادة", description: "تم استعادة النسخة الاحتياطية. جاري إعادة التحميل..." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "خطأ", description: "ملف النسخة الاحتياطية غير صالح", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleManualBackup = () => {
    const meta = createManualBackup(manualLabel || undefined);
    if (meta) {
      toast({ title: "✅ تم الحفظ", description: "تم إنشاء نسخة احتياطية يدوية بنجاح" });
      setShowManualDialog(false);
      setManualLabel("");
      refreshData();
    }
  };

  const handleRestore = () => {
    if (!restoreId) return;
    if (restoreFromBackupId(restoreId)) {
      toast({ title: "✅ تم الاستعادة", description: "جاري إعادة التحميل..." });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast({ title: "خطأ", description: "فشلت عملية الاستعادة", variant: "destructive" });
    }
    setRestoreId(null);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteBackup(deleteId);
    toast({ title: "تم الحذف", description: "تم حذف النسخة الاحتياطية" });
    setDeleteId(null);
    refreshData();
  };

  const handleIntervalChange = (val: string) => {
    const hours = parseInt(val, 10);
    setAutoBackupInterval(hours);
    setIntervalVal(hours);
    toast({ title: "تم التحديث", description: `سيتم النسخ التلقائي كل ${hours} ساعة` });
  };

  const handleForceAutoBackup = () => {
    const meta = createManualBackup("نسخة فورية");
    if (meta) {
      toast({ title: "✅ نسخة احتياطية", description: "تم إنشاء نسخة احتياطية فورية" });
      refreshData();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Backup Settings */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            إعدادات النسخ الاحتياطي التلقائي
          </CardTitle>
          <CardDescription>يتم إنشاء نسخ احتياطية تلقائياً بناءً على الفترة المحددة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">التكرار:</Label>
              <Select value={String(interval)} onValueChange={handleIntervalChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">كل ساعة</SelectItem>
                  <SelectItem value="6">كل 6 ساعات</SelectItem>
                  <SelectItem value="12">كل 12 ساعة</SelectItem>
                  <SelectItem value="24">يومياً</SelectItem>
                  <SelectItem value="168">أسبوعياً</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleForceAutoBackup} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              نسخ احتياطي الآن
            </Button>
          </div>
          {lastBackup && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              آخر نسخة تلقائية: {formatDate(lastBackup)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual Backup & Import/Export */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            النسخ الاحتياطي اليدوي
          </CardTitle>
          <CardDescription>تصدير أو استيراد أو إنشاء نسخة احتياطية يدوية</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setShowManualDialog(true)} className="gap-2">
              <Shield className="h-4 w-4" />
              إنشاء نسخة احتياطية
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              تصدير كملف
            </Button>
            <label>
              <Button variant="outline" className="gap-2" asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  استعادة من ملف
                </span>
              </Button>
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Integration */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            التخزين السحابي
          </CardTitle>
          <CardDescription>ربط البرنامج بخدمة سحابية لحفظ النسخ الاحتياطية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Lovable Cloud */}
            <div className="border rounded-xl p-4 flex flex-col items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <Cloud className="h-8 w-8 text-primary" />
              <h4 className="font-semibold text-sm">Lovable Cloud</h4>
              <p className="text-xs text-muted-foreground text-center">قاعدة بيانات سحابية مع مزامنة تلقائية</p>
              <Badge variant="outline" className="text-xs">
                <CloudOff className="h-3 w-3 ml-1" />
                غير متصل
              </Badge>
              <Button variant="outline" size="sm" className="w-full mt-2 gap-1" disabled>
                <Cloud className="h-3.5 w-3.5" />
                ربط
              </Button>
            </div>
            
            {/* Google Drive */}
            <div className="border rounded-xl p-4 flex flex-col items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <svg className="h-8 w-8" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <h4 className="font-semibold text-sm">Google Drive</h4>
              <p className="text-xs text-muted-foreground text-center">حفظ النسخ الاحتياطية على Google Drive</p>
              <Badge variant="outline" className="text-xs">
                <CloudOff className="h-3 w-3 ml-1" />
                غير متصل
              </Badge>
              <Button variant="outline" size="sm" className="w-full mt-2 gap-1" disabled>
                <Cloud className="h-3.5 w-3.5" />
                ربط
              </Button>
            </div>
            
            {/* OneDrive */}
            <div className="border rounded-xl p-4 flex flex-col items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <svg className="h-8 w-8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.5 14c0-.34-.04-.67-.09-1C21.47 12.35 23 10.36 23 8c0-2.76-2.24-5-5-5-1.34 0-2.55.53-3.45 1.38C13.73 3.53 12.42 3 11 3c-2.76 0-5 2.24-5 5 0 .31.03.61.08.91C3.66 9.45 2 11.49 2 14c0 3.31 2.69 6 6 6h10c2.76 0 5-2.24 5-5z" fill="#0078D4"/>
              </svg>
              <h4 className="font-semibold text-sm">OneDrive</h4>
              <p className="text-xs text-muted-foreground text-center">حفظ النسخ الاحتياطية على OneDrive</p>
              <Badge variant="outline" className="text-xs">
                <CloudOff className="h-3 w-3 ml-1" />
                غير متصل
              </Badge>
              <Button variant="outline" size="sm" className="w-full mt-2 gap-1" disabled>
                <Cloud className="h-3.5 w-3.5" />
                ربط
              </Button>
            </div>
            
            {/* Dropbox */}
            <div className="border rounded-xl p-4 flex flex-col items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <svg className="h-8 w-8" viewBox="0 0 43 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.6 0L0 8.3l8.6 6.9 12.5-8.2zm17.8 0l-9 6.9 12.5 8.2 8.6-6.9zM0 22l12.6 8.2 8.5-6.9-12.5-8.1zm30.4-8.8l-9 6.9 8.5 6.9 12.6-8.2zM12.6 32.5l8.5 6.8 8.5-6.8-8.5-6.9z" fill="#0061FF"/>
              </svg>
              <h4 className="font-semibold text-sm">Dropbox</h4>
              <p className="text-xs text-muted-foreground text-center">حفظ النسخ الاحتياطية على Dropbox</p>
              <Badge variant="outline" className="text-xs">
                <CloudOff className="h-3 w-3 ml-1" />
                غير متصل
              </Badge>
              <Button variant="outline" size="sm" className="w-full mt-2 gap-1" disabled>
                <Cloud className="h-3.5 w-3.5" />
                ربط
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <HardDrive className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              حالياً يتم الحفظ محلياً في المتصفح. لتفعيل التخزين السحابي يجب أولاً تفعيل Lovable Cloud ثم ربط الخدمة المطلوبة.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            سجل النسخ الاحتياطية ({backups.length})
          </CardTitle>
          <CardDescription>يمكنك استعادة أي نسخة سابقة أو حذفها</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد نسخ احتياطية محفوظة بعد</p>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${b.type === "auto" ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"}`}>
                      {b.type === "auto" ? <Clock className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {b.label || (b.type === "auto" ? "نسخة تلقائية" : "نسخة يدوية")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.timestamp)} • {formatSize(b.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRestoreId(b.id)} className="text-primary gap-1 h-8">
                      <RotateCcw className="h-3.5 w-3.5" />
                      استعادة
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(b.id)} className="text-destructive gap-1 h-8">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual backup dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء نسخة احتياطية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>وصف النسخة (اختياري)</Label>
            <Input
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              placeholder="مثال: قبل تحديث الأسعار"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>إلغاء</Button>
            <Button onClick={handleManualBackup} className="gap-2">
              <Shield className="h-4 w-4" />
              إنشاء نسخة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirm */}
      <DeleteConfirmDialog
        open={!!restoreId}
        onOpenChange={(open) => !open && setRestoreId(null)}
        onConfirm={handleRestore}
        title="استعادة نسخة احتياطية"
        description="سيتم استبدال جميع البيانات الحالية بالبيانات من النسخة المحددة. هل أنت متأكد؟"
      />

      {/* Delete confirm */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="حذف نسخة احتياطية"
        description="هل أنت متأكد من حذف هذه النسخة الاحتياطية؟ لا يمكن التراجع عن هذا الإجراء."
      />
    </div>
  );
}
