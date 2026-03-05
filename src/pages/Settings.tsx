import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save, Download, Upload, Database, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings, useUsers } from "@/data/hooks";
import { exportBackup, importBackup } from "@/data/store";

export default function Settings() {
  const { settings, updateSettings } = useCompanySettings();
  const { permissions } = useUsers();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...settings });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    updateSettings(form);
    toast({ title: "تم الحفظ", description: "تم تحديث إعدادات الشركة بنجاح" });
  };

  const handleExportBackup = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم التصدير", description: "تم تصدير النسخة الاحتياطية بنجاح" });
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (importBackup(result)) {
        setForm({ ...settings });
        toast({ title: "تم الاستعادة", description: "تم استعادة النسخة الاحتياطية بنجاح. يرجى إعادة تحميل الصفحة." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "خطأ", description: "ملف النسخة الاحتياطية غير صالح", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-header">الإعدادات</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              بيانات الشركة والطباعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label>اسم الشركة</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>رابط اللوجو (أو مسار الصورة)</Label>
                <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} dir="ltr" placeholder="/logo.png" />
                {form.logoUrl && (
                  <div className="mt-2 p-4 bg-muted/50 rounded-lg flex items-center gap-4">
                    <img src={form.logoUrl} alt="معاينة اللوجو" className="h-16 w-16 object-contain rounded-md border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-sm text-muted-foreground">معاينة اللوجو</span>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleSave} className="mt-6">
              <Save className="h-4 w-4 ml-2" />حفظ الإعدادات
            </Button>
          </CardContent>
        </Card>

        {/* Backup Section */}
        {permissions.backup && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5" />
                النسخ الاحتياطي واستعادة البيانات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                يمكنك تصدير جميع بيانات النظام كنسخة احتياطية (JSON) أو استعادتها من ملف سابق.
                في وضع Electron، يتم النسخ مباشرة من ملف SQLite.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleExportBackup}>
                  <Download className="h-4 w-4 ml-2" />
                  تصدير نسخة احتياطية
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 ml-2" />
                  استعادة من ملف
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
