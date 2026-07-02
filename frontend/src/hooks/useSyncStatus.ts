"use client";

import { useEffect, useState } from "react";
import { getPendingMutationCount } from "@/lib/db/repositories/inspectionRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function useSyncStatus() {
  const online = useOnlineStatus();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = async () => {
      setPending(await getPendingMutationCount());
      setSyncing(syncEngine.isSyncing);
    };
    update();
    const unsub = syncEngine.subscribe(update);
    const stopAuto = syncEngine.startAutoSync();
    return () => {
      unsub();
      stopAuto();
    };
  }, []);

  return { mounted, online, pending, syncing };
}
