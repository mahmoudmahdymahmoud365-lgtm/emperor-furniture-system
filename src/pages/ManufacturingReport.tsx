import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Printer, Image, Plus, Trash2, Factory, Share2, MessageCircle,
  Send, Copy, FileImage, Link2, StickyNote, CalendarDays, User, Package,
  Save, FolderOpen, Clock,
} from "lucide-react";
import { useInvoices, useCustomers, useCompanySettings, useManufacturingOrders } from "@/data/hooks";
import { MANUFACTURING_STATUS_LABELS, MANUFACTURING_STATUS_COLORS, type ManufacturingStatus } from "@/data/types";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, StoredImage } from "@/data/types";
import { saveImage, getAllImagesMeta, getImageURL, deleteImage } from "@/data/imageStore";
import html2canvas from "html2canvas";
import { escapeHtml } from "@/utils/security";

export default function ManufacturingReport() {
  const { invoices, updateManufacturingStatus } = useInvoices();
  const { customers } = useCustomers();
  const { settings } = useCompanySettings();
  const { orders: savedOrders, addOrder, deleteOrder: deleteSavedOrder } = useManufacturingOrders();
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("تصميم");
  const [uploadRelated, setUploadRelated] = useState("");
  const [notes, setNotes] = useState("");
  const [sharing, setSharing] = useState(false);
  const [showSavedOrders, setShowSavedOrders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

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

  // ─── Sharing helpers ───────────────────────────
  const generateTextSummary = (): string => {
    if (!selectedInvoice) return "";
    const customer = getCustomerInfo(selectedInvoice.customer);
    const sep = "━".repeat(24);
    let text = `🏭 طلب تصنيع\n`;
    text += settings.name ? `📊 ${settings.name}\n` : "";
    text += `📅 ${new Date().toLocaleDateString("ar-EG")}\n${sep}\n\n`;
    text += `📋 رقم الطلب: ${selectedInvoice.id}\n`;
    text += `👤 العميل: ${selectedInvoice.customer}\n`;
    text += `📞 الهاتف: ${customer?.phone || "-"}\n`;
    text += `📍 العنوان: ${customer?.address || "-"} — ${customer?.governorate || ""}\n`;
    if (selectedInvoice.deliveryDate) text += `📆 تاريخ التسليم: ${selectedInvoice.deliveryDate}\n`;
    text += `\n${sep}\n📦 المنتجات المطلوبة:\n`;
    selectedInvoice.items.forEach((item, i) => {
      text += `  ${i + 1}. ${item.productName} — الكمية: ${item.qty}\n`;
    });
    if (notes) text += `\n${sep}\n📝 ملاحظات:\n${notes}\n`;
    text += `\n${sep}\n${settings.name} — ${new Date().toLocaleDateString("ar-EG")}`;
    return text;
  };

  const shareViaWhatsApp = () => {
    const text = generateTextSummary();
    if (!text) { toast({ title: "اختر فاتورة أولاً", variant: "destructive" }); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    toast({ title: "✅ تم فتح واتساب" });
  };

  const shareViaMessenger = () => {
    const text = generateTextSummary();
    if (!text) return;
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(window.location.href)}&redirect_uri=${encodeURIComponent(window.location.href)}&display=popup&quote=${encodeURIComponent(text)}`, "_blank");
    toast({ title: "✅ تم فتح ماسنجر" });
  };

  const copyToClipboard = async () => {
    const text = generateTextSummary();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast({ title: "✅ تم النسخ", description: "تم نسخ طلب التصنيع للحافظة" });
  };

  const shareViaWebAPI = async () => {
    const text = generateTextSummary();
    if (!text) return;
    if (navigator.share) {
      try { await navigator.share({ title: "طلب تصنيع", text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "✅ تم النسخ للحافظة" });
    }
  };

  const shareAsImage = async () => {
    if (!selectedInvoice) { toast({ title: "اختر فاتورة أولاً", variant: "destructive" }); return; }
    setSharing(true);
    try {
      const customer = getCustomerInfo(selectedInvoice.customer);
      const tempDiv = document.createElement("div");
      tempDiv.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;padding:40px;background:#fff;font-family:Cairo,sans-serif;direction:rtl;";

      const rows = selectedInvoice.items.map((item, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#f0fdf4"}">
          <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;">${i + 1}</td>
          <td style="padding:10px 14px;border:1px solid #e5e7eb;">${item.productName}</td>
          <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;">${item.qty}</td>
        </tr>`
      ).join("");

      const imgBlocks = selectedImages.map(id => {
        const url = imageUrls[id];
        const meta = images.find(i => i.id === id);
        if (!url) return "";
        return `<div style="text-align:center;margin:8px;display:inline-block;">
          <img src="${url}" style="max-width:200px;max-height:200px;border-radius:8px;border:1px solid #ddd;" />
          ${meta ? `<p style="font-size:10px;color:#888;margin-top:4px;">${meta.name}</p>` : ""}
        </div>`;
      }).join("");

      tempDiv.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #0d5c63;padding-bottom:16px;">
          ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="height:50px;margin-bottom:8px;" />` : ""}
          <h1 style="color:#0d5c63;font-size:22px;margin:4px 0;">${settings.name}</h1>
          <h2 style="font-size:18px;color:#333;">🏭 طلب تصنيع</h2>
          <p style="color:#888;font-size:12px;">رقم: ${selectedInvoice.id} — ${selectedInvoice.date}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px;">
          <div>👤 العميل: <strong>${selectedInvoice.customer}</strong></div>
          <div>📞 الهاتف: <strong>${customer?.phone || "-"}</strong></div>
          <div>📍 العنوان: <strong>${customer?.address || "-"}</strong></div>
          <div>🏛 المحافظة: <strong>${customer?.governorate || "-"}</strong></div>
          ${selectedInvoice.deliveryDate ? `<div style="grid-column:span 2;">📆 تاريخ التسليم: <strong style="color:#0d5c63;">${selectedInvoice.deliveryDate}</strong></div>` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="padding:10px;background:#0d5c63;color:#fff;border:1px solid #0a4a50;text-align:center;">#</th>
            <th style="padding:10px;background:#0d5c63;color:#fff;border:1px solid #0a4a50;">المنتج</th>
            <th style="padding:10px;background:#0d5c63;color:#fff;border:1px solid #0a4a50;text-align:center;">الكمية</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${notes ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;"><strong>📝 ملاحظات:</strong><br/>${notes}</div>` : ""}
        ${imgBlocks ? `<div style="margin-top:16px;text-align:center;">${imgBlocks}</div>` : ""}
        <p style="text-align:center;color:#bbb;font-size:10px;margin-top:20px;border-top:1px solid #eee;padding-top:10px;">${settings.name} — ${new Date().toLocaleDateString("ar-EG")}</p>
      `;
      document.body.appendChild(tempDiv);
      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      document.body.removeChild(tempDiv);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `طلب-تصنيع-${selectedInvoice.id}.png`, { type: "image/png" });
          try { await navigator.share({ title: "طلب تصنيع", files: [file] }); } catch {
            downloadBlob(blob);
          }
        } else {
          downloadBlob(blob);
        }
      }, "image/png");
    } catch {
      toast({ title: "خطأ", description: "فشل إنشاء صورة التقرير", variant: "destructive" });
    }
    setSharing(false);
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `طلب-تصنيع-${selectedInvoice?.id || "report"}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "✅ تم التحميل", description: "يمكنك مشاركة الصورة يدوياً" });
  };

  const handleSaveOrder = () => {
    if (!selectedInvoice) {
      toast({ title: "اختر فاتورة أولاً", variant: "destructive" });
      return;
    }
    addOrder({
      invoiceId: selectedInvoice.id,
      customer: selectedInvoice.customer,
      items: selectedInvoice.items.map(i => ({ productName: i.productName, qty: i.qty })),
      notes,
      selectedImageIds: selectedImages,
      status: selectedInvoice.manufacturingStatus || "pending",
    });
    toast({ title: "✅ تم الحفظ", description: "تم حفظ طلب التصنيع في قاعدة البيانات" });
  };

  const loadSavedOrder = (order: typeof savedOrders[0]) => {
    const inv = invoices.find(i => i.id === order.invoiceId);
    if (inv) {
      setSelectedInvoice(inv);
      setNotes(order.notes);
      setSelectedImages(order.selectedImageIds);
    } else {
      toast({ title: "الفاتورة غير موجودة", description: `الفاتورة ${order.invoiceId} ربما تم حذفها`, variant: "destructive" });
    }
  };

  // ─── Print ───────────────────────────
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
        ${meta ? `<p style="font-size:11px;color:#666;margin-top:4px;">${escapeHtml(meta.name)} — ${escapeHtml(meta.type)}</p>` : ""}
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
            .notes-box { margin: 16px 0; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; }
            .images-section { margin-top: 24px; }
            .footer { margin-top: 30px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #ddd; padding-top: 12px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" alt="logo" />` : ""}
            <h1>${escapeHtml(settings.name)}</h1>
            ${settings.phone ? `<p>${escapeHtml(settings.phone)} | ${escapeHtml(settings.address || "")}</p>` : ""}
          </div>
          <div class="header" style="border:none;padding:0;">
            <h1 style="font-size:24px;">🏭 طلب تصنيع</h1>
            <p>رقم الفاتورة: ${escapeHtml(selectedInvoice.id)} — التاريخ: ${escapeHtml(selectedInvoice.date)}</p>
          </div>
          <div class="section">
            <h2>بيانات العميل</h2>
            <div class="info-grid">
              <div class="info-item"><span>الاسم: </span><strong>${escapeHtml(selectedInvoice.customer)}</strong></div>
              <div class="info-item"><span>الهاتف: </span><strong>${escapeHtml(customer?.phone || "-")}</strong></div>
              <div class="info-item"><span>العنوان: </span><strong>${escapeHtml(customer?.address || "-")}</strong></div>
              <div class="info-item"><span>المحافظة: </span><strong>${escapeHtml(customer?.governorate || "-")}</strong></div>
            </div>
          </div>
          ${selectedInvoice.deliveryDate ? `<div class="section"><h2>تاريخ التسليم المطلوب</h2><p style="font-size:16px;font-weight:700;color:#0d5c63;">${escapeHtml(selectedInvoice.deliveryDate)}</p></div>` : ""}
          <div class="section">
            <h2>المنتجات المطلوبة</h2>
            <table>
              <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th></tr></thead>
              <tbody>
                ${selectedInvoice.items.map((item, i) => `
                  <tr><td>${i + 1}</td><td>${escapeHtml(item.productName)}</td><td>${item.qty}</td></tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          ${notes ? `<div class="section"><h2>ملاحظات</h2><div class="notes-box">${escapeHtml(notes).replace(/\n/g, "<br/>")}</div></div>` : ""}
          ${imageHtml ? `<div class="section images-section"><h2>صور مرفقة</h2>${imageHtml}</div>` : ""}
          <div class="footer">
            طلب تصنيع صادر بتاريخ ${new Date().toLocaleDateString("ar-EG")} — ${escapeHtml(settings.name)}
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
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Factory className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">طلب تصنيع</h1>
              <p className="text-xs text-muted-foreground">إنشاء ومشاركة طلبات التصنيع للمصانع</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Share dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!selectedInvoice || sharing}>
                  {sharing ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  مشاركة
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">مشاركة طلب التصنيع</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={shareViaWhatsApp} className="gap-2 cursor-pointer">
                  <MessageCircle className="h-4 w-4 text-green-600" />واتساب
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareViaMessenger} className="gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-blue-600" />ماسنجر
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={shareAsImage} className="gap-2 cursor-pointer">
                  <FileImage className="h-4 w-4 text-primary" />مشاركة كصورة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
                  <Copy className="h-4 w-4 text-muted-foreground" />نسخ النص
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={shareViaWebAPI} className="gap-2 cursor-pointer">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  {navigator.share ? "مشاركة عبر النظام" : "نسخ للحافظة"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={handlePrint} disabled={!selectedInvoice} className="gap-1.5">
              <Printer className="h-4 w-4" />طباعة
            </Button>
          </div>
        </div>

        {/* Invoice Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
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
          </CardContent>
        </Card>

        {/* Invoice Preview */}
        {selectedInvoice && (
          <>
          <Card ref={reportRef}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Factory className="h-4 w-4 text-primary" />
                  معاينة طلب التصنيع
                </CardTitle>
                <Badge variant="outline" className="text-xs">{selectedInvoice.id}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="font-medium">{selectedInvoice.customer}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">📞 الهاتف:</span>
                  <span className="font-medium">{getCustomerInfo(selectedInvoice.customer)?.phone || "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">📍 العنوان:</span>
                  <span className="font-medium">{getCustomerInfo(selectedInvoice.customer)?.address || "-"}</span>
                </div>
                {selectedInvoice.deliveryDate && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">التسليم:</span>
                    <span className="font-semibold text-primary">{selectedInvoice.deliveryDate}</span>
                  </div>
                )}
              </div>

              {/* Products */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-right p-2.5 font-medium text-muted-foreground">#</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">المنتج</th>
                      <th className="text-right p-2.5 font-medium text-muted-foreground">الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-2.5">{i + 1}</td>
                        <td className="p-2.5 font-medium">{item.productName}</td>
                        <td className="p-2.5">
                          <Badge variant="secondary" className="text-xs">{item.qty}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <StickyNote className="h-3.5 w-3.5" />
                  ملاحظات للمصنع
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أضف ملاحظات خاصة بالتصنيع (ألوان، مقاسات، خامات...)"
                  className="min-h-[80px] text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Manufacturing Status Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" />
                تتبع حالة التصنيع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {(Object.entries(MANUFACTURING_STATUS_LABELS) as [ManufacturingStatus, string][]).map(([key, label]) => {
                  const isActive = selectedInvoice.manufacturingStatus === key;
                  const colorClass = MANUFACTURING_STATUS_COLORS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        updateManufacturingStatus(selectedInvoice.id, key);
                        toast({ title: "✅ تم التحديث", description: `حالة التصنيع: ${label}` });
                        // Refresh selected invoice
                        const updated = invoices.find(i => i.id === selectedInvoice.id);
                        if (updated) setSelectedInvoice({ ...updated, manufacturingStatus: key });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                        isActive
                          ? `${colorClass} border-current font-bold shadow-sm`
                          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {key === "pending" && "⏳ "}
                      {key === "in_production" && "🏭 "}
                      {key === "quality_check" && "🔍 "}
                      {key === "ready" && "✅ "}
                      {key === "delivered" && "🚚 "}
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-1">
                {(["pending", "in_production", "quality_check", "ready", "delivered"] as ManufacturingStatus[]).map((step, i) => {
                  const steps: ManufacturingStatus[] = ["pending", "in_production", "quality_check", "ready", "delivered"];
                  const currentIdx = steps.indexOf(selectedInvoice.manufacturingStatus || "pending");
                  const isCompleted = i <= currentIdx;
                  return (
                    <div key={step} className="flex-1 flex items-center">
                      <div className={`h-2 w-full rounded-full transition-colors ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                <span>الانتظار</span><span>التصنيع</span><span>الفحص</span><span>جاهز</span><span>تم التسليم</span>
              </div>
              {selectedInvoice.manufacturingUpdatedAt && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  آخر تحديث: {new Date(selectedInvoice.manufacturingUpdatedAt).toLocaleString("ar-EG")}
                </p>
              )}
            </CardContent>
          </Card>
        </>
        )}

        {/* Image Manager */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                الصور المرفقة
                {selectedImages.length > 0 && (
                  <Badge variant="default" className="text-[10px] h-5">{selectedImages.length} مختارة</Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />رفع صور
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Image className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد صور — ارفع صوراً لإرفاقها بالطلب</p>
              </div>
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
          </CardContent>
        </Card>

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
