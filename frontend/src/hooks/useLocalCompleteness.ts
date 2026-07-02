"use client";

import { useEffect, useState } from "react";
import type { ChecklistSection, Completeness } from "@/lib/api";
import type { LocalInspection } from "@/lib/db";
import { computeLocalCompleteness, type LiveChecklistAnswer } from "@/lib/completeness";

type Options = {
  sections?: ChecklistSection[];
  liveAnswers?: Record<number, LiveChecklistAnswer>;
  liveNcPhotoCounts?: Record<number, number>;
  enabled?: boolean;
};

/** Calcula pendências a partir do IndexedDB + estado do formulário (fonte fiel ao checklist). */
export function useLocalCompleteness(
  clientId: string,
  local: LocalInspection | null | undefined,
  revisionKey: string,
  options: Options = {}
): Completeness | null {
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled || !clientId || !local) {
      setCompleteness(null);
      return;
    }
    let active = true;
    void computeLocalCompleteness({
      clientId,
      local,
      sections: options.sections,
      liveAnswers: options.liveAnswers,
      liveNcPhotoCounts: options.liveNcPhotoCounts,
    }).then((result) => {
      if (active) setCompleteness(result);
    });
    return () => {
      active = false;
    };
    // revisionKey agrega mudanças em liveAnswers / fotos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, local, revisionKey, enabled]);

  return completeness;
}
