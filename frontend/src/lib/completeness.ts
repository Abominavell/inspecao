import type { ChecklistSection, Completeness } from "@/lib/api";
import type { LocalInspection, LocalAnswer, LocalPhoto } from "@/lib/db";
import { getLocalAnswers } from "@/lib/db/repositories/answerRepo";
import { getAddressPhoto, getLocalPhotos } from "@/lib/db/repositories/photoRepo";
import { getCachedReference } from "@/lib/db/repositories/inspectionRepo";
import type { UnitInput } from "@/lib/api";

export type LiveChecklistAnswer = {
  status: "C" | "NC" | "NA" | null;
  description?: string;
  recommendation?: string;
  photos?: { id?: number }[];
};

const COVER_CHECKS: { label: string; field: keyof LocalInspection }[] = [
  { label: "diretoria executiva (capa)", field: "cover_diretoria_executiva" },
  { label: "diretor executivo (capa)", field: "cover_diretor_executivo" },
  { label: "gerência geral (capa)", field: "cover_gerencia_geral" },
  { label: "gerente geral (capa)", field: "cover_gerente_geral" },
  { label: "gerência SST (capa)", field: "cover_gerencia_sst" },
  { label: "gerente SST (capa)", field: "cover_gerente_sst" },
  { label: "gerência de meio ambiente (capa)", field: "cover_gerencia_meio_ambiente" },
  { label: "gerente de meio ambiente (capa)", field: "cover_gerente_meio_ambiente" },
];

const UNIT_CHECKS: { label: string; key: keyof UnitInput }[] = [
  { label: "nome da unidade", key: "name" },
  { label: "regional", key: "regional" },
  { label: "cidade", key: "city" },
  { label: "endereço", key: "address" },
  { label: "porte da unidade", key: "unit_type" },
  { label: "coordenador(a) administrativo", key: "admin_coordinator" },
  { label: "diretor geral", key: "general_director" },
  { label: "caracterização da unidade", key: "characterization" },
];

const TEXT_CHECKS: { label: string; field: keyof LocalInspection }[] = [
  { label: "informações gerais da unidade", field: "general_info_text" },
  { label: "metodologia", field: "methodology_text" },
  { label: "objetivos do levantamento", field: "objectives_text" },
  { label: "limitações do relatório", field: "limitations_text" },
  { label: "considerações finais", field: "final_considerations_text" },
];

/** Item do checklist só conta como concluído se atender às regras de NC. */
export function isChecklistItemComplete(
  answer: LiveChecklistAnswer | undefined,
  ncPhotoCount: number
): boolean {
  if (!answer?.status) return false;
  if (answer.status === "NC") {
    if (!answer.description?.trim()) return false;
    if (!answer.recommendation?.trim()) return false;
    const photoCount = (answer.photos?.length ?? 0) + ncPhotoCount;
    if (photoCount <= 0) return false;
  }
  return true;
}

export function sectionChecklistProgress(
  sec: ChecklistSection,
  answers: Record<number, LiveChecklistAnswer>,
  ncPhotoCounts: Record<number, number>
): { answered: number; total: number } {
  let answered = 0;
  for (const item of sec.items) {
    if (isChecklistItemComplete(answers[item.id], ncPhotoCounts[item.id] ?? 0)) answered++;
  }
  return { answered, total: sec.items.length };
}

function unitFromLocal(local: LocalInspection): UnitInput {
  const data = (local.unit_data ?? {}) as Partial<UnitInput>;
  return {
    name: data.name ?? local.unit_name ?? "",
    regional: data.regional ?? local.unit_regional ?? "",
    city: data.city ?? local.unit_city ?? "",
    address: data.address ?? "",
    unit_type: data.unit_type ?? "",
    employee_count: data.employee_count ?? 0,
    admin_coordinator: data.admin_coordinator ?? "",
    general_director: data.general_director ?? "",
    characterization: data.characterization ?? "",
  };
}

function buildNcPhotoCounts(
  photos: LocalPhoto[],
  liveCounts?: Record<number, number>
): Record<number, number> {
  const counts: Record<number, number> = { ...liveCounts };
  for (const p of photos) {
    if (p.photo_type === "nc" && p.checklist_item_id) {
      counts[p.checklist_item_id] = (counts[p.checklist_item_id] ?? 0) + 1;
    }
  }
  return counts;
}

function answerMapFromDb(
  sections: ChecklistSection[],
  dbAnswers: LocalAnswer[]
): Record<number, LiveChecklistAnswer> {
  const byItem = new Map(dbAnswers.map((a) => [a.checklist_item_id, a]));
  const map: Record<number, LiveChecklistAnswer> = {};
  for (const sec of sections) {
    for (const item of sec.items) {
      const ex = byItem.get(item.id);
      map[item.id] = {
        status: ex?.status ?? null,
        description: ex?.description ?? "",
        recommendation: ex?.recommendation ?? "",
        photos: [],
      };
    }
  }
  return map;
}

export type ComputeCompletenessInput = {
  clientId: string;
  local: LocalInspection;
  sections?: ChecklistSection[];
  /** Respostas em memória (prioridade sobre IndexedDB). */
  liveAnswers?: Record<number, LiveChecklistAnswer>;
  /** Fotos NC locais já contabilizadas por item (ex.: previews na tela). */
  liveNcPhotoCounts?: Record<number, number>;
};

export async function computeLocalCompleteness(
  input: ComputeCompletenessInput
): Promise<Completeness> {
  const { clientId, local } = input;
  const sections =
    input.sections ?? (await getCachedReference<ChecklistSection[]>("checklist")) ?? [];

  const dbAnswers = await getLocalAnswers(clientId);
  const photos = await getLocalPhotos(clientId);
  const addressPhoto = await getAddressPhoto(clientId);

  const answerMap = input.liveAnswers ?? answerMapFromDb(sections, dbAnswers);
  const ncPhotoCounts = buildNcPhotoCounts(photos, input.liveNcPhotoCounts);

  const pending: string[] = [];
  const errors: string[] = [];
  let totalItems = 0;
  let answered = 0;
  let ncWithoutPhoto = 0;
  let unansweredForError = 0;

  for (const section of sections) {
    for (const item of section.items) {
      totalItems += 1;
      const answer = answerMap[item.id];
      const localNc = ncPhotoCounts[item.id] ?? 0;
      const photoCount = (answer?.photos?.length ?? 0) + localNc;

      if (!answer?.status) {
        pending.push(`Responder item ${item.item_code}`);
        unansweredForError++;
        if (unansweredForError <= 5) {
          errors.push(`Checklist: responda item ${item.item_code}`);
        }
        continue;
      }

      if (answer.status === "NC") {
        if (!answer.description?.trim()) {
          pending.push(`Descrição no item NC ${item.item_code}`);
          errors.push(`Checklist: descrição obrigatória no item NC ${item.item_code}`);
        }
        if (!answer.recommendation?.trim()) {
          pending.push(`Recomendação no item NC ${item.item_code}`);
          errors.push(`Checklist: recomendação obrigatória no item NC ${item.item_code}`);
        }
        if (photoCount <= 0) {
          pending.push(`Foto no item NC ${item.item_code}`);
          errors.push(`Checklist: foto obrigatória no item NC ${item.item_code}`);
          ncWithoutPhoto++;
        }
      }

      if (isChecklistItemComplete(answer, localNc)) {
        answered++;
      }
    }
  }

  if (unansweredForError > 5) {
    errors.push(`Checklist: faltam ${unansweredForError} de ${totalItems} itens sem resposta`);
  }

  const unit = unitFromLocal(local);
  for (const { label, key } of UNIT_CHECKS) {
    if (!String(unit[key] ?? "").trim()) {
      pending.push(`Unidade: ${label}`);
      errors.push(`Unidade: preencha ${label}`);
    }
  }
  if ((unit.employee_count ?? 0) <= 0) {
    pending.push("Unidade: quantidade de funcionários");
    errors.push("Unidade: informe a quantidade de funcionários");
  }

  const hasAddressPhoto = Boolean(local.has_address_photo || addressPhoto);
  if (!hasAddressPhoto) {
    pending.push("Foto do local (endereço)");
    errors.push("Dados: envie a foto do local (endereço)");
  }

  for (const { label, field } of COVER_CHECKS) {
    if (!String(local[field] ?? "").trim()) {
      pending.push(`Capa: ${label}`);
      errors.push(`Capa do relatório: preencha ${label}`);
    }
  }

  for (const { label, field } of TEXT_CHECKS) {
    if (!String(local[field] ?? "").trim()) {
      pending.push(`Relatório: ${label}`);
      errors.push(`Relatório: preencha ${label}`);
    }
  }

  const unitComplete =
    UNIT_CHECKS.every(({ key }) => String(unit[key] ?? "").trim()) &&
    (unit.employee_count ?? 0) > 0;
  const addressPhotoComplete = hasAddressPhoto;
  const coverComplete = COVER_CHECKS.every(({ field }) => String(local[field] ?? "").trim());
  const textsComplete = TEXT_CHECKS.every(({ field }) => String(local[field] ?? "").trim());
  const checklistComplete = answered === totalItems && totalItems > 0;
  const readyForReport =
    unitComplete && addressPhotoComplete && coverComplete && textsComplete && checklistComplete;

  return {
    unit_complete: unitComplete,
    address_photo_complete: addressPhotoComplete,
    cover_complete: coverComplete,
    texts_complete: textsComplete,
    checklist_answered: answered,
    checklist_total: totalItems,
    checklist_complete: checklistComplete,
    nc_without_photo: ncWithoutPhoto,
    ready_for_report: readyForReport,
    pending_items: pending.slice(0, 50),
    pending_count: pending.length,
    errors,
  };
}
