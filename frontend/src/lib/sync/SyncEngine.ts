import { db } from "@/lib/db";
import {
  getLocalInspection,
  saveLocalInspection,
  upsertLocalFromServer,
} from "@/lib/db/repositories/inspectionRepo";
import { upsertAnswersFromServer } from "@/lib/db/repositories/answerRepo";
import {
  getPendingMutations,
  markMutationApplied,
  markMutationFailed,
  getSyncMeta,
  setSyncMeta,
} from "@/lib/db/repositories/syncQueueRepo";
import { api, getToken, setToken } from "@/lib/api";

type SyncListener = () => void;

class SyncEngine {
  private syncing = false;
  private listeners = new Set<SyncListener>();

  subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  get isSyncing() {
    return this.syncing;
  }

  async syncNow(): Promise<{ ok: boolean; error?: string }> {
    if (this.syncing || typeof navigator !== "undefined" && !navigator.onLine) {
      return { ok: false, error: "offline" };
    }
    if (!getToken()) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        return { ok: false, error: "not_authenticated" };
      }
    }

    this.syncing = true;
    this.notify();

    try {
      await this.pushPending();
      await this.pullDelta();
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.message === "Não autorizado") {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          try {
            await this.pushPending();
            await this.pullDelta();
            return { ok: true };
          } catch (retryErr) {
            return { ok: false, error: retryErr instanceof Error ? retryErr.message : "sync_failed" };
          }
        }
      }
      return { ok: false, error: e instanceof Error ? e.message : "sync_failed" };
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  private async pushPending(): Promise<void> {
    const pending = await getPendingMutations(30);
    if (pending.length === 0) return;

    const mutations = [];
    for (const mut of pending) {
      const payload = { ...mut.payload };
      if (mut.type === "photo.upload") {
        const photo = await db.photos.get(String(mut.payload.client_photo_id));
        if (photo) {
          const buffer = await photo.blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          payload.file_base64 = btoa(binary);
        }
      }
      mutations.push({
        mutation_id: mut.mutation_id,
        type: mut.type,
        payload,
      });
    }

    const result = await api.syncPush(mutations);

    for (const item of result.applied) {
      if (item.mutation_id) {
        await markMutationApplied(item.mutation_id);
      }
      if (item.client_id && item.server_id) {
        const local = await getLocalInspection(String(item.client_id));
        if (local) {
          await saveLocalInspection({
            ...local,
            server_id: item.server_id,
            sync_status: "synced",
          });
        }
      }
      if (item.type === "photo.upload" && item.client_photo_id) {
        await db.photos.update(String(item.client_photo_id), {
          sync_status: "synced",
          server_photo_id: item.server_photo_id,
        });
      }
    }

    for (const err of result.errors) {
      if (err.mutation_id) {
        await markMutationFailed(err.mutation_id, err.error);
      }
    }

    for (const [clientId, serverId] of Object.entries(result.id_map)) {
      const local = await getLocalInspection(clientId);
      if (local) {
        await saveLocalInspection({
          ...local,
          server_id: serverId,
          sync_status: "synced",
        });
      }
    }

    if (result.conflicts.length > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sync-conflict", { detail: result.conflicts }));
    }
  }

  private async pullDelta(): Promise<void> {
    const since = await getSyncMeta("last_pull_at");
    const result = await api.syncPull(since ?? undefined);

    for (const row of result.inspections) {
      const insp = row.inspection;
      await upsertLocalFromServer(insp);
      const local = await getLocalInspection(String(row.client_id));
      if (local) {
        await upsertAnswersFromServer(
          local.client_id,
          row.answers.map((a) => ({
            id: a.id,
            checklist_item_id: a.checklist_item_id,
            status: a.status,
            description: a.description,
            recommendation: a.recommendation,
            normative: a.normative,
          }))
        );
      }
    }

    await setSyncMeta("last_pull_at", result.pulled_at);
  }

  startAutoSync(intervalMs = 30000) {
    if (typeof window === "undefined") return () => {};
    const onOnline = () => void this.syncNow();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void this.syncNow(), intervalMs);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }
}

export const syncEngine = new SyncEngine();

export async function saveAuthSession(
  accessToken: string,
  refreshToken: string | null,
  user: Record<string, unknown>
): Promise<void> {
  await db.auth_session.put({
    id: 1,
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    user,
    saved_at: new Date().toISOString(),
  });
}

export async function tryRefreshToken(): Promise<boolean> {
  const session = await db.auth_session.get(1);
  if (!session?.refresh_token) return false;
  try {
    const data = await api.refreshToken(session.refresh_token);
    setToken(data.access_token);
    await saveAuthSession(data.access_token, data.refresh_token ?? session.refresh_token, session.user);
    return true;
  } catch {
    return false;
  }
}
