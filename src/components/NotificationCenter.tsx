import { useMemo } from "react";
import { Bell, AlertTriangle, Clock, Tag, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInvoices, useReceipts, useProducts, useOffers } from "@/data/hooks";

interface Notification {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

export function NotificationCenter() {
  const { invoices } = useInvoices();
  const { receipts } = useReceipts();
  const { products } = useProducts();
  const { offers } = useOffers();

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    const now = new Date();

    // Out of stock
    products.filter(p => p.stock <= 0).forEach(p => {
      notifs.push({ id: `out-${p.id}`, title: "نفد من المخزون", description: p.name, icon: Package, color: "text-destructive" });
    });

    // Low stock
    products.filter(p => p.stock > 0 && p.stock <= p.minStock).forEach(p => {
      notifs.push({ id: `low-${p.id}`, title: "مخزون منخفض", description: `${p.name} — متبقي ${p.stock}`, icon: AlertTriangle, color: "text-warning" });
    });

    // Overdue payments (30+ days)
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
          notifs.push({ id: `overdue-${inv.id}`, title: "قسط متأخر", description: `${inv.customer} — ${remaining.toLocaleString()} ج.م (${days} يوم)`, icon: Clock, color: "text-destructive" });
        }
      }
    });

    // Upcoming delivery dates
    invoices.forEach(inv => {
      if (inv.deliveryDate && inv.status !== "تم التسليم" && inv.status !== "مغلقة") {
        const diff = Math.floor((new Date(inv.deliveryDate).getTime() - now.getTime()) / 86400000);
        if (diff >= 0 && diff <= 3) {
          notifs.push({ id: `del-${inv.id}`, title: "موعد تسليم قريب", description: `${inv.id} — ${inv.customer} (${diff === 0 ? "اليوم" : `خلال ${diff} يوم`})`, icon: Clock, color: "text-info" });
        }
      }
    });

    // Expiring offers
    offers.filter(o => o.active && o.endDate).forEach(o => {
      const diff = Math.floor((new Date(o.endDate).getTime() - now.getTime()) / 86400000);
      if (diff >= 0 && diff <= 3) {
        notifs.push({ id: `offer-${o.id}`, title: "عرض ينتهي قريباً", description: `${o.name} (${diff === 0 ? "اليوم" : `خلال ${diff} يوم`})`, icon: Tag, color: "text-warning" });
      }
    });

    return notifs;
  }, [invoices, receipts, products, offers]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b font-semibold text-sm">الإشعارات ({notifications.length})</div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات 🎉</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 p-3 border-b last:border-0 hover:bg-muted/50">
                <n.icon className={`h-4 w-4 mt-0.5 shrink-0 ${n.color}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
