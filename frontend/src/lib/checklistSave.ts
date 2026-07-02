import { AnswerInput, ChecklistSection } from "@/lib/api";

type LocalAnswer = AnswerInput & {
  item_code: string;
  question: string;
  answerId?: number;
  photos: { id: number; answer_id: number; file_path: string; original_filename: string; url: string }[];
};

export function buildSectionBatch(
  section: ChecklistSection,
  answers: Record<number, LocalAnswer>
): AnswerInput[] {
  const batch: AnswerInput[] = [];

  for (const item of section.items) {
    const a = answers[item.id];
    if (!a?.status) continue;

    if (a.status === "NC" && (!a.description.trim() || !a.recommendation.trim())) {
      continue;
    }

    batch.push({
      checklist_item_id: item.id,
      status: a.status,
      description: a.description,
      recommendation: a.recommendation,
      normative: a.normative,
    });
  }

  return batch;
}

export function sectionAnswersKey(
  section: ChecklistSection | undefined,
  answers: Record<number, LocalAnswer>
): string {
  if (!section) return "";
  return JSON.stringify(
    section.items.map((item) => {
      const a = answers[item.id];
      return {
        id: item.id,
        status: a?.status ?? null,
        description: a?.description ?? "",
        recommendation: a?.recommendation ?? "",
        normative: a?.normative ?? "",
      };
    })
  );
}
