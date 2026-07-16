import { db, LocalPhoto, newClientId } from "@/lib/db";
import { enqueueMutation } from "@/lib/db/repositories/inspectionRepo";
import { blobToBase64, savePhotoFile } from "@/lib/native/filesystem";
import { isFieldApp } from "@/lib/runtime";

export async function saveLocalPhoto(input: {
  inspectionClientId: string;
  checklistItemId: number;
  blob: Blob;
  originalFilename: string;
  photoType: "nc" | "address";
  answerClientId?: string;
}): Promise<LocalPhoto> {
  const client_photo_id = newClientId();
  const photo: LocalPhoto = {
    client_photo_id,
    inspection_client_id: input.inspectionClientId,
    checklist_item_id: input.checklistItemId,
    answer_client_id: input.answerClientId,
    blob: input.blob,
    original_filename: input.originalFilename,
    photo_type: input.photoType,
    sync_status: isFieldApp() ? "local" : "pending",
    created_at: new Date().toISOString(),
  };
  if (isFieldApp()) {
    const b64 = await blobToBase64(input.blob);
    const ext = input.originalFilename.split(".").pop() || "jpg";
    photo.file_path = await savePhotoFile(
      input.inspectionClientId,
      `${client_photo_id}.${ext}`,
      b64
    );
  }
  await db.photos.put(photo);
  await enqueueMutation("photo.upload", {
    client_photo_id,
    inspection_client_id: input.inspectionClientId,
    checklist_item_id: input.checklistItemId,
    photo_type: input.photoType,
    original_filename: input.originalFilename,
  });
  if (input.photoType === "address") {
    const { saveLocalInspection } = await import("@/lib/db/repositories/inspectionRepo");
    await saveLocalInspection({
      client_id: input.inspectionClientId,
      has_address_photo: true,
      sync_status: "pending",
    });
  }
  return photo;
}

export async function getLocalPhotos(
  inspectionClientId: string,
  checklistItemId?: number
): Promise<LocalPhoto[]> {
  let q = db.photos.where("inspection_client_id").equals(inspectionClientId);
  const all = await q.toArray();
  if (checklistItemId != null) {
    return all.filter((p) => p.checklist_item_id === checklistItemId && p.photo_type === "nc");
  }
  return all;
}

export async function getAddressPhoto(
  inspectionClientId: string
): Promise<LocalPhoto | undefined> {
  return db.photos
    .where("inspection_client_id")
    .equals(inspectionClientId)
    .filter((p) => p.photo_type === "address")
    .first();
}

export async function deleteLocalPhoto(clientPhotoId: string): Promise<void> {
  const photo = await db.photos.get(clientPhotoId);
  if (!photo) return;
  await db.photos.delete(clientPhotoId);
  await enqueueMutation("photo.delete", {
    client_photo_id: clientPhotoId,
    server_photo_id: photo.server_photo_id,
    inspection_client_id: photo.inspection_client_id,
    photo_type: photo.photo_type,
  });
}
