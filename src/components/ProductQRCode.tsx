import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, QrCode } from "lucide-react";
import type { Product } from "@/data/types";
import QRCode from "qrcode";

interface ProductQRCodeProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName?: string;
}

export function ProductQRCode({ product, open, onOpenChange, companyName = "" }: ProductQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (product && open) {
      const data = JSON.stringify({
        id: product.id,
        name: product.name,
        price: product.defaultPrice,
        category: product.category,
      });
      QRCode.toDataURL(data, { width: 200, margin: 2, color: { dark: "#1a1a1a", light: "#ffffff" } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    }
  }, [product, open]);

  if (!product) return null;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><title>QR - ${product.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo',sans-serif;display:flex;justify-content:center;padding:20px}
      .card{border:2px solid #333;border-radius:12px;padding:24px;text-align:center;max-width:300px}
      .name{font-size:18px;font-weight:700;margin:12px 0 4px}.price{font-size:22px;font-weight:800;color:#0d5c63}
      .id{font-size:11px;color:#888;margin-top:8px}.company{font-size:12px;color:#666;margin-bottom:8px}
      @media print{body{padding:0}.card{border:1px solid #999}}</style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_${product.id}_${product.name}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            رمز QR للمنتج
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={printRef}>
            <div className="card" style={{ border: "2px solid hsl(var(--border))", borderRadius: 12, padding: 24, textAlign: "center" }}>
              {companyName && <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{companyName}</p>}
              {qrDataUrl && <img src={qrDataUrl} alt="QR Code" style={{ width: 180, height: 180, margin: "0 auto" }} />}
              <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{product.name}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "hsl(var(--primary))" }}>{product.defaultPrice.toLocaleString()} ج.م</p>
              <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 8 }}>{product.id} • {product.category}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <Printer className="h-4 w-4 ml-1" />طباعة
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="h-4 w-4 ml-1" />تحميل
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
