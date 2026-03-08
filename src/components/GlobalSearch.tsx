import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Search, Users, Package, FileText, UserCog } from "lucide-react";
import { useCustomers, useProducts, useInvoices, useEmployees } from "@/data/hooks";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const { invoices } = useInvoices();
  const { employees } = useEmployees();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input bg-background text-muted-foreground text-sm hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">بحث شامل...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="بحث في العملاء، المنتجات، الفواتير، الموظفين..." />
        <CommandList>
          <CommandEmpty>لا توجد نتائج</CommandEmpty>
          <CommandGroup heading="العملاء">
            {customers.slice(0, 5).map((c) => (
              <CommandItem key={c.id} onSelect={() => { navigate("/customers"); setOpen(false); }}>
                <Users className="h-4 w-4 ml-2 text-primary" />
                {c.fullName} — {c.phone}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="المنتجات">
            {products.slice(0, 5).map((p) => (
              <CommandItem key={p.id} onSelect={() => { navigate("/products"); setOpen(false); }}>
                <Package className="h-4 w-4 ml-2 text-success" />
                {p.name} — {p.stock} {p.unit}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="الفواتير">
            {invoices.slice(-5).reverse().map((inv) => (
              <CommandItem key={inv.id} onSelect={() => { navigate("/invoices"); setOpen(false); }}>
                <FileText className="h-4 w-4 ml-2 text-info" />
                {inv.id} — {inv.customer}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="الموظفين">
            {employees.filter(e => e.active).slice(0, 5).map((e) => (
              <CommandItem key={e.id} onSelect={() => { navigate("/employees"); setOpen(false); }}>
                <UserCog className="h-4 w-4 ml-2 text-accent" />
                {e.name} — {e.branch}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
