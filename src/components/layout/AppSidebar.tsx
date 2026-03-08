import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Package, FileText, CreditCard, Building2,
  UserCog, BarChart3, ChevronRight, Menu, X, LogOut, Settings,
  ScrollText, Shield, Tag, Factory, Warehouse,
} from "lucide-react";
import { logout, getUserPermissions } from "@/data/store";
import { useCompanySettings } from "@/data/hooks";

const allMenuItems = [
  { title: "لوحة التحكم", icon: LayoutDashboard, path: "/", perm: "dashboard" },
  { title: "العملاء", icon: Users, path: "/customers", perm: "customers" },
  { title: "المنتجات والمخزون", icon: Package, path: "/products", perm: "products" },
  { title: "المخزون", icon: Warehouse, path: "/inventory", perm: "inventory" },
  { title: "الفواتير", icon: FileText, path: "/invoices", perm: "invoices" },
  { title: "الأقساط", icon: CreditCard, path: "/installments", perm: "installments" },
  { title: "العروض", icon: Tag, path: "/offers", perm: "offers" },
  { title: "الموظفين", icon: UserCog, path: "/employees", perm: "employees" },
  { title: "الفروع", icon: Building2, path: "/branches", perm: "branches" },
  { title: "التقارير", icon: BarChart3, path: "/reports", perm: "reports" },
  { title: "طلب تصنيع", icon: Factory, path: "/manufacturing", perm: "invoices" },
  { title: "سجل العمليات", icon: ScrollText, path: "/audit-log", perm: "auditLog" },
  { title: "المستخدمين", icon: Shield, path: "/users", perm: "users" },
  { title: "الإعدادات", icon: Settings, path: "/settings", perm: "settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { settings } = useCompanySettings();
  const permissions = getUserPermissions();

  const menuItems = allMenuItems.filter((item) => {
    const perm = item.perm as keyof typeof permissions;
    return permissions[perm] !== false;
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="fixed top-4 right-4 z-50 md:hidden bg-primary text-primary-foreground p-2 rounded-lg shadow-lg">
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && <div className="fixed inset-0 bg-foreground/30 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed md:sticky top-0 right-0 h-screen z-50 md:z-auto bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col ${collapsed ? "w-16" : "w-64"} ${mobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <img src={settings.logoUrl || "/logo.png"} alt="لوجو" className="h-8 w-8 rounded-md object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <h1 className="text-lg font-bold truncate">{settings.name}</h1>
            </div>
          )}
          <button onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
            {mobileOpen ? <X className="h-5 w-5" /> : <ChevronRight className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link to={item.path} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full">
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
