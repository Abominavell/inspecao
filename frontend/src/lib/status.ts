export const INSPECTION_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  finalizado: "Finalizado",
  arquivado: "Arquivada",
};

export function inspectionStatusClass(status: string): string {
  switch (status) {
    case "finalizado":
      return "bg-emserh-green/15 text-emserh-green border-emserh-green/30";
    case "arquivado":
      return "bg-slate-200 text-slate-600 border-slate-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
