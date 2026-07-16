import type { ChecklistSection, SsmaConfig } from "@/lib/api";
import type { LocalAnswer, LocalInspection, LocalPhoto } from "@/lib/db";
import type { UnitInput } from "@/lib/api";

export type SectionScore = {
  section_id: number;
  section_order: number;
  section_title: string;
  conforme: number;
  nao_conforme: number;
  nao_aplicavel: number;
  total_applicable: number;
  score: number | null;
};

export type ScoresResult = {
  sections: SectionScore[];
  overall_conforme: number;
  overall_nao_conforme: number;
  overall_nao_aplicavel: number;
  overall_score: number | null;
};

export function computeSectionScores(
  sections: ChecklistSection[],
  answers: LocalAnswer[]
): ScoresResult {
  const byItem = new Map(answers.map((a) => [a.checklist_item_id, a]));
  const sectionScores: SectionScore[] = [];
  let totalC = 0;
  let totalNc = 0;
  let totalNa = 0;

  for (const section of sections) {
    let c = 0;
    let nc = 0;
    let na = 0;
    for (const item of section.items) {
      const answer = byItem.get(item.id);
      if (!answer?.status) continue;
      if (answer.status === "C") c += 1;
      else if (answer.status === "NC") nc += 1;
      else if (answer.status === "NA") na += 1;
    }
    const applicable = c + nc + na;
    sectionScores.push({
      section_id: section.id,
      section_order: section.order,
      section_title: section.title,
      conforme: c,
      nao_conforme: nc,
      nao_aplicavel: na,
      total_applicable: applicable,
      score: applicable > 0 ? c / applicable : null,
    });
    totalC += c;
    totalNc += nc;
    totalNa += na;
  }

  const overallApplicable = totalC + totalNc + totalNa;
  return {
    sections: sectionScores,
    overall_conforme: totalC,
    overall_nao_conforme: totalNc,
    overall_nao_aplicavel: totalNa,
    overall_score: overallApplicable > 0 ? totalC / overallApplicable : null,
  };
}

export type NonConformity = {
  item_code: string;
  question: string;
  description: string;
  normative: string;
  recommendation: string;
  section_title: string;
  photoDataUris: string[];
};

export function getNonConformities(
  sections: ChecklistSection[],
  answers: LocalAnswer[],
  photos: LocalPhoto[],
  blobToDataUri: (blob: Blob) => Promise<string>
): Promise<NonConformity[]> {
  const byItem = new Map(answers.map((a) => [a.checklist_item_id, a]));
  const photosByItem = new Map<number, LocalPhoto[]>();
  for (const p of photos.filter((x) => x.photo_type === "nc")) {
    const list = photosByItem.get(p.checklist_item_id) ?? [];
    list.push(p);
    photosByItem.set(p.checklist_item_id, list);
  }

  const tasks: Promise<NonConformity>[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      const answer = byItem.get(item.id);
      if (answer?.status !== "NC") continue;
      tasks.push(
        (async () => {
          const itemPhotos = photosByItem.get(item.id) ?? [];
          const photoDataUris: string[] = [];
          for (const ph of itemPhotos) {
            photoDataUris.push(await blobToDataUri(ph.blob));
          }
          return {
            item_code: item.item_code,
            question: item.question,
            description: answer.description || item.question,
            normative: answer.normative,
            recommendation: answer.recommendation,
            section_title: section.title,
            photoDataUris,
          };
        })()
      );
    }
  }

  return Promise.all(tasks).then((items) =>
    items.sort((a, b) => a.item_code.localeCompare(b.item_code, undefined, { numeric: true }))
  );
}

export function inspectionCoverConfig(
  inspection: LocalInspection,
  unit: UnitInput,
  ssma: SsmaConfig
) {
  return {
    diretoria_executiva: ssma.diretoria_executiva,
    diretor_executivo: inspection.cover_diretor_executivo || ssma.diretor_executivo,
    gerencia_geral: ssma.gerencia_geral,
    gerente_geral: inspection.cover_gerente_geral || ssma.gerente_geral,
    gerencia_sst: ssma.gerencia_sst,
    gerente_sst: inspection.cover_gerente_sst || ssma.gerente_sst,
    gerencia_meio_ambiente: ssma.gerencia_meio_ambiente,
    gerente_meio_ambiente: inspection.cover_gerente_meio_ambiente || ssma.gerente_meio_ambiente,
    regional: unit.regional || ssma.regional,
    cidade: unit.city || ssma.cidade,
  };
}

function fmtScore(score: number | null): string {
  if (score == null) return "—";
  return `${(score * 100).toFixed(1).replace(".", ",")}%`;
}

export function fmtPct(score: number | null): string {
  return fmtScore(score);
}
