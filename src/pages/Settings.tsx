import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Save, ImagePlus, Phone, Mail, Plus, X, Building2, MapPin, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings, useUsers } from "@/data/hooks";
import { BackupManager } from "@/components/BackupManager";

export default function Settings() {
  const { settings, updateSettings } = useCompanySettings();
  const { permissions } = useUsers();
  const { toast } = useToast();
  const [form, setForm] = useState({
    ...settings,
    phones: settings.phones?.length ? settings.phones : [settings.phone || ""],
    emails: settings.emails?.length ? settings.emails : [settings.email || ""],
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const toSave = {
      ...form,
      phone: form.phones[0] || "",
      email: form.emails[0] || "",
    };
    updateSettings(toSave);
    toast({ title: "✅ تم الحفظ", description: "تم تحديث إعدادات الشركة بنجاح" });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "خطأ", description: "يرجى اختيار ملف صورة", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setForm({ ...form, logoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const addPhone = () => setForm({ ...form, phones: [...form.phones, ""] });
  const removePhone = (i: number) => {
    if (form.phones.length <= 1) return;
    setForm({ ...form, phones: form.phones.filter((_: string, idx: number) => idx !== i) });
  };
  const updatePhone = (i: number, val: string) => {
    const phones = [...form.phones];
    phones[i] = val;
    setForm({ ...form, phones });
  };

  const addEmail = () => setForm({ ...form, emails: [...form.emails, ""] });
  const removeEmail = (i: number) => {
    if (form.emails.length <= 1) return;
    setForm({ ...form, emails: form.emails.filter((_: string, idx: number) => idx !== i) });
  };
  const updateEmail = (i: number, val: string) => {
    const emails = [...form.emails];
    emails[i] = val;
    setForm({ ...form, emails });
  };

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-primary" />
              </div>
              الإعدادات
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">إدارة بيانات الشركة والنسخ الاحتياطي</p>
          </div>
          <Button onClick={handleSave} size="lg" className="gap-2 shadow-md">
            <Save className="h-4 w-4" />
            حفظ الإعدادات
          </Button>
        </div>

        {/* Company Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logo Card */}
          <Card className="section-card lg:row-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-primary" />
                شعار الشركة
              </CardTitle>
              <CardDescription>صورة الشعار التي تظهر في الفواتير والتقارير</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="شعار الشركة" className="w-full h-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <ImagePlus className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              <Button variant="outline" onClick={() => logoInputRef.current?.click()} className="w-full gap-2">
                <ImagePlus className="h-4 w-4" />
                رفع شعار جديد
              </Button>
              {form.logoUrl?.startsWith("data:") && (
                <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => setForm({ ...form, logoUrl: "/logo.png" })}>
                  <X className="h-3 w-3 ml-1" />
                  إزالة الصورة المرفوعة
                </Button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </CardContent>
          </Card>

          {/* Main Info Card */}
          <Card className="section-card lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                البيانات الأساسية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    اسم الشركة
                  </Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: الامبراطور للأثاث" />
                </div>
                <div className="form-group">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    العنوان
                  </Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="العنوان الرئيسي للشركة" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info Card */}
          <Card className="section-card lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                بيانات التواصل
              </CardTitle>
              <CardDescription>يمكنك إضافة أكثر من رقم هاتف وبريد إلكتروني</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Phones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    أرقام الهاتف
                  </Label>
                  <Button variant="ghost" size="sm" onClick={addPhone} className="gap-1 text-primary hover:text-primary h-8 px-2">
                    <Plus className="h-3.5 w-3.5" />
                    إضافة رقم
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.phones.map((phone: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {i + 1}
                      </div>
                      <Input value={phone} onChange={(e) => updatePhone(i, e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" className="flex-1" />
                      {form.phones.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removePhone(i)} className="h-8 w-8 text-destructive hover:text-destructive shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Emails */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    البريد الإلكتروني
                  </Label>
                  <Button variant="ghost" size="sm" onClick={addEmail} className="gap-1 text-primary hover:text-primary h-8 px-2">
                    <Plus className="h-3.5 w-3.5" />
                    إضافة بريد
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.emails.map((email: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                        {i + 1}
                      </div>
                      <Input value={email} onChange={(e) => updateEmail(i, e.target.value)} dir="ltr" placeholder="info@company.com" className="flex-1" />
                      {form.emails.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeEmail(i)} className="h-8 w-8 text-destructive hover:text-destructive shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Backup Section */}
        {permissions.backup && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-primary" />
                النسخ الاحتياطي و OneDrive
              </h2>
              <BackupManager />
            </div>
          </>
        )}

        {/* Backup Section */}
        {permissions.backup && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-primary" />
                النسخ الاحتياطي والتخزين السحابي
              </h2>
              <BackupManager />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
