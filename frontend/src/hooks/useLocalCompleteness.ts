"use client";

import { useEffect, useState } from "react";
import type { ChecklistSection, Completeness } from "@/lib/api";
import { api } from "@/lib/api";
import type { LocalInspection } from "@/lib/db";
import { computeLocalCompleteness, type LiveChecklistAnswer } from "@/lib/completeness";
import { getCachedReference, getLocalInspection } from "@/lib/db/repositories/inspectionRepo";
import {
  answersToLiveMap,
  hydrateInspectionFromServer,
} from "@/lib/hydrateInspectionFromServer";

type Options = {
  sections?: ChecklistSection[];
  liveAnswers?: Record<number, LiveChecklistAnswer>;
  liveNcPhotoCounts?: Record<number, number>;
  enabled?: boolean;
};

function pickCompleteness(local: Completeness, server: Completeness | null): Completeness {
  // Com server_id online, o servidor é a fonte da verdade (igual ao bloqueio do PDF).
  if (server) return server;
  return local;
}

/**
 * Pendências: calcula localmente e, se online com server_id, hidrata do servidor
 * e usa a completude mais avançada (evita cache local desatualizado após sync).
 */
export function useInspectionCompleteness(
  clientId: string,
  local: LocalInspection | null | undefined,
  revisionKey: string,
  options: Options = {}
): Completeness | null {
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const enabled = options.enabled ?? true;
  const serverId = local?.server_id;

  useEffect(() => {
    if (!enabled || !clientId || !local) {
      setCompleteness(null);
      return;
    }
    let active = true;

    let inspection = local;
    async function run() {
      let liveAnswers = options.liveAnswers;
      let serverComp: Completeness | null = null;

      if (serverId && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          if (!liveAnswers) {
            await hydrateInspectionFromServer(clientId, serverId);
            const refreshed = await getLocalInspection(clientId);
            if (refreshed) inspection = refreshed;
          }
          const sections =
            options.sections ?? (await getCachedReference<ChecklistSection[]>("checklist")) ?? [];
          const [serverAnswers, sc] = await Promise.all([
            api.getAnswers(serverId),
            api.getCompleteness(serverId),
          ]);
          serverComp = sc;
          if (!liveAnswers && sections.length > 0) {
            liveAnswers = answersToLiveMap(sections, serverAnswers);
          }
        } catch {
          /* offline ou erro de rede */
        }
      }

      const localComp = await computeLocalCompleteness({
        clientId,
        local: inspection,
        sections: options.sections,
        liveAnswers,
        liveNcPhotoCounts: options.liveNcPhotoCounts,
      });

      if (active) setCompleteness(pickCompleteness(localComp, serverComp));
    }

    void run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, local, revisionKey, enabled, serverId]);

  return completeness;
}

/** @deprecated Use useInspectionCompleteness */
export const useLocalCompleteness = useInspectionCompleteness;
