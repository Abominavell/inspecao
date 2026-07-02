import { api, Answer, ChecklistSection } from "@/lib/api";
import type { LiveChecklistAnswer } from "@/lib/completeness";
import { upsertAnswersFromServer } from "@/lib/db/repositories/answerRepo";
import {
  getLocalInspection,
  upsertLocalFromServer,
} from "@/lib/db/repositories/inspectionRepo";

/** Copia inspeção + respostas do servidor para o IndexedDB (fonte após sync). */
export async function hydrateInspectionFromServer(
  clientId: string,
  serverId: number
): Promise<void> {
  const [insp, answers] = await Promise.all([
    api.getInspection(serverId),
    api.getAnswers(serverId),
  ]);
  const record = await upsertLocalFromServer(insp);
  const targetId = record.client_id || clientId;
  await upsertAnswersFromServer(
    targetId,
    answers.map((a) => ({
      id: a.id,
      checklist_item_id: a.checklist_item_id,
      status: a.status,
      description: a.description,
      recommendation: a.recommendation,
      normative: a.normative,
    }))
  );
}

export function answersToLiveMap(
  sections: ChecklistSection[],
  serverAnswers: Answer[]
): Record<number, LiveChecklistAnswer> {
  const byItem = new Map(serverAnswers.map((a) => [a.checklist_item_id, a]));
  const map: Record<number, LiveChecklistAnswer> = {};
  for (const sec of sections) {
    for (const item of sec.items) {
      const ex = byItem.get(item.id);
      map[item.id] = {
        status: ex?.status ?? null,
        description: ex?.description ?? "",
        recommendation: ex?.recommendation ?? "",
        photos: ex?.photos ?? [],
      };
    }
  }
  return map;
}
