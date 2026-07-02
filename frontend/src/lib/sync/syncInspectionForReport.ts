import { api } from "@/lib/api";
import { db } from "@/lib/db";
import { getLocalInspection } from "@/lib/db/repositories/inspectionRepo";
import { getLocalPhotos } from "@/lib/db/repositories/photoRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";

/** Reabre mutações de foto que falharam para nova tentativa. */
async function retryFailedPhotoMutations(clientId: string): Promise<void> {
  const failed = await db.sync_mutations.where("status").equals("failed").toArray();
  for (const mut of failed) {
    if (mut.type !== "photo.upload") continue;
    if (mut.payload.inspection_client_id !== clientId) continue;
    await db.sync_mutations.update(mut.mutation_id, { status: "pending", retries: 0, error: undefined });
  }
}

/**
 * Garante que fotos e mutações pendentes cheguem ao servidor antes de validar/gerar PDF.
 * Usa upload direto na API quando o sync em fila falhou ou ficou pendente.
 */
export async function syncInspectionForReport(
  clientId: string,
  serverId: number
): Promise<{ ok: boolean; error?: string }> {
  await retryFailedPhotoMutations(clientId);

  for (let round = 0; round < 3; round++) {
    const result = await syncEngine.syncNow();
    if (result.error === "not_authenticated") {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }
    const pending = await db.sync_mutations.where("status").equals("pending").count();
    if (pending === 0) break;
  }

  const photos = await getLocalPhotos(clientId);
  const unsynced = photos.filter((p) => p.sync_status !== "synced");

  for (const photo of unsynced) {
    try {
      const file = new File([photo.blob], photo.original_filename || "photo.jpg", {
        type: photo.blob.type || "image/jpeg",
      });
      if (photo.photo_type === "address") {
        await api.uploadAddressPhoto(serverId, file);
      } else if (photo.checklist_item_id) {
        const uploaded = await api.uploadPhoto(serverId, file, {
          checklistItemId: photo.checklist_item_id,
        });
        await db.photos.update(photo.client_photo_id, {
          sync_status: "synced",
          server_photo_id: uploaded.id,
        });
        continue;
      }
      await db.photos.update(photo.client_photo_id, { sync_status: "synced" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao enviar foto";
      const item = photo.checklist_item_id ? ` (item checklist ${photo.checklist_item_id})` : "";
      return {
        ok: false,
        error: `Não foi possível enviar uma foto pendente${item}. Abra o checklist, confira o item NC e tire a foto novamente se necessário. Detalhe: ${msg}`,
      };
    }
  }

  await syncEngine.syncNow();
  const local = await getLocalInspection(clientId);
  if (local && !local.server_id) {
    return { ok: false, error: "Inspeção ainda não sincronizada com o servidor." };
  }

  return { ok: true };
}
