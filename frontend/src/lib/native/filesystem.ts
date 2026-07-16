import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { isFieldApp } from "@/lib/runtime";

const PHOTOS_DIR = "inspecao/photos";
const PDF_DIR = "inspecao/pdf";

function useFilesystem(): boolean {
  return isFieldApp() && Capacitor.isNativePlatform();
}

async function ensureDir(path: string): Promise<void> {
  try {
    await Filesystem.mkdir({ path, directory: Directory.Data, recursive: true });
  } catch {
    /* já existe */
  }
}

export async function savePhotoFile(
  inspectionClientId: string,
  filename: string,
  base64Data: string
): Promise<string | undefined> {
  if (!useFilesystem()) return undefined;
  const dir = `${PHOTOS_DIR}/${inspectionClientId}`;
  await ensureDir(PHOTOS_DIR);
  await ensureDir(dir);
  const path = `${dir}/${filename}`;
  await Filesystem.writeFile({ path, data: base64Data, directory: Directory.Data });
  return path;
}

export async function savePdfFile(
  inspectionClientId: string,
  base64Data: string
): Promise<string | undefined> {
  if (!useFilesystem()) return undefined;
  await ensureDir(PDF_DIR);
  const path = `${PDF_DIR}/${inspectionClientId}.pdf`;
  await Filesystem.writeFile({ path, data: base64Data, directory: Directory.Data });
  return path;
}

export async function readFileAsDataUrl(relativePath: string): Promise<string | null> {
  if (!useFilesystem()) return null;
  try {
    const { data } = await Filesystem.readFile({ path: relativePath, directory: Directory.Data });
    const b64 = typeof data === "string" ? data : "";
    return `data:application/octet-stream;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
