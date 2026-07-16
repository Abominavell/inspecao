import type { ChecklistSection } from "@/lib/api";
import type { LocalAnswer, LocalInspection, LocalPhoto } from "@/lib/db";
import type { UnitInput, SsmaConfig } from "@/lib/api";
import {
  computeSectionScores,
  getNonConformities,
  inspectionCoverConfig,
  fmtPct,
  type NonConformity,
} from "@/lib/report/scoring";

async function blobToDataUri(blob: Blob, maxWidth = 1200): Promise<string> {
  if (typeof createImageBitmap === "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const bitmap = await createImageBitmap(blob);
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ncTable(ncs: NonConformity[]): string {
  if (ncs.length === 0) return "<p>Nenhuma não conformidade registrada.</p>";
  return ncs
    .map(
      (nc) => `
    <div class="nc-block">
      <p><strong>${escapeHtml(nc.item_code)}</strong> — ${escapeHtml(nc.section_title)}</p>
      <p>${escapeHtml(nc.description)}</p>
      <p><em>Recomendação:</em> ${escapeHtml(nc.recommendation)}</p>
      ${nc.photoDataUris.map((u) => `<img src="${u}" class="nc-photo" alt="Foto NC ${escapeHtml(nc.item_code)}" />`).join("")}
    </div>`
    )
    .join("");
}

export type ReportInput = {
  inspection: LocalInspection;
  unit: UnitInput;
  ssma: SsmaConfig;
  sections: ChecklistSection[];
  answers: LocalAnswer[];
  photos: LocalPhoto[];
  addressPhotoUri?: string;
  logoUri?: string;
};

export async function buildReportHtml(input: ReportInput): Promise<string> {
  const { inspection, unit, ssma, sections, answers, photos } = input;
  const scores = computeSectionScores(sections, answers);
  const cover = inspectionCoverConfig(inspection, unit, ssma);
  const ncs = await getNonConformities(sections, answers, photos, (b) => blobToDataUri(b));

  const scoreRows = scores.sections
    .map(
      (s) => `
    <tr>
      <td>${escapeHtml(s.section_title)}</td>
      <td>${s.conforme}</td>
      <td>${s.nao_conforme}</td>
      <td>${s.nao_aplicavel}</td>
      <td>${fmtPct(s.score)}</td>
    </tr>`
    )
    .join("");

  const logo = input.logoUri ? `<img src="${input.logoUri}" class="logo" alt="EMSERH" />` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório — ${escapeHtml(unit.name)}</title>
  <style>
    @page { size: A4; margin: 2cm 1.5cm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; line-height: 1.35; }
    h1 { font-size: 14pt; text-align: center; color: #1a5f3c; }
    h2 { font-size: 12pt; margin-top: 1.2em; border-bottom: 1px solid #ccc; color: #1a5f3c; }
    .cover { page-break-after: always; text-align: right; }
    .cover .logo { max-width: 180px; margin-bottom: 1em; }
    table { width: 100%; border-collapse: collapse; margin: 0.5em 0; font-size: 10pt; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
    th { background: #e8f5e9; }
    .nc-block { margin: 1em 0; page-break-inside: avoid; }
    .nc-photo { max-width: 100%; max-height: 280px; margin: 0.5em 0; display: block; }
    .address-photo { max-width: 100%; max-height: 320px; margin: 0.5em 0; }
    .page-break { page-break-before: always; }
    p { margin: 0.4em 0; }
  </style>
</head>
<body>
  <div class="cover">
    ${logo}
    <div class="cover-hierarchy">
      <p><strong>${escapeHtml(cover.diretoria_executiva)}</strong><br/>${escapeHtml(cover.diretor_executivo)}</p>
      <p><strong>${escapeHtml(cover.gerencia_geral)}</strong><br/>${escapeHtml(cover.gerente_geral)}</p>
      <p><strong>${escapeHtml(cover.gerencia_sst)}</strong><br/>${escapeHtml(cover.gerente_sst)}</p>
      <p><strong>${escapeHtml(cover.gerencia_meio_ambiente)}</strong><br/>${escapeHtml(cover.gerente_meio_ambiente)}</p>
    </div>
    <h1>RELATÓRIO TÉCNICO DE INSPEÇÃO</h1>
    <p><strong>Unidade:</strong> ${escapeHtml(unit.name)}</p>
    <p><strong>Regional:</strong> ${escapeHtml(cover.regional)} — ${escapeHtml(cover.cidade)}</p>
    <p><strong>Data da vistoria:</strong> ${escapeHtml(inspection.inspection_date)}</p>
    <p><strong>Data do relatório:</strong> ${escapeHtml(inspection.report_date)}</p>
  </div>

  <h2>Informações gerais</h2>
  <p>${escapeHtml(inspection.general_info_text).replace(/\n/g, "<br/>")}</p>

  <h2>Metodologia</h2>
  <p>${escapeHtml(inspection.methodology_text).replace(/\n/g, "<br/>")}</p>

  <h2>Objetivos</h2>
  <p>${escapeHtml(inspection.objectives_text).replace(/\n/g, "<br/>")}</p>

  <h2>Localização</h2>
  <p>${escapeHtml(unit.address)}</p>
  ${input.addressPhotoUri ? `<img src="${input.addressPhotoUri}" class="address-photo" alt="Foto do endereço" />` : ""}

  <h2>Resultado por seção</h2>
  <table>
    <thead><tr><th>Seção</th><th>C</th><th>NC</th><th>NA</th><th>Nota</th></tr></thead>
    <tbody>${scoreRows}</tbody>
    <tfoot>
      <tr>
        <td><strong>Total</strong></td>
        <td>${scores.overall_conforme}</td>
        <td>${scores.overall_nao_conforme}</td>
        <td>${scores.overall_nao_aplicavel}</td>
        <td><strong>${fmtPct(scores.overall_score)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="page-break"></div>
  <h2>Não conformidades</h2>
  ${ncTable(ncs)}

  <h2>Limitações</h2>
  <p>${escapeHtml(inspection.limitations_text).replace(/\n/g, "<br/>")}</p>

  <h2>Considerações finais</h2>
  <p>${escapeHtml(inspection.final_considerations_text).replace(/\n/g, "<br/>")}</p>
</body>
</html>`;
}
