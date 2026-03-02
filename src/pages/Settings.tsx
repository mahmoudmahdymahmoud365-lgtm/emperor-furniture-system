import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/data/hooks";

export default function Settings() {
  const { settings, updateSettings } = useCompanySettings();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...settings });

  const handleSave = () => {
    updateSettings(form);
    toast({ title: "تم الحفظ", description: "تم تحديث إعدادات الشركة بنجاح" });
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
      </div>
    </AppLayout>
  );
}
