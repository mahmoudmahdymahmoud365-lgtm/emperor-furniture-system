import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";
import { login } from "@/data/store";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      navigate("/");
    } else {
      toast({ title: "خطأ", description: "البريد الإلكتروني أو كلمة المرور غير صحيحة", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img src="/logo.png" alt="لوجو" className="h-16 w-16 mx-auto rounded-2xl object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">الامبراطور للأثاث</h1>
          <p className="text-muted-foreground text-sm mt-1">قم بتسجيل الدخول للمتابعة</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="admin@emperor.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" dir="ltr" />
              </div>
            </div>
            <Button type="submit" className="w-full">تسجيل الدخول</Button>
          </form>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p className="font-semibold mb-1">حسابات تجريبية:</p>
            <p>مدير: admin@emperor.com / admin123</p>
            <p>مبيعات: sales@emperor.com / sales123</p>
            <p>محاسب: accountant@emperor.com / acc123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
