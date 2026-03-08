import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, AlertTriangle, Clock, Tag, Package, ChevronDown,
  CreditCard, Calendar, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useInvoices, useReceipts, useProducts, useOffers } from "@/data/hooks";

type NotifPriority = "critical" | "warning" | "info";

interface Notification {
  id: string;
  title: string;
  description: string;
  icon: any;
  priority: NotifPriority;
  category: string;
  link?: string;
}

const priorityStyles: Record<NotifPriority, string> = {
  critical: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

const priorityBg: Record<NotifPriority, string> = {
  critical: "bg-destructive/10",
  warning: "bg-warning/10",
  info: "bg-info/10",
};

export function NotificationCenter() {
  const { invoices } = useInvoices();
  const { receipts } = useReceipts();
  const { products } = useProducts();
  const { offers } = useOffers();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    const now = new Date();

    // Out of stock — critical
    products.filter(p => p.stock <= 0).forEach(p => {
      notifs.push({
        id: `out-${p.id}`, title: "نفد من المخزون", description: p.name,
        icon: Package, priority: "critical", category: "stock", link: "/products",
      });
    });

    // Low stock — warning
    products.filter(p => p.stock > 0 && p.stock <= p.minStock).forEach(p => {
      notifs.push({
        id: `low-${p.id}`, title: "مخزون منخفض",
        description: `${p.name} — متبقي ${p.stock} ${p.unit}`,
        icon: AlertTriangle, priority: "warning", category: "stock", link: "/products",
      });
    });

    // Overdue payments — critical (30+ days), warning (15+ days)
    const customerLastPay = new Map<string, string>();
    receipts.forEach(r => {
      const existing = customerLastPay.get(r.customer);
      if (!existing || r.date > existing) customerLastPay.set(r.customer, r.date);
    });

    invoices.forEach(inv => {
      const total = inv.items.reduce((s, i) => s + i.qty * i.unitPrice - i.lineDiscount, 0) - (inv.appliedDiscount || 0);
      const remaining = total - inv.paidTotal;
      if (remaining > 0) {
        const lastPay = customerLastPay.get(inv.customer);
        const lastDate = lastPay ? new Date(lastPay) : new Date(inv.date);
        const days = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);
        if (days >= 30) {
          notifs.push({
            id: `overdue-${inv.id}`, title: "قسط متأخر جداً",
            description: `${inv.customer} — ${remaining.toLocaleString()} ج.م (${days} يوم)`,
            icon: CreditCard, priority: "critical", category: "payment", link: "/installments",
          });
        } else if (days >= 15) {
          notifs.push({
            id: `due-${inv.id}`, title: "قسط متأخر",
            description: `${inv.customer} — ${remaining.toLocaleString()} ج.م (${days} يوم)`,
            icon: Clock, priority: "warning", category: "payment", link: "/installments",
          });
        }
      }
    });

    // Upcoming delivery dates
    invoices.forEach(inv => {
      if (inv.deliveryDate && inv.status !== "تم التسليم" && inv.status !== "مغلقة") {
        const diff = Math.floor((new Date(inv.deliveryDate).getTime() - now.getTime()) / 86400000);
        if (diff < 0) {
          notifs.push({
            id: `overdue-del-${inv.id}`, title: "تسليم متأخر!",
            description: `${inv.id} — ${inv.customer} (متأخر ${Math.abs(diff)} يوم)`,
            icon: Calendar, priority: "critical", category: "delivery", link: "/invoices",
          });
        } else if (diff <= 3) {
          notifs.push({
            id: `del-${inv.id}`, title: "موعد تسليم قريب",
            description: `${inv.id} — ${inv.customer} (${diff === 0 ? "اليوم" : `خلال ${diff} يوم`})`,
            icon: Calendar, priority: "info", category: "delivery", link: "/invoices",
          });
        }
      }
    });

    // Expiring offers
    offers.filter(o => o.active && o.endDate).forEach(o => {
      const diff = Math.floor((new Date(o.endDate).getTime() - now.getTime()) / 86400000);
      if (diff < 0) {
        notifs.push({
          id: `expired-${o.id}`, title: "عرض منتهي",
          description: `${o.name} (انتهى منذ ${Math.abs(diff)} يوم)`,
          icon: Tag, priority: "warning", category: "offer", link: "/offers",
        });
      } else if (diff <= 3) {
        notifs.push({
          id: `offer-${o.id}`, title: "عرض ينتهي قريباً",
          description: `${o.name} (${diff === 0 ? "اليوم" : `خلال ${diff} يوم`})`,
          icon: Tag, priority: "info", category: "offer", link: "/offers",
        });
      }
    });

    // Sort: critical first, then warning, then info
    const order: Record<NotifPriority, number> = { critical: 0, warning: 1, info: 2 };
    return notifs.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [invoices, receipts, products, offers]);

  const visibleNotifs = notifications.filter(n => !dismissed.has(n.id));
  const filteredNotifs = filter === "all" ? visibleNotifs : visibleNotifs.filter(n => n.category === filter);

  const criticalCount = visibleNotifs.filter(n => n.priority === "critical").length;
  const categories = [...new Set(visibleNotifs.map(n => n.category))];
  const categoryLabels: Record<string, string> = {
    stock: "المخزون", payment: "المدفوعات", delivery: "التسليم", offer: "العروض",
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {visibleNotifs.length > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
              criticalCount > 0 ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-warning text-warning-foreground"
            }`}>
              {visibleNotifs.length > 9 ? "9+" : visibleNotifs.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">الإشعارات ({visibleNotifs.length})</span>
          {visibleNotifs.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDismissed(new Set(notifications.map(n => n.id)))}>
              <CheckCircle2 className="h-3 w-3 ml-1" />تجاهل الكل
            </Button>
          )}
        </div>

        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
            <Badge
              variant={filter === "all" ? "default" : "outline"}
              className="cursor-pointer text-xs shrink-0"
              onClick={() => setFilter("all")}
            >الكل</Badge>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={filter === cat ? "default" : "outline"}
                className="cursor-pointer text-xs shrink-0"
                onClick={() => setFilter(cat)}
              >{categoryLabels[cat] || cat}</Badge>
            ))}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {filteredNotifs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات 🎉</div>
          ) : (
            filteredNotifs.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${priorityBg[n.priority]}`}
                onClick={() => n.link && navigate(n.link)}
              >
                <n.icon className={`h-4 w-4 mt-0.5 shrink-0 ${priorityStyles[n.priority]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.priority === "critical" && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">عاجل</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                </div>
                <button
                  className="shrink-0 p-1 rounded hover:bg-muted"
                  onClick={(e) => { e.stopPropagation(); setDismissed(prev => new Set(prev).add(n.id)); }}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
