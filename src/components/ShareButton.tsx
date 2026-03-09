import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Share2, MessageCircle, Send, Copy, FileImage, CheckCircle, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCompanySettings } from "@/data/store";
import html2canvas from "html2canvas";

interface ShareButtonProps {
  /** Report title */
  title: string;
  /** Data rows for text summary */
  data: Record<string, unknown>[];
  /** Column headers */
  headers: { key: string; label: string }[];
  /** Optional: element ref to capture as image */
  captureRef?: React.RefObject<HTMLElement>;
}

export function ShareButton({ title, data, headers, captureRef }: ShareButtonProps) {
  const { toast } = useToast();
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [sharing, setSharing] = useState(false);

  const settings = getCompanySettings();

  const generateTextSummary = (): string => {
    const companyLine = settings.name ? `📊 ${settings.name}` : "📊 تقرير";
    const titleLine = `📋 ${title}`;
    const dateLine = `📅 ${new Date().toLocaleDateString("ar-EG")} — ${new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
    const separator = "━".repeat(20);

    // Show max 10 rows in summary
    const maxRows = Math.min(data.length, 10);
    const rows = data.slice(0, maxRows).map((row, i) => {
      const mainCols = headers.slice(0, 4);
      const parts = mainCols.map(h => `${h.label}: ${row[h.key] ?? "-"}`);
      return `${i + 1}. ${parts.join(" | ")}`;
    });

    let text = `${companyLine}\n${titleLine}\n${dateLine}\n${separator}\n\n`;
    text += rows.join("\n");
    if (data.length > maxRows) {
      text += `\n\n... و${data.length - maxRows} سجل آخر`;
    }
    text += `\n\n${separator}\nإجمالي السجلات: ${data.length}`;
    
    // Add numeric totals if applicable
    const numericHeaders = headers.filter(h => {
      const sample = data[0]?.[h.key];
      return typeof sample === "number";
    });
    if (numericHeaders.length > 0) {
      const totals = numericHeaders.map(h => {
        const sum = data.reduce((s, r) => s + (Number(r[h.key]) || 0), 0);
        return `${h.label}: ${sum.toLocaleString("ar-EG")}`;
      });
      text += `\n${totals.join(" | ")}`;
    }

    return text;
  };

  const shareViaWhatsApp = (text?: string) => {
    const content = text || generateTextSummary();
    const encoded = encodeURIComponent(content);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    toast({ title: "✅ تم فتح واتساب", description: "يمكنك اختيار جهة الاتصال وإرسال التقرير" });
  };

  const shareViaMessenger = (text?: string) => {
    const content = text || generateTextSummary();
    const encoded = encodeURIComponent(content);
    // Messenger share via fb.com/msg
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(window.location.href)}&redirect_uri=${encodeURIComponent(window.location.href)}&display=popup&quote=${encoded}`, "_blank");
    toast({ title: "✅ تم فتح ماسنجر", description: "يمكنك إرسال التقرير عبر ماسنجر" });
  };

  const shareViaWebAPI = async () => {
    const text = generateTextSummary();
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        toast({ title: "✅ تمت المشاركة" });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "✅ تم النسخ", description: "تم نسخ التقرير للحافظة" });
    }
  };

  const copyToClipboard = async () => {
    const text = generateTextSummary();
    await navigator.clipboard.writeText(text);
    toast({ title: "✅ تم النسخ", description: "تم نسخ ملخص التقرير للحافظة" });
  };

  const shareAsImage = async () => {
    setSharing(true);
    try {
      let element = captureRef?.current;
      
      // If no ref, create a temporary styled report element
      if (!element) {
        const tempDiv = document.createElement("div");
        tempDiv.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;padding:30px;background:#fff;font-family:Cairo,sans-serif;direction:rtl;";
        
        const tableHeaders = headers.map(h => `<th style="padding:10px;text-align:right;background:#0d5c63;color:#fff;font-size:12px;border:1px solid #0a4a50;">${h.label}</th>`).join("");
        const maxImg = Math.min(data.length, 20);
        const tableRows = data.slice(0, maxImg).map((row, i) => {
          const cells = headers.map(h => `<td style="padding:8px 10px;border:1px solid #ddd;font-size:12px;">${row[h.key] ?? ""}</td>`).join("");
          return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8f9fa"}">${cells}</tr>`;
        }).join("");

        tempDiv.innerHTML = `
          <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #0d5c63;padding-bottom:12px;">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="height:40px;margin-bottom:6px;" onerror="this.style.display='none'" />` : ""}
            <h2 style="color:#0d5c63;font-size:18px;margin:4px 0;">${settings.name}</h2>
            <h3 style="font-size:14px;color:#333;">${title}</h3>
            <p style="font-size:10px;color:#999;">${new Date().toLocaleDateString("ar-EG")}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${data.length > maxImg ? `<p style="text-align:center;color:#999;font-size:11px;margin-top:8px;">... و${data.length - maxImg} سجل آخر</p>` : ""}
          <p style="text-align:center;color:#bbb;font-size:10px;margin-top:16px;border-top:1px solid #eee;padding-top:8px;">${settings.name} — ${new Date().toLocaleDateString("ar-EG")}</p>
        `;
        document.body.appendChild(tempDiv);
        element = tempDiv;
        
        // Wait for fonts
        await new Promise(r => setTimeout(r, 300));
      }

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      // Clean up temp element
      if (!captureRef?.current && element.parentNode) {
        element.parentNode.removeChild(element);
      }

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `${title}.png`, { type: "image/png" });
          try {
            await navigator.share({
              title,
              files: [file],
            });
            toast({ title: "✅ تمت المشاركة" });
          } catch {
            // Fallback: download
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
    a.download = `${title}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "✅ تم التحميل", description: "تم تحميل صورة التقرير — يمكنك مشاركتها يدوياً" });
  };

  const openTextEditor = () => {
    setSummaryText(generateTextSummary());
    setShowTextDialog(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1" disabled={sharing}>
            {sharing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            مشاركة
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">مشاركة التقرير</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => shareViaWhatsApp()} className="gap-2 cursor-pointer">
            <MessageCircle className="h-4 w-4 text-green-600" />
            <span>واتساب</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareViaMessenger()} className="gap-2 cursor-pointer">
            <Send className="h-4 w-4 text-blue-600" />
            <span>ماسنجر</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={shareAsImage} className="gap-2 cursor-pointer">
            <FileImage className="h-4 w-4 text-primary" />
            <span>مشاركة كصورة</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openTextEditor} className="gap-2 cursor-pointer">
            <Copy className="h-4 w-4 text-muted-foreground" />
            <span>ملخص نصي</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={shareViaWebAPI} className="gap-2 cursor-pointer">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span>{navigator.share ? "مشاركة عبر النظام" : "نسخ للحافظة"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Text summary dialog */}
      <Dialog open={showTextDialog} onOpenChange={setShowTextDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              ملخص نصي للتقرير
            </DialogTitle>
            <DialogDescription>يمكنك تعديل النص قبل المشاركة</DialogDescription>
          </DialogHeader>
          <Textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            className="min-h-[200px] text-sm font-mono leading-relaxed"
            dir="rtl"
          />
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(summaryText); toast({ title: "✅ تم النسخ" }); }} className="gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              نسخ
            </Button>
            <Button variant="outline" size="sm" onClick={() => shareViaWhatsApp(summaryText)} className="gap-1">
              <MessageCircle className="h-3.5 w-3.5 text-green-600" />
              واتساب
            </Button>
            <Button variant="outline" size="sm" onClick={() => shareViaMessenger(summaryText)} className="gap-1">
              <Send className="h-3.5 w-3.5 text-blue-600" />
              ماسنجر
            </Button>
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1">
              <Link2 className="h-3.5 w-3.5" />
              حافظة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
