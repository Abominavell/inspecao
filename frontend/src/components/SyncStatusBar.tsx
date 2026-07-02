"use client";

import { useSyncStatus } from "@/hooks/useSyncStatus";
import { syncEngine } from "@/lib/sync/SyncEngine";

export default function SyncStatusBar() {
  const { mounted, online, pending, syncing } = useSyncStatus();

  if (!mounted) return null;
  if (online && pending === 0 && !syncing) return null;

  return (
    <div
      className={`border-b px-4 py-2 text-center text-sm font-medium ${
        !online
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : syncing
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span>
          {!online
            ? "Sem conexão — alterações salvas localmente"
            : syncing
              ? "Sincronizando..."
              : `${pending} alteração(ões) aguardando envio`}
        </span>
        {online && pending > 0 && !syncing && (
          <button
            type="button"
            onClick={() => syncEngine.syncNow()}
            className="rounded-lg bg-emserh-green px-3 py-1 text-xs font-semibold text-white"
          >
            Sincronizar agora
          </button>
        )}
      </div>
    </div>
  );
}
