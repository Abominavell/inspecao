import { AnswerInput } from "@/lib/api";
import { db, LocalAnswer, newClientId } from "@/lib/db";
import { enqueueMutation } from "@/lib/db/repositories/inspectionRepo";

export async function getLocalAnswers(inspectionClientId: string): Promise<LocalAnswer[]> {
  return db.answers.where("inspection_client_id").equals(inspectionClientId).toArray();
}

export async function saveLocalAnswers(
  inspectionClientId: string,
  batch: AnswerInput[]
): Promise<void> {
  const now = new Date().toISOString();
  for (const item of batch) {
    const existing = await db.answers
      .where("[inspection_client_id+checklist_item_id]")
      .equals([inspectionClientId, item.checklist_item_id])
      .first();
    const record: LocalAnswer = {
      id: existing?.id,
      inspection_client_id: inspectionClientId,
      checklist_item_id: item.checklist_item_id,
      server_answer_id: existing?.server_answer_id,
      status: item.status,
      description: item.description,
      recommendation: item.recommendation,
      normative: item.normative,
      client_id: existing?.client_id ?? newClientId(),
      updated_at: now,
    };
    if (existing?.id) {
      await db.answers.update(existing.id, record);
    } else {
      await db.answers.add(record);
    }
  }
  await enqueueMutation("answers.upsert", {
    inspection_client_id: inspectionClientId,
    answers: batch,
  });
}

export async function upsertAnswersFromServer(
  inspectionClientId: string,
  answers: Array<{
    id: number;
    checklist_item_id: number;
    status: "C" | "NC" | "NA" | null;
    description: string;
    recommendation: string;
    normative: string;
  }>
): Promise<void> {
  const now = new Date().toISOString();
  for (const a of answers) {
    const existing = await db.answers
      .where("[inspection_client_id+checklist_item_id]")
      .equals([inspectionClientId, a.checklist_item_id])
      .first();
    const record: LocalAnswer = {
      id: existing?.id,
      inspection_client_id: inspectionClientId,
      checklist_item_id: a.checklist_item_id,
      server_answer_id: a.id,
      status: a.status,
      description: a.description,
      recommendation: a.recommendation,
      normative: a.normative,
      client_id: existing?.client_id ?? newClientId(),
      updated_at: now,
    };
    if (existing?.id) {
      await db.answers.update(existing.id, record);
    } else {
      await db.answers.add(record);
    }
  }
}
