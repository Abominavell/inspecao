"use client";

import { useEffect, useState } from "react";
import {
  getLocalInspection,
  resolveInspectionClientId,
  localToInspectionDisplay,
} from "@/lib/db/repositories/inspectionRepo";
import { LocalInspection } from "@/lib/db";
import { api, Inspection } from "@/lib/api";

export function useLocalInspection(idOrClientId: string | number) {
  const [local, setLocal] = useState<LocalInspection | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    resolveInspectionClientId(idOrClientId).then(async (cid) => {
      if (!active) return;
      setClientId(cid);
      let record = await getLocalInspection(cid);
      if (!record && !cid.includes("-") && navigator.onLine) {
        try {
          const server = await api.getInspection(Number(cid));
          const { upsertLocalFromServer } = await import("@/lib/db/repositories/inspectionRepo");
          record = await upsertLocalFromServer(server);
        } catch {
          // keep null
        }
      }
      if (active) {
        setLocal(record ?? null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [idOrClientId]);

  const inspection: Inspection | null = local ? localToInspectionDisplay(local) : null;
  const readOnly = local?.status === "finalizado" || Boolean(local?.is_archived);
  const canGeneratePdf =
    Boolean(local?.server_id) &&
    typeof navigator !== "undefined" &&
    navigator.onLine;

  return { local, clientId, inspection, loading, readOnly, canGeneratePdf, refresh: async () => {
    const record = await getLocalInspection(clientId);
    setLocal(record ?? null);
  }};
}
