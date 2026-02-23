import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  CreditCard,
  Building2,
  UserCog,
  BarChart3,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from "lucide-react";

const menuItems = [
  { title: "لوحة التحكم", icon: LayoutDashboard, path: "/" },
  { title: "العملاء", icon: Users, path: "/customers" },
  { title: "المنتجات", icon: Package, path: "/products" },
  { title: "الفواتير", icon: FileText, path: "/invoices" },
  { title: "الأقساط", icon: CreditCard, path: "/installments" },
  { title: "الموظفين", icon: UserCog, path: "/employees" },
  { title: "الفروع", icon: Building2, path: "/branches" },
  { title: "التقارير", icon: BarChart3, path: "/reports" },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 right-4 z-50 md:hidden bg-primary text-primary-foreground p-2 rounded-lg shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:sticky top-0 right-0 h-screen z-50 md:z-auto
          bg-sidebar text-sidebar-foreground
          transition-all duration-300 flex flex-col
          ${collapsed ? "w-16" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!collapsed && (
            <h1 className="text-lg font-bold truncate">نظام الأثاث</h1>
          )}
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              setMobileOpen(false);
            }}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <ChevronRight className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-colors duration-150
                      ${isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full">
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
