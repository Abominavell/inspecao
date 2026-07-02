"use client";

import { useEffect, useState } from "react";
import { getPendingMutationCount } from "@/lib/db/repositories/inspectionRepo";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineIndicator() {
  const online = useOnlineStatus();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setMounted(true);
    const tick = () => void getPendingMutationCount().then(setPending);
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!mounted || online) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-1 text-center text-xs text-amber-900">
      Modo offline ativo — {pending} item(ns) na fila de sincronização
    </div>
  );
}
