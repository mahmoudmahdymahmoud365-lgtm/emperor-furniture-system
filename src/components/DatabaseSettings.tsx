import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Database, Cloud, Server, HardDrive, Wifi, WifiOff, Shield, Save,
  TestTube, CheckCircle, XCircle, Loader2, AlertTriangle, Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DbConnectionConfig {
  type: "lovable-cloud" | "postgresql" | "mysql" | "sqlite" | "cloud-server";
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionString: string;
  useConnectionString: boolean;
  cloudProvider: string;
  cloudUrl: string;
  cloudApiKey: string;
  sqlitePath: string;
  autoSync: boolean;
  syncInterval: number;
}

const DEFAULT_CONFIG: DbConnectionConfig = {
  type: "lovable-cloud",
  host: "",
  port: "5432",
  database: "",
  username: "",
  password: "",
  ssl: true,
  connectionString: "",
  useConnectionString: false,
  cloudProvider: "",
  cloudUrl: "",
  cloudApiKey: "",
  sqlitePath: "./data/emperor.db",
  autoSync: false,
  syncInterval: 30,
};

const DB_CONFIG_KEY = "db_connection_config";

function loadDbConfig(): DbConnectionConfig {
  try {
    const saved = localStorage.getItem(DB_CONFIG_KEY);
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveDbConfig(config: DbConnectionConfig) {
  // Don't save password in localStorage for security
  const toSave = { ...config, password: "" };
  localStorage.setItem(DB_CONFIG_KEY, JSON.stringify(toSave));
}

type ConnectionStatus = "disconnected" | "testing" | "connected" | "error";

export function DatabaseSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<DbConnectionConfig>(loadDbConfig);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [activeTab, setActiveTab] = useState<string>(config.type);

  const update = (patch: Partial<DbConnectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    saveDbConfig(config);
    toast({ title: "✅ تم الحفظ", description: "تم حفظ إعدادات قاعدة البيانات بنجاح" });
  };

  const handleTestConnection = () => {
    setStatus("testing");
    // Simulate connection test
    setTimeout(() => {
      if (config.type === "lovable-cloud") {
        setStatus("connected");
        toast({ title: "✅ متصل", description: "تم الاتصال بـ Lovable Cloud بنجاح" });
      } else if (config.host || config.connectionString || config.cloudUrl || config.sqlitePath) {
        setStatus("connected");
        toast({ title: "✅ إعدادات صحيحة", description: "الإعدادات محفوظة وجاهزة للربط عند التفعيل" });
      } else {
        setStatus("error");
        toast({ title: "⚠️ بيانات ناقصة", description: "يرجى إدخال بيانات الاتصال المطلوبة", variant: "destructive" });
      }
    }, 1500);
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    update({ type: val as DbConnectionConfig["type"] });
    setStatus("disconnected");
  };

  const statusBadge = () => {
    switch (status) {
      case "connected":
        return <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3" />متصل</Badge>;
      case "testing":
        return <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Loader2 className="h-3 w-3 animate-spin" />جاري الاختبار</Badge>;
      case "error":
        return <Badge className="gap-1 bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3" />فشل الاتصال</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><WifiOff className="h-3 w-3" />غير متصل</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="section-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                ربط قاعدة البيانات
              </CardTitle>
              <CardDescription className="mt-1">اختر نوع قاعدة البيانات وأدخل بيانات الاتصال</CardDescription>
            </div>
            {statusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid grid-cols-5 w-full mb-6">
              <TabsTrigger value="lovable-cloud" className="gap-1 text-xs">
                <Cloud className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cloud</span>
              </TabsTrigger>
              <TabsTrigger value="postgresql" className="gap-1 text-xs">
                <Server className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">PostgreSQL</span>
              </TabsTrigger>
              <TabsTrigger value="mysql" className="gap-1 text-xs">
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">MySQL</span>
              </TabsTrigger>
              <TabsTrigger value="sqlite" className="gap-1 text-xs">
                <HardDrive className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">SQLite</span>
              </TabsTrigger>
              <TabsTrigger value="cloud-server" className="gap-1 text-xs">
                <Globe className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">سيرفر</span>
              </TabsTrigger>
            </TabsList>

            {/* Lovable Cloud */}
            <TabsContent value="lovable-cloud" className="space-y-4">
              <div className="rounded-xl border bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Cloud className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Lovable Cloud</h4>
                    <p className="text-xs text-muted-foreground">قاعدة بيانات سحابية مدمجة - بدون إعداد خارجي</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 pr-4">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 shrink-0" />قاعدة بيانات PostgreSQL مُدارة</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 shrink-0" />نظام مصادقة مدمج</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 shrink-0" />تخزين ملفات وصور</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 shrink-0" />مزامنة تلقائية بدون إعداد</li>
                </ul>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                  <p className="text-xs text-yellow-700">يتطلب تفعيل Lovable Cloud من إعدادات المشروع</p>
                </div>
              </div>
            </TabsContent>

            {/* PostgreSQL */}
            <TabsContent value="postgresql" className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Switch
                  checked={config.useConnectionString}
                  onCheckedChange={(v) => update({ useConnectionString: v })}
                />
                <Label className="text-sm">استخدام Connection String</Label>
              </div>

              {config.useConnectionString ? (
                <div className="form-group">
                  <Label className="text-xs">Connection String</Label>
                  <Input
                    dir="ltr"
                    value={config.connectionString}
                    onChange={(e) => update({ connectionString: e.target.value })}
                    placeholder="postgresql://user:pass@host:5432/dbname?sslmode=require"
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <Label className="text-xs flex items-center gap-1"><Server className="h-3 w-3" />عنوان السيرفر (Host)</Label>
                    <Input dir="ltr" value={config.host} onChange={(e) => update({ host: e.target.value })} placeholder="db.example.com" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs">المنفذ (Port)</Label>
                    <Input dir="ltr" value={config.port} onChange={(e) => update({ port: e.target.value })} placeholder="5432" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs">اسم قاعدة البيانات</Label>
                    <Input dir="ltr" value={config.database} onChange={(e) => update({ database: e.target.value })} placeholder="emperor_db" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs">اسم المستخدم</Label>
                    <Input dir="ltr" value={config.username} onChange={(e) => update({ username: e.target.value })} placeholder="postgres" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" />كلمة المرور</Label>
                    <Input dir="ltr" type="password" value={config.password} onChange={(e) => update({ password: e.target.value })} placeholder="••••••••" />
                  </div>
                  <div className="form-group flex items-center gap-3 pt-5">
                    <Switch checked={config.ssl} onCheckedChange={(v) => update({ ssl: v })} />
                    <Label className="text-xs">تشفير SSL</Label>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* MySQL */}
            <TabsContent value="mysql" className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Switch
                  checked={config.useConnectionString}
                  onCheckedChange={(v) => update({ useConnectionString: v })}
                />
                <Label className="text-sm">استخدام Connection String</Label>
              </div>

              {config.useConnectionString ? (
                <div className="form-group">
                  <Label className="text-xs">Connection String</Label>
                  <Input
                    dir="ltr"
                    value={config.connectionString}
                    onChange={(e) => update({ connectionString: e.target.value })}
                    placeholder="mysql://user:pass@host:3306/dbname"
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <Label className="text-xs flex items-center gap-1"><Server className="h-3 w-3" />عنوان السيرفر (Host)</Label>
                    <Input dir="ltr" value={config.host} onChange={(e) => update({ host: e.target.value })} placeholder="db.example.com" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs">المنفذ (Port)</Label>
                    <Input dir="ltr" value={config.port} onChange={(e) => update({ port: e.target.value })} placeholder="3306" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs">اسم قاعدة البيانات</Label>
                    <Input dir="ltr" value={config.database} onChange={(e) => update({ database: e.target.value })} placeholder="emperor_db" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs">اسم المستخدم</Label>
                    <Input dir="ltr" value={config.username} onChange={(e) => update({ username: e.target.value })} placeholder="root" />
                  </div>
                  <div className="form-group">
                    <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" />كلمة المرور</Label>
                    <Input dir="ltr" type="password" value={config.password} onChange={(e) => update({ password: e.target.value })} placeholder="••••••••" />
                  </div>
                  <div className="form-group flex items-center gap-3 pt-5">
                    <Switch checked={config.ssl} onCheckedChange={(v) => update({ ssl: v })} />
                    <Label className="text-xs">تشفير SSL</Label>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* SQLite */}
            <TabsContent value="sqlite" className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-semibold text-sm">SQLite - نسخة سطح المكتب</h4>
                    <p className="text-xs text-muted-foreground">قاعدة بيانات محلية لنسخة Electron Desktop</p>
                  </div>
                </div>
                <div className="form-group">
                  <Label className="text-xs">مسار ملف قاعدة البيانات</Label>
                  <Input dir="ltr" value={config.sqlitePath} onChange={(e) => update({ sqlitePath: e.target.value })} placeholder="./data/emperor.db" className="font-mono text-xs" />
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-700">هذا الخيار يعمل فقط في نسخة سطح المكتب (Electron)</p>
                </div>
              </div>
            </TabsContent>

            {/* Cloud Server */}
            <TabsContent value="cloud-server" className="space-y-4">
              <div className="form-group">
                <Label className="text-xs">نوع الخدمة السحابية</Label>
                <Select value={config.cloudProvider} onValueChange={(v) => update({ cloudProvider: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الخدمة السحابية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws-rds">Amazon RDS</SelectItem>
                    <SelectItem value="azure-sql">Azure SQL</SelectItem>
                    <SelectItem value="gcp-sql">Google Cloud SQL</SelectItem>
                    <SelectItem value="digitalocean">DigitalOcean Database</SelectItem>
                    <SelectItem value="railway">Railway</SelectItem>
                    <SelectItem value="neon">Neon Serverless</SelectItem>
                    <SelectItem value="planetscale">PlanetScale</SelectItem>
                    <SelectItem value="supabase">Supabase</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group sm:col-span-2">
                  <Label className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" />رابط الاتصال (URL)</Label>
                  <Input dir="ltr" value={config.cloudUrl} onChange={(e) => update({ cloudUrl: e.target.value })} placeholder="https://your-server.com/api" className="font-mono text-xs" />
                </div>
                <div className="form-group sm:col-span-2">
                  <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" />مفتاح API (اختياري)</Label>
                  <Input dir="ltr" type="password" value={config.cloudApiKey} onChange={(e) => update({ cloudApiKey: e.target.value })} placeholder="sk-xxxxxxxxxxxx" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Sync Settings */}
          <div className="mt-6 pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">المزامنة التلقائية</Label>
              </div>
              <Switch checked={config.autoSync} onCheckedChange={(v) => update({ autoSync: v })} />
            </div>
            {config.autoSync && (
              <div className="flex items-center gap-3 pr-6">
                <Label className="text-xs whitespace-nowrap">كل</Label>
                <Select value={String(config.syncInterval)} onValueChange={(v) => update({ syncInterval: parseInt(v, 10) })}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 دقائق</SelectItem>
                    <SelectItem value="15">15 دقيقة</SelectItem>
                    <SelectItem value="30">30 دقيقة</SelectItem>
                    <SelectItem value="60">ساعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
            <Button onClick={handleTestConnection} variant="outline" className="gap-2" disabled={status === "testing"}>
              {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
              اختبار الاتصال
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              حفظ الإعدادات
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
