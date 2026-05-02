// ==============================
// BackupManager — REAL implementation only.
// - Local backups on server disk (configurable path)
// - Real OneDrive OAuth + upload (server-side)
// - No fakes, no setTimeout simulations, no localStorage configs.
// ==============================
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Database, Download, Upload, Trash2, RotateCcw, Cloud, CloudOff,
  HardDrive, RefreshCw, Loader2, FolderOpen, CheckCircle2, AlertCircle,
  Link2, Unlink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getBackupConfig, updateBackupConfig,
  getServerBackups, createServerBackup, restoreServerBackup,
  deleteServerBackup, getBackupDownloadUrl, restoreFromUpload,
  getOneDriveStatus, getOneDriveAuthUrl, disconnectOneDrive,
  type BackupMeta, type BackupConfig, type OneDriveStatus,
} from "@/data/store";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

export function BackupManager() {
  const { toast } = useToast();
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [oneDrive, setOneDrive] = useState<OneDriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualLabel, setManualLabel] = useState("");

  // Local form state for editing config
  const [pathInput, setPathInput] = useState("");
  const [intervalInput, setIntervalInput] = useState(24);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [onedriveUpload, setOnedriveUpload] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [cfg, list, od] = await Promise.all([
        getBackupConfig(),
        getServerBackups(),
        getOneDriveStatus(),
      ]);
      setConfig(cfg);
      setBackups(list);
      setOneDrive(od);
      setPathInput(cfg.localPath);
      setIntervalInput(cfg.intervalHours);
      setAutoEnabled(cfg.autoEnabled);
      setOnedriveUpload(cfg.onedriveUpload);
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل تحميل الإعدادات", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll OneDrive status while a connect window is open (every 4s for 2 min)
  useEffect(() => {
    const t = setInterval(async () => {
      try { setOneDrive(await getOneDriveStatus()); } catch {}
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const updated = await updateBackupConfig({
        localPath: pathInput.trim(),
        autoEnabled,
        intervalHours: intervalInput,
        onedriveUpload,
      });
      setConfig(updated);
      toast({ title: "✅ تم الحفظ", description: "تم تحديث إعدادات النسخ الاحتياطي" });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleCreateManual = async () => {
    setCreating(true);
    try {
      const result: any = await createServerBackup("manual", manualLabel || "");
      const cloudMsg = result?.cloud
        ? (result.cloud.ok ? " — وتم الرفع إلى OneDrive" : ` — فشل رفع OneDrive: ${result.cloud.error}`)
        : "";
      toast({ title: "✅ تم الإنشاء", description: `${result.filename}${cloudMsg}` });
      setShowManualDialog(false);
      setManualLabel("");
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل إنشاء النسخة", variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleRestoreConfirm = async () => {
    if (!restoreId) return;
    const ok = await restoreServerBackup(restoreId);
    setRestoreId(null);
    if (ok) {
      toast({ title: "✅ تم الاستعادة", description: "تم إنشاء نسخة أمان قبل الاستعادة. جاري إعادة التحميل..." });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast({ title: "خطأ", description: "فشلت الاستعادة", variant: "destructive" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteServerBackup(deleteId);
      toast({ title: "تم الحذف", description: "تم حذف النسخة الاحتياطية" });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل الحذف", variant: "destructive" });
    } finally { setDeleteId(null); }
  };

  const handleUploadRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const ok = await restoreFromUpload(ev.target?.result as string);
      if (ok) {
        toast({ title: "✅ تم الاستعادة", description: "تم إنشاء نسخة أمان قبل الاستعادة. جاري إعادة التحميل..." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "خطأ", description: "ملف غير صالح", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConnectOneDrive = async () => {
    try {
      const url = await getOneDriveAuthUrl();
      window.open(url, "onedrive_oauth", "width=560,height=720");
      toast({ title: "نافذة الربط", description: "أكمل تسجيل الدخول في النافذة المفتوحة" });
      // Refresh status a few times after window opens
      let tries = 0;
      const t = setInterval(async () => {
        tries++;
        try {
          const s = await getOneDriveStatus();
          setOneDrive(s);
          if (s.connected || tries > 30) clearInterval(t);
        } catch {}
      }, 3000);
    } catch (e: any) {
      toast({ title: "غير مكوَّن", description: e?.message || "OneDrive غير مهيأ على السيرفر", variant: "destructive" });
    }
  };

  const handleDisconnectOneDrive = async () => {
    try {
      await disconnectOneDrive();
      toast({ title: "تم الفصل", description: "تم فصل حساب OneDrive" });
      refresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل الفصل", variant: "destructive" });
    }
  };

  if (loading || !config) {
    return (
      <Card><CardContent className="p-12 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        جاري تحميل إعدادات النسخ الاحتياطي...
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backup config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4 text-primary" />
            إعدادات النسخ الاحتياطي المحلي
          </CardTitle>
          <CardDescription>تُحفظ النسخ على جهاز السيرفر في المسار المحدد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> مسار النسخ على السيرفر</Label>
            <Input
              dir="ltr"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder={config.defaultPath}
            />
            <p className="text-xs text-muted-foreground">
              المسار الحالي: <span dir="ltr">{config.localPath}</span>
              {config.pathExists ? (
                <span className="text-green-600 inline-flex items-center gap-1 mx-2"><CheckCircle2 className="h-3 w-3" /> موجود</span>
              ) : (
                <span className="text-amber-600 inline-flex items-center gap-1 mx-2"><AlertCircle className="h-3 w-3" /> سيتم إنشاؤه عند الحفظ</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الفترة بين النسخ التلقائية (ساعات)</Label>
              <Input type="number" min={1} max={168} value={intervalInput} onChange={(e) => setIntervalInput(Math.max(1, parseInt(e.target.value || "24", 10)))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-2">
              <div>
                <p className="font-medium text-sm">تفعيل النسخ التلقائي</p>
                <p className="text-xs text-muted-foreground">يعمل في الخلفية على السيرفر</p>
              </div>
              <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-2">
            <div>
              <p className="font-medium text-sm">رفع تلقائي إلى OneDrive بعد كل نسخة</p>
              <p className="text-xs text-muted-foreground">يتطلب ربط حساب OneDrive أدناه</p>
            </div>
            <Switch checked={onedriveUpload} onCheckedChange={setOnedriveUpload} disabled={!oneDrive?.connected} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              حفظ الإعدادات
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OneDrive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-primary" />
            Microsoft OneDrive
          </CardTitle>
          <CardDescription>تكامل حقيقي عبر Microsoft Graph (OAuth 2.0)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!oneDrive?.configured ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> غير مكوَّن على السيرفر
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {oneDrive?.reason || "أضف MS_CLIENT_ID و MS_CLIENT_SECRET في ملف backend/.env ثم أعد تشغيل السيرفر."}
              </p>
            </div>
          ) : oneDrive.connected ? (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-green-500/15 text-green-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{oneDrive.accountName || "OneDrive"}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{oneDrive.accountEmail || ""}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400">متصل</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border p-2"><span className="text-muted-foreground">آخر مزامنة: </span>{formatDate(oneDrive.lastSync)}</div>
                <div className="rounded-md border p-2">
                  <span className="text-muted-foreground">الحالة: </span>
                  {oneDrive.lastSyncStatus === "ok" ? <span className="text-green-600">ناجحة</span>
                    : oneDrive.lastSyncStatus === "error" ? <span className="text-destructive">{oneDrive.lastSyncError || "خطأ"}</span>
                    : "—"}
                </div>
              </div>
              <Button variant="outline" onClick={handleDisconnectOneDrive} className="gap-2 text-destructive hover:text-destructive">
                <Unlink className="h-4 w-4" /> فصل الحساب
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <CloudOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">غير مرتبط</p>
                    <p className="text-xs text-muted-foreground">اربط حساب Microsoft للرفع التلقائي</p>
                  </div>
                </div>
              </div>
              <Button onClick={handleConnectOneDrive} className="gap-2">
                <Link2 className="h-4 w-4" /> ربط حساب OneDrive
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Backups list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                النسخ الاحتياطية ({backups.length})
              </CardTitle>
              <CardDescription>تشمل النسخ التلقائية واليدوية ونسخ الأمان</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refresh} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> تحديث</Button>
              <Button size="sm" onClick={() => setShowManualDialog(true)} className="gap-2"><Database className="h-3.5 w-3.5" /> نسخة جديدة</Button>
              <label>
                <input type="file" accept=".json" className="hidden" onChange={handleUploadRestore} />
                <Button asChild variant="outline" size="sm" className="gap-2 cursor-pointer">
                  <span><Upload className="h-3.5 w-3.5" /> استعادة من ملف</span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد نسخ احتياطية بعد</p>
          ) : (
            <div className="space-y-2">
              {backups.map(b => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border bg-card p-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs truncate" dir="ltr">{b.filename}</span>
                      <Badge variant={b.type === "auto" ? "secondary" : b.type === "safety" ? "outline" : "default"} className="text-[10px]">
                        {b.type === "auto" ? "تلقائية" : b.type === "safety" ? "أمان" : "يدوية"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(b.createdAt)} · {formatSize(b.size)}{b.label ? ` · ${b.label}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button asChild variant="ghost" size="icon" title="تنزيل">
                      <a href={getBackupDownloadUrl(b.id)} download><Download className="h-4 w-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" title="استعادة" onClick={() => setRestoreId(b.id)}><RotateCcw className="h-4 w-4 text-amber-600" /></Button>
                    <Button variant="ghost" size="icon" title="حذف" onClick={() => setDeleteId(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual backup dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء نسخة احتياطية يدوية</DialogTitle>
            <DialogDescription>يمكنك إضافة وصف اختياري للنسخة</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>وصف (اختياري)</Label>
            <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="مثال: قبل تحديث الأسعار" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreateManual} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              إنشاء النسخة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirm */}
      <Dialog open={!!restoreId} onOpenChange={(o) => !o && setRestoreId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-600" /> تأكيد الاستعادة</DialogTitle>
            <DialogDescription>
              سيتم استبدال جميع البيانات الحالية بمحتوى هذه النسخة الاحتياطية.
              يتم تلقائياً إنشاء <strong>نسخة أمان</strong> للبيانات الحالية قبل التنفيذ.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreId(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleRestoreConfirm}>تأكيد الاستعادة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="حذف النسخة الاحتياطية"
        description="هل أنت متأكد من حذف هذه النسخة الاحتياطية؟ لا يمكن التراجع."
      />
    </div>
  );
}
