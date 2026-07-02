"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { upsertLocalFromServer } from "@/lib/db/repositories/inspectionRepo";
import { useToast } from "@/components/ToastProvider";

type Conflict = {
  type?: string;
  client_id?: string;
  server_id?: number;
  server_updated_at?: string;
};

export default function SyncConflictHandler() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    function onConflict(e: Event) {
      const detail = (e as CustomEvent<Conflict[]>).detail;
      if (detail?.length) setConflicts(detail);
    }
    window.addEventListener("sync-conflict", onConflict);
    return () => window.removeEventListener("sync-conflict", onConflict);
  }, []);

  if (conflicts.length === 0) return null;

  const current = conflicts[0];

  async function useServerVersion() {
    const serverId = current.server_id;
    if (!serverId) {
      setConflicts((prev) => prev.slice(1));
      return;
    }
    try {
      const insp = await api.getInspection(serverId);
      await upsertLocalFromServer(insp);
      toast("Versão do servidor aplicada localmente", "success");
      setConflicts((prev) => prev.slice(1));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao aplicar versão do servidor", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800">Conflito de sincronização</h2>
        <p className="mt-2 text-sm text-slate-600">
          O servidor possui uma versão mais recente desta inspeção
          {current.server_updated_at
            ? ` (atualizada em ${new Date(current.server_updated_at).toLocaleString("pt-BR")})`
            : ""}
          . Você pode substituir seus dados locais pela versão do servidor.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={useServerVersion}>
            Usar versão do servidor
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConflicts((prev) => prev.slice(1))}>
            Manter local por agora
          </Button>
        </div>
        {conflicts.length > 1 && (
          <p className="mt-3 text-xs text-slate-500">+{conflicts.length - 1} conflito(s) restante(s)</p>
        )}
      </div>
    </div>
  );
}
