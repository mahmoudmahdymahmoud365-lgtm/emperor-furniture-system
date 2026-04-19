import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated, getUserPermissions } from "@/data/store";
import { canDo, type RolePermissions, type ModuleAccess } from "@/data/types";
import { Loader2, ShieldX } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { Button } from "@/components/ui/button";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Customers = lazy(() => import("./pages/Customers"));
const Products = lazy(() => import("./pages/Products"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Installments = lazy(() => import("./pages/Installments"));
const CustomerReport = lazy(() => import("./pages/CustomerReport"));
const Employees = lazy(() => import("./pages/Employees"));
const Branches = lazy(() => import("./pages/Branches"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Offers = lazy(() => import("./pages/Offers"));
const ManufacturingReport = lazy(() => import("./pages/ManufacturingReport"));
const Expenses = lazy(() => import("./pages/Expenses"));
const SecurityLog = lazy(() => import("./pages/SecurityLog"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="text-center space-y-4">
        <ShieldX className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">غير مصرح</h1>
        <p className="text-muted-foreground">ليس لديك صلاحية للوصول لهذه الصفحة</p>
        <Button onClick={() => window.history.back()} variant="outline">العودة</Button>
      </div>
    </div>
  );
}

type PermKey = keyof RolePermissions;

function ProtectedRoute({ children, permissionKey, operation }: { 
  children: React.ReactNode; 
  permissionKey?: PermKey;
  operation?: "view" | "create" | "edit" | "delete";
}) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  
  if (permissionKey) {
    const perms = getUserPermissions();
    const access = perms[permissionKey] as ModuleAccess | boolean | undefined;
    
    if (access === false || access === undefined) return <AccessDenied />;
    if (operation && typeof access === "object") {
      if (!canDo(access, operation)) return <AccessDenied />;
    }
  }
  
  return <>{children}</>;
}

function InactivityWatcher() {
  useInactivityLogout();
  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <InactivityWatcher />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute permissionKey="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute permissionKey="customers" operation="view"><Customers /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute permissionKey="products" operation="view"><Products /></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute permissionKey="invoices" operation="view"><Invoices /></ProtectedRoute>} />
              <Route path="/installments" element={<ProtectedRoute permissionKey="installments" operation="view"><Installments /></ProtectedRoute>} />
              <Route path="/customer-report/:customerId" element={<ProtectedRoute permissionKey="customers" operation="view"><CustomerReport /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute permissionKey="employees" operation="view"><Employees /></ProtectedRoute>} />
              <Route path="/branches" element={<ProtectedRoute permissionKey="branches" operation="view"><Branches /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute permissionKey="reports"><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute permissionKey="settings"><Settings /></ProtectedRoute>} />
              <Route path="/audit-log" element={<ProtectedRoute permissionKey="auditLog"><AuditLog /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute permissionKey="users"><UserManagement /></ProtectedRoute>} />
              <Route path="/offers" element={<ProtectedRoute permissionKey="offers" operation="view"><Offers /></ProtectedRoute>} />
              <Route path="/manufacturing" element={<ProtectedRoute permissionKey="invoices" operation="view"><ManufacturingReport /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute permissionKey="reports"><Expenses /></ProtectedRoute>} />
              <Route path="/advanced-reports" element={<Navigate to="/reports" replace />} />
              <Route path="/security-log" element={<ProtectedRoute permissionKey="auditLog"><SecurityLog /></ProtectedRoute>} />
              <Route path="/inventory" element={<Navigate to="/products" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
