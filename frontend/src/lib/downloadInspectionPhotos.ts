import JSZip from "jszip";
import { api, ChecklistSection, getToken } from "@/lib/api";
import { getLocalPhotos, getAddressPhoto } from "@/lib/db/repositories/photoRepo";
import { getCachedReference } from "@/lib/db/repositories/inspectionRepo";

export type DownloadPhotosInput = {
  clientId: string;
  serverId?: number;
  unitName?: string;
};

function safeSegment(value: string): string {
  return value.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 80) || "arquivo";
}

function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf(".");
  const base = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : "";
  let n = 2;
  while (used.has(`${base}_${n}${ext}`)) n += 1;
  const next = `${base}_${n}${ext}`;
  used.add(next);
  return next;
}

async function fetchAuthBlob(url: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Falha ao baixar foto (${res.status})`);
  }
  return res.blob();
}

async function buildItemCodeMap(): Promise<Map<number, string>> {
  const checklist = (await getCachedReference<ChecklistSection[]>("checklist")) ?? [];
  const map = new Map<number, string>();
  for (const section of checklist) {
    for (const item of section.items) {
      map.set(item.id, item.item_code);
    }
  }
  return map;
}

async function collectFromServer(
  serverId: number,
  itemCodes: Map<number, string>,
  used: Set<string>
): Promise<Array<{ path: string; blob: Blob }>> {
  const items: Array<{ path: string; blob: Blob }> = [];
  const inspection = await api.getInspection(serverId);

  if (inspection.has_address_photo) {
    const blob = await fetchAuthBlob(api.addressPhotoUrl(serverId));
    items.push({
      path: uniquePath("01_endereco/endereco.jpg", used),
      blob,
    });
  }

  const answers = await api.getAnswers(serverId);
  for (const answer of answers) {
    const code = safeSegment(itemCodes.get(answer.checklist_item_id) ?? `item_${answer.checklist_item_id}`);
    for (let i = 0; i < answer.photos.length; i++) {
      const photo = answer.photos[i];
      const blob = await fetchAuthBlob(api.photoUrl(serverId, photo.id));
      const filename = safeSegment(photo.original_filename || `foto_${i + 1}.jpg`);
      items.push({
        path: uniquePath(`02_nc/${code}/${filename}`, used),
        blob,
      });
    }
  }

  return items;
}

async function collectFromLocal(
  clientId: string,
  itemCodes: Map<number, string>,
  used: Set<string>
): Promise<Array<{ path: string; blob: Blob }>> {
  const items: Array<{ path: string; blob: Blob }> = [];

  const address = await getAddressPhoto(clientId);
  if (address) {
    const filename = safeSegment(address.original_filename || "endereco.jpg");
    items.push({
      path: uniquePath(`01_endereco/${filename}`, used),
      blob: address.blob,
    });
  }

  const localPhotos = (await getLocalPhotos(clientId)).filter((p) => p.photo_type === "nc");
  const byItem = new Map<number, typeof localPhotos>();
  for (const photo of localPhotos) {
    const list = byItem.get(photo.checklist_item_id) ?? [];
    list.push(photo);
    byItem.set(photo.checklist_item_id, list);
  }

  for (const [itemId, photos] of byItem) {
    const code = safeSegment(itemCodes.get(itemId) ?? `item_${itemId}`);
    photos.forEach((photo, index) => {
      const filename = safeSegment(photo.original_filename || `foto_${index + 1}.jpg`);
      items.push({
        path: uniquePath(`02_nc/${code}/${filename}`, used),
        blob: photo.blob,
      });
    });
  }

  return items;
}

async function collectPhotos(input: DownloadPhotosInput): Promise<Array<{ path: string; blob: Blob }>> {
  const itemCodes = await buildItemCodeMap();
  const used = new Set<string>();

  if (input.serverId && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const serverItems = await collectFromServer(input.serverId, itemCodes, used);
      if (serverItems.length > 0) return serverItems;
    } catch {
      /* fallback local */
    }
  }

  return collectFromLocal(input.clientId, itemCodes, used);
}

export async function downloadInspectionPhotosZip(input: DownloadPhotosInput): Promise<number> {
  const photos = await collectPhotos(input);
  if (photos.length === 0) {
    throw new Error("Nenhuma foto encontrada nesta inspeção.");
  }

  const zip = new JSZip();
  const folder = zip.folder("fotos");
  if (!folder) throw new Error("Não foi possível criar o arquivo ZIP.");

  for (const { path, blob } of photos) {
    folder.file(path, blob);
  }

  const archive = await zip.generateAsync({ type: "blob" });
  const label = safeSegment(input.unitName || "inspecao");
  const id = input.serverId ?? input.clientId.slice(0, 8);
  const filename = `fotos_${label}_${id}.zip`;

  const url = URL.createObjectURL(archive);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  return photos.length;
}
