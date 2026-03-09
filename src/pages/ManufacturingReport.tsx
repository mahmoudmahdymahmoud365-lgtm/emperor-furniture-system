import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Image, Plus, Trash2, Factory } from "lucide-react";
import { useInvoices, useCustomers, useCompanySettings } from "@/data/hooks";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, StoredImage } from "@/data/types";
import { saveImage, getAllImagesMeta, getImageURL, deleteImage } from "@/data/imageStore";

export default function ManufacturingReport() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { settings } = useCompanySettings();
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("تصميم");
  const [uploadRelated, setUploadRelated] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    const meta = await getAllImagesMeta();
    setImages(meta);
    const urls: Record<string, string> = {};
    for (const img of meta) {
      urls[img.id] = getImageURL(img.id);
    }
    setImageUrls(urls);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      await saveImage(file, { name: file.name.split(".")[0], type: uploadType, relatedTo: uploadRelated });
    }
    toast({ title: "تم الرفع", description: `تم حفظ ${files.length} صورة` });
    await loadImages();
    setUploadOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteImage = async (id: string) => {
    await deleteImage(id);
    setSelectedImages(prev => prev.filter(i => i !== id));
    await loadImages();
    toast({ title: "تم الحذف" });
  };

  const toggleImageSelect = (id: string) => {
    setSelectedImages(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getCustomerInfo = (name: string) => customers.find(c => c.fullName === name);

  const handlePrint = () => {
    if (!selectedInvoice) {
      toast({ title: "تنبيه", description: "يرجى اختيار فاتورة أولاً", variant: "destructive" });
      return;
    }
    const customer = getCustomerInfo(selectedInvoice.customer);

    const imageHtml = selectedImages.map(id => {
      const url = imageUrls[id];
      const meta = images.find(i => i.id === id);
      if (!url) return "";
      return `<div style="text-align:center;margin:10px 0;page-break-inside:avoid;">
        <img src="${url}" style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid #ddd;" />
        ${meta ? `<p style="font-size:11px;color:#666;margin-top:4px;">${meta.name} — ${meta.type}</p>` : ""}
      </div>`;
    }).join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
        <head>
          <title>طلب تصنيع — ${selectedInvoice.id}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1a1a1a; }
            .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0d5c63; padding-bottom: 16px; }
            .header img { height: 50px; margin-bottom: 8px; }
            .header h1 { color: #0d5c63; font-size: 20px; }
            .header p { color: #666; font-size: 12px; }
            .section { margin: 20px 0; }
            .section h2 { color: #0d5c63; font-size: 16px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .info-item { font-size: 13px; }
            .info-item span { color: #666; }
            .info-item strong { color: #1a1a1a; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { padding: 10px 14px; border: 1px solid #ddd; text-align: right; font-size: 13px; }
            th { background: #0d5c63; color: #fff; font-weight: 600; }
            tr:nth-child(even) { background: #f8f9fa; }
            .images-section { margin-top: 24px; }
            .footer { margin-top: 30px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #ddd; padding-top: 12px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="logo" />` : ""}
            <h1>${settings.name}</h1>
            ${settings.phone ? `<p>${settings.phone} | ${settings.address || ""}</p>` : ""}
          </div>

          <div class="header" style="border:none;padding:0;">
            <h1 style="font-size:24px;">🏭 طلب تصنيع</h1>
            <p>رقم الفاتورة: ${selectedInvoice.id} — التاريخ: ${selectedInvoice.date}</p>
          </div>

          <div class="section">
            <h2>بيانات العميل</h2>
            <div class="info-grid">
              <div class="info-item"><span>الاسم: </span><strong>${selectedInvoice.customer}</strong></div>
              <div class="info-item"><span>الهاتف: </span><strong>${customer?.phone || "-"}</strong></div>
              <div class="info-item"><span>العنوان: </span><strong>${customer?.address || "-"}</strong></div>
              <div class="info-item"><span>المحافظة: </span><strong>${customer?.governorate || "-"}</strong></div>
            </div>
          </div>

          ${selectedInvoice.deliveryDate ? `<div class="section"><h2>تاريخ التسليم المطلوب</h2><p style="font-size:16px;font-weight:700;color:#0d5c63;">${selectedInvoice.deliveryDate}</p></div>` : ""}

          <div class="section">
            <h2>المنتجات المطلوبة</h2>
            <table>
              <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th></tr></thead>
              <tbody>
                ${selectedInvoice.items.map((item, i) => `
                  <tr><td>${i + 1}</td><td>${item.productName}</td><td>${item.qty}</td></tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          ${imageHtml ? `<div class="section images-section"><h2>صور مرفقة</h2>${imageHtml}</div>` : ""}

          <div class="footer">
            طلب تصنيع صادر بتاريخ ${new Date().toLocaleDateString("ar-EG")} — ${settings.name}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="page-header">تقرير طلب تصنيع</h1>
        </div>

        {/* Invoice Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-5 w-5" />
              اختر الفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedInvoice?.id || ""}
              onChange={(e) => {
                const inv = invoices.find(i => i.id === e.target.value);
                setSelectedInvoice(inv || null);
              }}
            >
              <option value="">اختر فاتورة...</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.id} — {inv.customer} ({inv.date})</option>
              ))}
            </select>

            {selectedInvoice && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                <h3 className="font-semibold">بيانات الطلب (بدون أسعار)</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">العميل: </span>{selectedInvoice.customer}</div>
                  <div><span className="text-muted-foreground">الهاتف: </span>{getCustomerInfo(selectedInvoice.customer)?.phone || "-"}</div>
                  <div><span className="text-muted-foreground">العنوان: </span>{getCustomerInfo(selectedInvoice.customer)?.address || "-"}</div>
                  <div><span className="text-muted-foreground">التسليم: </span>{selectedInvoice.deliveryDate || "-"}</div>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead><tr className="border-b bg-muted/50"><th className="text-right p-2">#</th><th className="text-right p-2">المنتج</th><th className="text-right p-2">الكمية</th></tr></thead>
                  <tbody>
                    {selectedInvoice.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0"><td className="p-2">{i + 1}</td><td className="p-2">{item.productName}</td><td className="p-2">{item.qty}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image Manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-5 w-5" />
                الصور المحفوظة
              </CardTitle>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />رفع صور
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد صور محفوظة بعد — ارفع صوراً لاستخدامها في التقارير</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map(img => (
                  <div
                    key={img.id}
                    className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedImages.includes(img.id) ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleImageSelect(img.id)}
                  >
                    {imageUrls[img.id] ? (
                      <img src={imageUrls[img.id]} alt={img.name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center"><Image className="h-8 w-8 text-muted-foreground" /></div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs truncate">{img.name}</p>
                      <p className="text-white/70 text-[10px]">{img.type}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }}
                      className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {selectedImages.includes(img.id) && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedImages.length > 0 && (
              <p className="text-sm text-primary mt-3 font-medium">تم اختيار {selectedImages.length} صورة للتقرير</p>
            )}
          </CardContent>
        </Card>

        {/* Print Button */}
        <div className="flex justify-center">
          <Button size="lg" onClick={handlePrint} disabled={!selectedInvoice} className="gap-2">
            <Printer className="h-5 w-5" />
            طباعة تقرير التصنيع
          </Button>
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>رفع صور جديدة</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>نوع الصورة</Label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="بطاقة عميل">بطاقة عميل</option>
                  <option value="تصميم">تصميم</option>
                  <option value="صورة منتج">صورة منتج</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>مرتبطة بـ (اسم عميل أو رقم فاتورة)</Label>
                <Input value={uploadRelated} onChange={(e) => setUploadRelated(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>اختر الصور</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
