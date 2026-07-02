import { db, SyncMutation } from "@/lib/db";

export async function getPendingMutations(limit = 50): Promise<SyncMutation[]> {
  return db.sync_mutations
    .where("status")
    .equals("pending")
    .sortBy("created_at")
    .then((rows) => rows.slice(0, limit));
}

export async function markMutationApplied(mutationId: string): Promise<void> {
  await db.sync_mutations.update(mutationId, {
    status: "applied",
    applied_at: new Date().toISOString(),
  });
}

export async function markMutationFailed(mutationId: string, error: string): Promise<void> {
  const row = await db.sync_mutations.get(mutationId);
  if (!row) return;
  await db.sync_mutations.update(mutationId, {
    status: row.retries >= 2 ? "failed" : "pending",
    retries: row.retries + 1,
    error,
  });
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const row = await db.sync_meta.get(key);
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  await db.sync_meta.put({ key, value });
}
