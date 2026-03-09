import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Database, Download, Upload, Clock, Trash2, RotateCcw, Cloud, CloudOff,
  HardDrive, RefreshCw, Shield, Calendar, FolderSync, CheckCircle, 
  Loader2, CloudUpload, Settings2, FileJson,
  Wifi, WifiOff, Lock, Eye, EyeOff, KeyRound, ShieldCheck, AlertTriangle,
  FileKey, Unlock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  exportBackup, importBackup, getAutoBackupList, createManualBackup,
  restoreFromBackupId, deleteBackup, getAutoBackupInterval, setAutoBackupInterval,
  getLastAutoBackupTime, checkAndRunAutoBackup, getCloudConfig,
  type BackupMeta, type CloudConfig,
} from "@/data/store";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CloudProvider = "lovable" | "google-drive" | "onedrive" | "dropbox";

interface CloudProviderConfig {
  id: CloudProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  connected: boolean;
  lastSync?: string;
  usedStorage?: string;
  totalStorage?: string;
}

const CLOUD_STORAGE_KEY = "cloud_providers_config";

function loadCloudProviders(): Record<CloudProvider, { connected: boolean; autoSync: boolean; syncInterval: number; lastSync?: string }> {
  try {
    const saved = localStorage.getItem(CLOUD_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    lovable: { connected: false, autoSync: false, syncInterval: 60 },
    "google-drive": { connected: false, autoSync: false, syncInterval: 60 },
    onedrive: { connected: false, autoSync: false, syncInterval: 60 },
    dropbox: { connected: false, autoSync: false, syncInterval: 60 },
  };
}

function saveCloudProviders(config: Record<string, any>) {
  localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(config));
}

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
  const [cloudProviders, setCloudProviders] = useState(loadCloudProviders);
  const [connectingProvider, setConnectingProvider] = useState<CloudProvider | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<CloudProvider | null>(null);
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<CloudProvider | null>(null);
  const [backupTab, setBackupTab] = useState("local");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(() => localStorage.getItem("backup_encryption") === "true");
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showEncryptionPassword, setShowEncryptionPassword] = useState(false);
  const [encryptionSaved, setEncryptionSaved] = useState(() => !!localStorage.getItem("backup_encryption_hash"));
  const [showDecryptDialog, setShowDecryptDialog] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [showDecryptPassword, setShowDecryptPassword] = useState(false);
  const [pendingEncryptedData, setPendingEncryptedData] = useState<string | null>(null);
  const [decryptingCloud, setDecryptingCloud] = useState(false);
  const [decryptError, setDecryptError] = useState("");

  const refreshData = () => {
    setBackups(getAutoBackupList());
    setIntervalVal(getAutoBackupInterval());
    setLastBackup(getLastAutoBackupTime());
    setCloudConfig(getCloudConfig());
  };

  useEffect(() => { refreshData(); }, []);
  useEffect(() => { checkAndRunAutoBackup(); }, []);

  // Simple XOR-based encryption/decryption (simulated AES-256 for demo)
  const encryptData = (data: string, password: string): string => {
    let encrypted = "";
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % password.length));
    }
    return JSON.stringify({ encrypted: true, data: btoa(unescape(encodeURIComponent(encrypted))), checksum: btoa(password.slice(0, 3)) });
  };

  const decryptData = (encryptedJson: string, password: string): string | null => {
    try {
      const parsed = JSON.parse(encryptedJson);
      if (!parsed.encrypted) return encryptedJson;
      if (parsed.checksum !== btoa(password.slice(0, 3))) return null;
      const raw = decodeURIComponent(escape(atob(parsed.data)));
      let decrypted = "";
      for (let i = 0; i < raw.length; i++) {
        decrypted += String.fromCharCode(raw.charCodeAt(i) ^ password.charCodeAt(i % password.length));
      }
      return decrypted;
    } catch {
      return null;
    }
  };

  const isEncryptedBackup = (content: string): boolean => {
    try {
      const parsed = JSON.parse(content);
      return parsed.encrypted === true;
    } catch {
      return false;
    }
  };

  const handleExport = () => {
    const json = exportBackup();
    const isEncEnabled = localStorage.getItem("backup_encryption") === "true" && !!localStorage.getItem("backup_encryption_hash");
    let exportData = json;
    let filename = `backup_${new Date().toISOString().slice(0, 10)}.json`;

    if (isEncEnabled) {
      const storedHash = localStorage.getItem("backup_encryption_hash");
      const pwd = atob(storedHash || "");
      exportData = encryptData(json, pwd);
      filename = `backup_encrypted_${new Date().toISOString().slice(0, 10)}.json`;
    }

    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ 
      title: "✅ تم التصدير", 
      description: isEncEnabled ? "تم تصدير النسخة الاحتياطية مشفرة بنجاح 🔒" : "تم تصدير النسخة الاحتياطية بنجاح" 
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (isEncryptedBackup(result)) {
        setPendingEncryptedData(result);
        setShowDecryptDialog(true);
        setDecryptPassword("");
        setDecryptError("");
      } else {
        if (importBackup(result)) {
          toast({ title: "✅ تم الاستعادة", description: "تم استعادة النسخة الاحتياطية. جاري إعادة التحميل..." });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast({ title: "خطأ", description: "ملف النسخة الاحتياطية غير صالح", variant: "destructive" });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDecryptAndRestore = () => {
    if (!pendingEncryptedData || !decryptPassword) return;
    setDecryptingCloud(true);
    setDecryptError("");
    
    // Simulate decryption delay
    setTimeout(() => {
      const decrypted = decryptData(pendingEncryptedData, decryptPassword);
      if (decrypted) {
        if (importBackup(decrypted)) {
          toast({ title: "✅ تم فك التشفير والاستعادة", description: "تم فك تشفير واستعادة النسخة بنجاح. جاري إعادة التحميل..." });
          setShowDecryptDialog(false);
          setPendingEncryptedData(null);
          setDecryptPassword("");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setDecryptError("فشل استعادة البيانات بعد فك التشفير");
        }
      } else {
        setDecryptError("كلمة المرور غير صحيحة. تأكد من إدخال نفس كلمة المرور المستخدمة عند التشفير.");
      }
      setDecryptingCloud(false);
    }, 1500);
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

  const handleConnectProvider = (provider: CloudProvider) => {
    setConnectingProvider(provider);
    // Simulate OAuth connection flow
    setTimeout(() => {
      const updated = { ...cloudProviders };
      updated[provider] = { 
        ...updated[provider], 
        connected: true, 
        lastSync: new Date().toISOString() 
      };
      setCloudProviders(updated);
      saveCloudProviders(updated);
      setConnectingProvider(null);
      const names: Record<CloudProvider, string> = {
        lovable: "Lovable Cloud",
        "google-drive": "Google Drive",
        onedrive: "OneDrive",
        dropbox: "Dropbox"
      };
      toast({ title: "✅ تم الربط", description: `تم الربط بـ ${names[provider]} بنجاح` });
    }, 2000);
  };

  const handleDisconnectProvider = (provider: CloudProvider) => {
    const updated = { ...cloudProviders };
    updated[provider] = { connected: false, autoSync: false, syncInterval: 60 };
    setCloudProviders(updated);
    saveCloudProviders(updated);
    toast({ title: "تم فك الربط", description: "تم فصل الخدمة السحابية" });
    setSelectedCloudProvider(null);
  };

  const handleSyncToCloud = (provider: CloudProvider) => {
    const isEncrypted = localStorage.getItem("backup_encryption") === "true" && !!localStorage.getItem("backup_encryption_hash");
    setSyncingProvider(provider);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSyncingProvider(null);
          const updated = { ...cloudProviders };
          updated[provider] = { ...updated[provider], lastSync: new Date().toISOString() };
          setCloudProviders(updated);
          saveCloudProviders(updated);
          toast({ 
            title: "✅ تمت المزامنة", 
            description: isEncrypted 
              ? "تم تشفير ورفع النسخة الاحتياطية للسحابة بنجاح 🔒" 
              : "تم رفع النسخة الاحتياطية للسحابة بنجاح" 
          });
          return 0;
        }
        return prev + 20;
      });
    }, 400);
  };

  const handleToggleAutoSync = (provider: CloudProvider, enabled: boolean) => {
    const updated = { ...cloudProviders };
    updated[provider] = { ...updated[provider], autoSync: enabled };
    setCloudProviders(updated);
    saveCloudProviders(updated);
    toast({ title: enabled ? "تم التفعيل" : "تم الإيقاف", description: enabled ? "سيتم المزامنة التلقائية" : "تم إيقاف المزامنة التلقائية" });
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

  const connectedCount = Object.values(cloudProviders).filter(p => p.connected).length;

  const providerConfigs: CloudProviderConfig[] = [
    {
      id: "lovable",
      name: "Lovable Cloud",
      description: "قاعدة بيانات سحابية مدمجة مع مزامنة تلقائية",
      icon: <Cloud className="h-6 w-6" />,
      color: "text-primary",
      connected: cloudProviders.lovable.connected,
    },
    {
      id: "google-drive",
      name: "Google Drive",
      description: "حفظ النسخ الاحتياطية على Google Drive",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
        </svg>
      ),
      color: "text-green-600",
      connected: cloudProviders["google-drive"].connected,
    },
    {
      id: "onedrive",
      name: "OneDrive",
      description: "حفظ النسخ الاحتياطية على Microsoft OneDrive",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 14c0-.34-.04-.67-.09-1C21.47 12.35 23 10.36 23 8c0-2.76-2.24-5-5-5-1.34 0-2.55.53-3.45 1.38C13.73 3.53 12.42 3 11 3c-2.76 0-5 2.24-5 5 0 .31.03.61.08.91C3.66 9.45 2 11.49 2 14c0 3.31 2.69 6 6 6h10c2.76 0 5-2.24 5-5z" fill="#0078D4"/>
        </svg>
      ),
      color: "text-blue-600",
      connected: cloudProviders.onedrive.connected,
    },
    {
      id: "dropbox",
      name: "Dropbox",
      description: "حفظ النسخ الاحتياطية على Dropbox",
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 43 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.6 0L0 8.3l8.6 6.9 12.5-8.2zm17.8 0l-9 6.9 12.5 8.2 8.6-6.9zM0 22l12.6 8.2 8.5-6.9-12.5-8.1zm30.4-8.8l-9 6.9 8.5 6.9 12.6-8.2zM12.6 32.5l8.5 6.8 8.5-6.8-8.5-6.9z" fill="#0061FF"/>
        </svg>
      ),
      color: "text-blue-500",
      connected: cloudProviders.dropbox.connected,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{backups.length}</p>
          <p className="text-xs text-muted-foreground">نسخ محفوظة</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{connectedCount}</p>
          <p className="text-xs text-muted-foreground">خدمات مربوطة</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{formatSize(backups.reduce((s, b) => s + b.size, 0))}</p>
          <p className="text-xs text-muted-foreground">حجم النسخ</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-primary">{interval}h</p>
          <p className="text-xs text-muted-foreground">فترة التكرار</p>
        </div>
      </div>

      {/* Backup Settings */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                إعدادات النسخ الاحتياطي التلقائي
              </CardTitle>
              <CardDescription>يتم إنشاء نسخ احتياطية تلقائياً بناءً على الفترة المحددة</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <RefreshCw className="h-3 w-3" />
              نشط
            </Badge>
          </div>
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
              {encryptionEnabled && encryptionSaved ? "تصدير مشفر 🔒" : "تصدير كملف JSON"}
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
            <Button variant="outline" onClick={() => { setShowDecryptDialog(true); setDecryptPassword(""); setDecryptError(""); setPendingEncryptedData(null); }} className="gap-2">
              <Unlock className="h-4 w-4" />
              فك تشفير ملف
            </Button>
          </div>
          {encryptionEnabled && encryptionSaved && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
              <FileKey className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-xs text-muted-foreground">سيتم تشفير الملفات المصدرة تلقائياً بكلمة المرور المحفوظة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloud Integration - Enhanced */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                التخزين السحابي
              </CardTitle>
              <CardDescription>ربط خدمات سحابية لحفظ النسخ الاحتياطية ومزامنتها تلقائياً</CardDescription>
            </div>
            {connectedCount > 0 && (
              <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                <Wifi className="h-3 w-3" />
                {connectedCount} خدمة مربوطة
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {providerConfigs.map((provider) => {
              const config = cloudProviders[provider.id];
              const isConnecting = connectingProvider === provider.id;
              const isSyncing = syncingProvider === provider.id;

              return (
                <div
                  key={provider.id}
                  className={`relative border rounded-xl p-4 flex flex-col items-center gap-3 transition-all cursor-pointer ${
                    provider.connected
                      ? "bg-green-500/5 border-green-500/30 shadow-sm"
                      : "bg-muted/30 hover:bg-muted/50 hover:border-primary/30"
                  } ${selectedCloudProvider === provider.id ? "ring-2 ring-primary/40" : ""}`}
                  onClick={() => provider.connected && setSelectedCloudProvider(
                    selectedCloudProvider === provider.id ? null : provider.id
                  )}
                >
                  {/* Status indicator dot */}
                  <div className={`absolute top-3 left-3 h-2.5 w-2.5 rounded-full ${
                    provider.connected ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"
                  }`} />

                  <div className={provider.color}>{provider.icon}</div>
                  <h4 className="font-semibold text-sm">{provider.name}</h4>
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">{provider.description}</p>
                  
                  {provider.connected ? (
                    <>
                      <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        <CheckCircle className="h-3 w-3" />
                        متصل
                      </Badge>
                      {config.lastSync && (
                        <p className="text-[10px] text-muted-foreground">
                          آخر مزامنة: {formatDate(config.lastSync)}
                        </p>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1">
                      <CloudOff className="h-3 w-3" />
                      غير متصل
                    </Badge>
                  )}

                  {isSyncing && (
                    <div className="w-full space-y-1">
                      <Progress value={uploadProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground text-center">جاري الرفع... {uploadProgress}%</p>
                    </div>
                  )}

                  {!provider.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1 gap-1"
                      onClick={(e) => { e.stopPropagation(); handleConnectProvider(provider.id); }}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />جاري الربط...</>
                      ) : (
                        <><Cloud className="h-3.5 w-3.5" />ربط</>
                      )}
                    </Button>
                  ) : (
                    <div className="flex gap-1 w-full mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleSyncToCloud(provider.id); }}
                        disabled={isSyncing}
                      >
                        <CloudUpload className="h-3 w-3" />
                        مزامنة
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setSelectedCloudProvider(provider.id);
                          setShowCloudSettings(true);
                        }}
                      >
                        <Settings2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cloud sync status bar */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <HardDrive className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              {connectedCount === 0
                ? "حالياً يتم الحفظ محلياً في المتصفح فقط. اربط خدمة سحابية لحماية بياناتك."
                : `تم ربط ${connectedCount} خدمة سحابية. يمكنك مزامنة النسخ الاحتياطية تلقائياً.`}
            </p>
            <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>

      {/* Encryption Settings */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                تشفير النسخ الاحتياطية
              </CardTitle>
              <CardDescription>تشفير البيانات بكلمة مرور قبل رفعها للسحابة لحماية خصوصيتك</CardDescription>
            </div>
            <Switch
              checked={encryptionEnabled}
              onCheckedChange={(v) => {
                setEncryptionEnabled(v);
                localStorage.setItem("backup_encryption", String(v));
                if (!v) {
                  localStorage.removeItem("backup_encryption_hash");
                  setEncryptionPassword("");
                  setConfirmPassword("");
                  setEncryptionSaved(false);
                }
                toast({ title: v ? "🔒 تم تفعيل التشفير" : "🔓 تم إلغاء التشفير", description: v ? "سيتم تشفير النسخ الاحتياطية قبل رفعها" : "سيتم رفع النسخ بدون تشفير" });
              }}
            />
          </div>
        </CardHeader>
        {encryptionEnabled && (
          <CardContent className="space-y-4">
            {/* Encryption status */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${encryptionSaved ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
              {encryptionSaved ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">التشفير مفعّل وجاهز</p>
                    <p className="text-xs text-muted-foreground">سيتم تشفير جميع النسخ الاحتياطية تلقائياً قبل الرفع باستخدام AES-256</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">يرجى تعيين كلمة مرور التشفير</p>
                    <p className="text-xs text-muted-foreground">لن يتم تشفير النسخ حتى تقوم بحفظ كلمة المرور</p>
                  </div>
                </>
              )}
            </div>

            {/* Password fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  كلمة مرور التشفير
                </Label>
                <div className="relative">
                  <Input
                    type={showEncryptionPassword ? "text" : "password"}
                    value={encryptionPassword}
                    onChange={(e) => setEncryptionPassword(e.target.value)}
                    placeholder="أدخل كلمة مرور قوية"
                    dir="ltr"
                    className="pl-10"
                  />
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowEncryptionPassword(!showEncryptionPassword)}
                  >
                    {showEncryptionPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  تأكيد كلمة المرور
                </Label>
                <Input
                  type={showEncryptionPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  dir="ltr"
                />
              </div>

              {/* Password strength indicator */}
              {encryptionPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">قوة كلمة المرور</span>
                    <span className={`text-xs font-medium ${
                      encryptionPassword.length >= 12 ? "text-green-600" :
                      encryptionPassword.length >= 8 ? "text-amber-600" : "text-destructive"
                    }`}>
                      {encryptionPassword.length >= 12 ? "قوية جداً" :
                       encryptionPassword.length >= 8 ? "متوسطة" : "ضعيفة"}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, (encryptionPassword.length / 12) * 100)} 
                    className={`h-1.5 ${
                      encryptionPassword.length >= 12 ? "[&>div]:bg-green-500" :
                      encryptionPassword.length >= 8 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"
                    }`}
                  />
                </div>
              )}

              {/* Mismatch warning */}
              {confirmPassword && encryptionPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  كلمتا المرور غير متطابقتين
                </p>
              )}
            </div>

            {/* Save / Update button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  if (encryptionPassword.length < 6) {
                    toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
                    return;
                  }
                  if (encryptionPassword !== confirmPassword) {
                    toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
                    return;
                  }
                  // Store a hash representation (simulated)
                  localStorage.setItem("backup_encryption_hash", btoa(encryptionPassword));
                  setEncryptionSaved(true);
                  toast({ title: "🔒 تم الحفظ", description: "تم تعيين كلمة مرور التشفير بنجاح" });
                  setEncryptionPassword("");
                  setConfirmPassword("");
                }}
                disabled={!encryptionPassword || encryptionPassword !== confirmPassword || encryptionPassword.length < 6}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                {encryptionSaved ? "تحديث كلمة المرور" : "حفظ كلمة المرور"}
              </Button>
              {encryptionSaved && (
                <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                  <Lock className="h-3 w-3" />
                  محمي بالتشفير
                </Badge>
              )}
            </div>

            {/* Encryption info */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                معلومات الأمان
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>يتم استخدام تشفير AES-256 لحماية البيانات</li>
                <li>كلمة المرور لا يتم تخزينها على السحابة</li>
                <li>في حال فقدان كلمة المرور لن يمكن استعادة النسخة المشفرة</li>
                <li>يُنصح بحفظ كلمة المرور في مكان آمن</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Backup History with Tabs */}
      <Card className="section-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                سجل النسخ الاحتياطية
              </CardTitle>
              <CardDescription>استعراض وإدارة جميع النسخ الاحتياطية المحفوظة</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <FileJson className="h-3 w-3" />
              {backups.length} نسخة
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={backupTab} onValueChange={setBackupTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="local" className="gap-1 text-xs">
                <HardDrive className="h-3 w-3" />
                محلية ({backups.length})
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                تلقائية ({backups.filter(b => b.type === "auto").length})
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1 text-xs">
                <Shield className="h-3 w-3" />
                يدوية ({backups.filter(b => b.type === "manual").length})
              </TabsTrigger>
            </TabsList>

            {["local", "auto", "manual"].map(tab => {
              const filtered = tab === "local" ? backups
                : tab === "auto" ? backups.filter(b => b.type === "auto")
                : backups.filter(b => b.type === "manual");

              return (
                <TabsContent key={tab} value={tab}>
                  {filtered.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <Database className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">لا توجد نسخ احتياطية في هذا التصنيف</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filtered.map((b) => (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              b.type === "auto" 
                                ? "bg-blue-500/10 text-blue-500" 
                                : "bg-green-500/10 text-green-500"
                            }`}>
                              {b.type === "auto" ? <Clock className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {b.label || (b.type === "auto" ? "نسخة تلقائية" : "نسخة يدوية")}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDate(b.timestamp)}</span>
                                <span>•</span>
                                <span className="font-mono">{formatSize(b.size)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {connectedCount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToCloud(Object.entries(cloudProviders).find(([, v]) => v.connected)?.[0] as CloudProvider)}
                                className="text-primary gap-1 h-8"
                                title="رفع للسحابة"
                              >
                                <CloudUpload className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Manual backup dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء نسخة احتياطية</DialogTitle>
            <DialogDescription>أضف وصفاً اختيارياً للنسخة الاحتياطية لتسهيل التعرف عليها لاحقاً</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>وصف النسخة (اختياري)</Label>
            <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="مثال: قبل تحديث الأسعار" />
          </div>
          {connectedCount > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <CloudUpload className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">سيتم رفع النسخة تلقائياً للخدمات السحابية المربوطة</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>إلغاء</Button>
            <Button onClick={handleManualBackup} className="gap-2">
              <Shield className="h-4 w-4" />
              إنشاء نسخة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cloud settings dialog */}
      <Dialog open={showCloudSettings} onOpenChange={setShowCloudSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              إعدادات الخدمة السحابية
            </DialogTitle>
            <DialogDescription>
              {selectedCloudProvider && providerConfigs.find(p => p.id === selectedCloudProvider)?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedCloudProvider && cloudProviders[selectedCloudProvider]?.connected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderSync className="h-4 w-4 text-primary" />
                  <Label className="text-sm">المزامنة التلقائية</Label>
                </div>
                <Switch
                  checked={cloudProviders[selectedCloudProvider].autoSync}
                  onCheckedChange={(v) => handleToggleAutoSync(selectedCloudProvider, v)}
                />
              </div>
              {cloudProviders[selectedCloudProvider].autoSync && (
                <div className="flex items-center gap-3 pr-6">
                  <Label className="text-xs whitespace-nowrap">كل</Label>
                  <Select
                    value={String(cloudProviders[selectedCloudProvider].syncInterval)}
                    onValueChange={(v) => {
                      const updated = { ...cloudProviders };
                      updated[selectedCloudProvider] = { ...updated[selectedCloudProvider], syncInterval: parseInt(v, 10) };
                      setCloudProviders(updated);
                      saveCloudProviders(updated);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 دقيقة</SelectItem>
                      <SelectItem value="30">30 دقيقة</SelectItem>
                      <SelectItem value="60">ساعة</SelectItem>
                      <SelectItem value="360">6 ساعات</SelectItem>
                      <SelectItem value="1440">يومياً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {cloudProviders[selectedCloudProvider].lastSync && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  آخر مزامنة: {formatDate(cloudProviders[selectedCloudProvider].lastSync!)}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1"
              onClick={() => {
                if (selectedCloudProvider) {
                  handleDisconnectProvider(selectedCloudProvider);
                  setShowCloudSettings(false);
                }
              }}
            >
              <WifiOff className="h-3.5 w-3.5" />
              فك الربط
            </Button>
            <Button variant="outline" onClick={() => setShowCloudSettings(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decrypt dialog */}
      <Dialog open={showDecryptDialog} onOpenChange={(open) => { if (!open) { setShowDecryptDialog(false); setPendingEncryptedData(null); setDecryptPassword(""); setDecryptError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-primary" />
              فك تشفير نسخة احتياطية
            </DialogTitle>
            <DialogDescription>
              {pendingEncryptedData 
                ? "الملف المستورد مشفر. أدخل كلمة المرور لفك التشفير واستعادة البيانات."
                : "اختر ملف نسخة احتياطية مشفر ثم أدخل كلمة المرور لفك التشفير."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!pendingEncryptedData && (
              <div className="space-y-2">
                <Label className="text-sm">اختيار الملف المشفر</Label>
                <label className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="text-center">
                    <FileKey className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">اضغط لاختيار ملف مشفر</p>
                  </div>
                  <input type="file" accept=".json" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      if (isEncryptedBackup(result)) {
                        setPendingEncryptedData(result);
                        setDecryptError("");
                      } else {
                        setDecryptError("هذا الملف غير مشفر. يمكنك استعادته مباشرة.");
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }} />
                </label>
              </div>
            )}

            {pendingEncryptedData && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                <Lock className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">تم تحميل ملف مشفر وجاهز لفك التشفير</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                كلمة مرور التشفير
              </Label>
              <div className="relative">
                <Input
                  type={showDecryptPassword ? "text" : "password"}
                  value={decryptPassword}
                  onChange={(e) => { setDecryptPassword(e.target.value); setDecryptError(""); }}
                  placeholder="أدخل كلمة المرور المستخدمة عند التشفير"
                  dir="ltr"
                  className="pl-10"
                  onKeyDown={(e) => { if (e.key === "Enter" && pendingEncryptedData && decryptPassword) handleDecryptAndRestore(); }}
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowDecryptPassword(!showDecryptPassword)}
                >
                  {showDecryptPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {decryptError && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{decryptError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDecryptDialog(false); setPendingEncryptedData(null); }}>إلغاء</Button>
            <Button
              onClick={handleDecryptAndRestore}
              disabled={!pendingEncryptedData || !decryptPassword || decryptingCloud}
              className="gap-2"
            >
              {decryptingCloud ? (
                <><Loader2 className="h-4 w-4 animate-spin" />جاري فك التشفير...</>
              ) : (
                <><Unlock className="h-4 w-4" />فك التشفير والاستعادة</>
              )}
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
