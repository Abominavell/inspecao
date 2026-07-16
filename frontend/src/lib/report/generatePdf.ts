import { buildReportHtml, type ReportInput } from "@/lib/report/renderHtml";
import { blobToBase64, savePdfFile } from "@/lib/native/filesystem";
import { saveLocalInspection } from "@/lib/db/repositories/inspectionRepo";
import { isNativeApp } from "@/lib/runtime";

export async function generateOfflinePdf(
  clientId: string,
  input: ReportInput
): Promise<{ blob: Blob; path?: string }> {
  const html = await buildReportHtml(input);
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  try {
    const html2pdf = (await import("html2pdf.js")).default;
    const blob = await html2pdf()
      .set({
        margin: 10,
        filename: `relatorio_${clientId}.pdf`,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .outputPdf("blob");

    let path: string | undefined;
    if (isNativeApp()) {
      const b64 = await blobToBase64(blob);
      path = await savePdfFile(clientId, b64);
    }

    await saveLocalInspection({
      client_id: clientId,
      status: "finalizado",
      pdf_path: path,
      pdf_generated_at: new Date().toISOString(),
      sync_status: "local",
    });

    return { blob, path };
  } finally {
    document.body.removeChild(container);
  }
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
