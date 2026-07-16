import JSZip from "jszip";
import { db } from "@/lib/db";
import { getLocalAnswers } from "@/lib/db/repositories/answerRepo";
import { getLocalPhotos } from "@/lib/db/repositories/photoRepo";
import { getLocalInspection } from "@/lib/db/repositories/inspectionRepo";
import { blobToBase64 } from "@/lib/native/filesystem";

export async function exportInspectionBackup(clientId: string): Promise<Blob> {
  const inspection = await getLocalInspection(clientId);
  if (!inspection) throw new Error("Inspeção não encontrada");

  const answers = await getLocalAnswers(clientId);
  const photos = await getLocalPhotos(clientId);
  const zip = new JSZip();

  zip.file(
    "inspection.json",
    JSON.stringify({ inspection, answers }, null, 2)
  );

  const photosFolder = zip.folder("photos");
  for (const photo of photos) {
    const b64 = await blobToBase64(photo.blob);
    const ext = photo.original_filename.split(".").pop() || "jpg";
    photosFolder?.file(`${photo.client_photo_id}.${ext}`, b64, { base64: true });
  }

  if (inspection.pdf_path) {
    /* PDF no filesystem nativo — metadados no JSON */
    zip.file("pdf_path.txt", inspection.pdf_path);
  }

  return zip.generateAsync({ type: "blob" });
}

export async function exportAllBackups(): Promise<Blob> {
  const inspections = await db.inspections.toArray();
  const zip = new JSZip();
  for (const insp of inspections) {
    const part = await exportInspectionBackup(insp.client_id);
    zip.file(`${insp.client_id}.zip`, part);
  }
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        count: inspections.length,
        client_ids: inspections.map((i) => i.client_id),
      },
      null,
      2
    )
  );
  return zip.generateAsync({ type: "blob" });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
