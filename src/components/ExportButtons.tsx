import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCompanySettings } from "@/data/store";
import { ShareButton } from "@/components/ShareButton";

interface ExportButtonsProps {
  data: Record<string, unknown>[];
  headers: { key: string; label: string }[];
  fileName: string;
  title: string;
  /** Optional: element ref to capture as image for sharing */
  captureRef?: React.RefObject<HTMLElement>;
}

export function ExportButtons({ data, headers, fileName, title, captureRef }: ExportButtonsProps) {
  const { toast } = useToast();

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = data.map((row) =>
      Object.fromEntries(headers.map((h) => [h.label, row[h.key] ?? ""]))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    toast({ title: "تم التصدير", description: `تم تصدير ${fileName}.xlsx بنجاح` });
  };

  const exportToPDF = () => {
    const settings = getCompanySettings();
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "خطأ", description: "لم يتم فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.", variant: "destructive" });
      return;
    }

    const tableHeaders = headers.map((h) => `<th style="padding:10px 14px;text-align:right;background:#0d5c63;color:#fff;font-weight:600;font-size:13px;border:1px solid #0a4a50;">${h.label}</th>`).join("");
    const tableRows = data.map((row, i) => {
      const cells = headers.map((h) => `<td style="padding:10px 14px;border:1px solid #ddd;font-size:13px;">${row[h.key] ?? ""}</td>`).join("");
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'}">${cells}</tr>`;
    }).join("");

    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1a1a1a; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0d5c63; padding-bottom: 16px; }
    .header img { height: 50px; margin-bottom: 8px; }
    .header h1 { font-size: 22px; color: #0d5c63; margin: 4px 0; }
    .header h2 { font-size: 16px; color: #333; font-weight: 600; }
    .header .info { font-size: 11px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; color: #999; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="logo" onerror="this.style.display='none'" />` : ""}
    <h1>${settings.name}</h1>
    ${settings.address ? `<div class="info">${settings.address} ${settings.phone ? `| ${settings.phone}` : ""}</div>` : ""}
    <h2>${title}</h2>
    <div class="info">تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")} — ${new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</div>
  </div>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">
    تم إنشاء هذا التقرير بواسطة ${settings.name} — ${new Date().toLocaleDateString("ar-EG")}
  </div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
    toast({ title: "تم فتح التقرير", description: "يمكنك طباعة التقرير أو حفظه كـ PDF من نافذة الطباعة" });
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportToExcel}>
        <FileSpreadsheet className="h-4 w-4 ml-1" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportToPDF}>
        <FileText className="h-4 w-4 ml-1" />
        PDF
      </Button>
      <ShareButton
        title={title}
        data={data}
        headers={headers}
        captureRef={captureRef}
      />
    </div>
  );
}
