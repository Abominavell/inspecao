"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AutoSaveIndicator from "@/components/AutoSaveIndicator";
import InspectionNav from "@/components/InspectionNav";
import PendingItemsPanel from "@/components/PendingItemsPanel";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ToastProvider";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useLocalInspection } from "@/hooks/useLocalInspection";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { api, AuditLogEntry, Completeness, InspectionCoverInput, Scores, SsmaConfig } from "@/lib/api";
import { getCachedReference, saveLocalReport } from "@/lib/db/repositories/inspectionRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";

const emptyCover = (): InspectionCoverInput => ({
  cover_diretor_executivo: "",
  cover_gerente_geral: "",
  cover_gerente_sst: "",
  cover_gerente_meio_ambiente: "",
});

const textFields = [
  [
    "general_info_text",
    "Informações gerais da unidade *",
    "Texto introdutório sobre a unidade inspecionada e sua composição.",
  ],
  ["methodology_text", "Metodologia *", "Diretrizes e procedimentos utilizados na vistoria."],
  ["objectives_text", "Objetivos do levantamento técnico *", "Objetivos da inspeção e do diagnóstico."],
  ["limitations_text", "Limitações do relatório *", "Limitações e ressalvas legais do documento."],
  [
    "final_considerations_text",
    "Considerações finais *",
    "Síntese das observações e conclusões da inspeção.",
  ],
] as const;

export default function RevisaoPage() {
  const params = useParams();
  const rawId = params.id as string;
  const online = useOnlineStatus();
  const { local, clientId, inspection, loading: localLoading, readOnly, canGeneratePdf, refresh } =
    useLocalInspection(rawId);
  const [ssma, setSsma] = useState<SsmaConfig | null>(null);
  const [cover, setCover] = useState<InspectionCoverInput>(emptyCover());
  const [texts, setTexts] = useState({
    general_info_text: "",
    methodology_text: "",
    objectives_text: "",
    limitations_text: "",
    final_considerations_text: "",
  });
  const [scores, setScores] = useState<Scores | null>(null);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const { toast } = useToast();
  const serverId = local?.server_id ?? 0;

  const load = useCallback(() => {
    setReady(false);
    return (async () => {
      const defaults =
        (await getCachedReference<SsmaConfig>("ssma")) ?? {
          diretor_executivo: "",
          gerente_geral: "",
          gerente_sst: "",
          gerente_meio_ambiente: "",
          diretoria_executiva: "",
          gerencia_geral: "",
          gerencia_sst: "",
          gerencia_meio_ambiente: "",
          regional: "",
          cidade: "",
        };
      setSsma(defaults);
      if (local) {
        setCover({
          cover_diretor_executivo: local.cover_diretor_executivo || defaults.diretor_executivo,
          cover_gerente_geral: local.cover_gerente_geral || defaults.gerente_geral,
          cover_gerente_sst: local.cover_gerente_sst || defaults.gerente_sst,
          cover_gerente_meio_ambiente:
            local.cover_gerente_meio_ambiente || defaults.gerente_meio_ambiente,
        });
        setTexts({
          general_info_text: local.general_info_text || "",
          methodology_text: local.methodology_text || "",
          objectives_text: local.objectives_text || "",
          limitations_text: local.limitations_text || "",
          final_considerations_text: local.final_considerations_text || "",
        });
      }
      if (local?.server_id && navigator.onLine) {
        try {
          const [sc, comp, me] = await Promise.all([
            api.getScores(local.server_id),
            api.getCompleteness(local.server_id),
            api.me(),
          ]);
          setScores(sc);
          setCompleteness(comp);
          setIsStaff(me.is_staff);
          if (me.is_staff) {
            api.getAuditLog(local.server_id).then(setAuditLog).catch(() => setAuditLog([]));
          }
        } catch {
          /* offline */
        }
      }
      setReady(true);
    })();
  }, [local]);

  useEffect(() => {
    if (!localLoading) load();
  }, [load, localLoading]);

  const reportKey = useMemo(() => JSON.stringify({ cover, texts, clientId }), [cover, texts, clientId]);

  const persistReport = useCallback(async () => {
    if (!clientId) return;
    await saveLocalReport(clientId, { ...texts, ...cover }, local?.server_id);
    if (local?.server_id && navigator.onLine) {
      const comp = await api.getCompleteness(local.server_id);
      setCompleteness(comp);
    } else if (navigator.onLine) {
      void syncEngine.syncNow();
    }
  }, [clientId, texts, cover, local?.server_id]);

  const { status: saveStatus, error: saveError, saveNow } = useAutoSave(reportKey, persistReport, {
    ready: ready && !!inspection && !readOnly,
    label: "Relatório",
    onSaved: () => toast("Relatório salvo", "success"),
    onError: (msg) => toast(msg, "error"),
  });

  async function downloadPdf() {
    if (!online) {
      setError("Conecte-se à internet antes de gerar o PDF.");
      return;
    }
    if (!local?.server_id) {
      setError("A inspeção ainda não foi sincronizada com o servidor. Use “Sincronizar agora” no topo.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      if (!readOnly) {
        await saveNow();
        await api.updateInspection(local.server_id, { ...texts, ...cover });
        await refresh();
      }
      const comp = await api.getCompleteness(local.server_id);
      setCompleteness(comp);
      if (!comp.ready_for_report) {
        setError(
          comp.errors.length > 0
            ? comp.errors.join("\n")
            : "Complete todos os campos antes de gerar o relatório."
        );
        return;
      }
      const blob = await api.downloadPdf(local.server_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_inspecao_${local.server_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Relatório gerado — inspeção finalizada", "success");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <InspectionNav title={inspection?.unit?.name} />

      {readOnly && (
        <ReadOnlyBanner
          status={local?.is_archived ? "archived" : "finalizado"}
          isStaff={isStaff}
          clientId={clientId}
          serverId={local?.server_id}
          unitName={local?.unit_name ?? inspection?.unit?.name}
          onReopen={async () => {
            if (local?.server_id) {
              await api.reopenInspection(local.server_id);
              toast("Inspeção reaberta", "success");
              await load();
            }
          }}
        />
      )}

      <PendingItemsPanel completeness={completeness} />

      <p className="mb-4 text-sm text-slate-600">
        Capa e textos são salvos localmente. O PDF só pode ser gerado online, após sincronização com o
        servidor.
      </p>

      {!canGeneratePdf && !readOnly && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {!online
            ? "Sem conexão — continue editando; o PDF ficará disponível após reconectar."
            : !local?.server_id
              ? "Sincronize a inspeção com o servidor para liberar o PDF."
              : null}
        </p>
      )}

      <AutoSaveIndicator status={saveStatus} error={saveError} />

      <div className="mb-6 space-y-6">
        <Card
          title="Capa do relatório"
          description="Os cargos e gerências são fixos (configuração SSMA). Informe apenas os nomes dos responsáveis. Regional e cidade vêm dos dados da unidade."
        >
          {ssma && (
            <div className="mb-4 rounded-xl border border-emserh-green/20 bg-emserh-green-light/60 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emserh-green">
                Hierarquia fixa na capa
              </p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="text-emserh-green">▸</span>
                  {ssma.diretoria_executiva}
                </li>
                <li className="flex gap-2">
                  <span className="text-emserh-green">▸</span>
                  {ssma.gerencia_geral}
                </li>
                <li className="flex gap-2">
                  <span className="text-emserh-green">▸</span>
                  {ssma.gerencia_sst}
                </li>
                <li className="flex gap-2">
                  <span className="text-emserh-green">▸</span>
                  {ssma.gerencia_meio_ambiente}
                </li>
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["cover_diretor_executivo", "Diretor executivo *"],
                ["cover_gerente_geral", "Gerente geral *"],
                ["cover_gerente_sst", "Gerente SST *"],
                ["cover_gerente_meio_ambiente", "Gerente de Meio Ambiente *"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                label={label}
                value={cover[key]}
                onChange={(e) => setCover({ ...cover, [key]: e.target.value })}
                required
                disabled={readOnly || saveStatus === "saving"}
              />
            ))}
          </div>
        </Card>

        <Card title="Textos do relatório">
          {textFields.map(([key, label, placeholder]) => (
            <div key={key} className="mb-4 last:mb-0">
              <Textarea
                label={label}
                value={texts[key]}
                onChange={(e) => setTexts({ ...texts, [key]: e.target.value })}
                rows={4}
                placeholder={placeholder}
                required
                disabled={readOnly || saveStatus === "saving"}
              />
            </div>
          ))}
        </Card>
      </div>

      {completeness && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            completeness.ready_for_report
              ? "border-emserh-green/30 bg-emserh-green-light"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <h2 className="mb-2 font-semibold text-slate-800">Status do preenchimento</h2>
          <ul className="space-y-1 text-sm">
            <li className={completeness.unit_complete ? "text-emserh-green" : "text-slate-600"}>
              {completeness.unit_complete ? "✓" : "○"} Dados da unidade
            </li>
            <li className={completeness.address_photo_complete ? "text-emserh-green" : "text-slate-600"}>
              {completeness.address_photo_complete ? "✓" : "○"} Foto do local
            </li>
            <li className={completeness.cover_complete ? "text-emserh-green" : "text-slate-600"}>
              {completeness.cover_complete ? "✓" : "○"} Capa do relatório
            </li>
            <li className={completeness.texts_complete ? "text-emserh-green" : "text-slate-600"}>
              {completeness.texts_complete ? "✓" : "○"} Textos do relatório
            </li>
            <li className={completeness.checklist_complete ? "text-emserh-green" : "text-slate-600"}>
              {completeness.checklist_complete ? "✓" : "○"} Checklist (
              {completeness.checklist_answered}/{completeness.checklist_total} itens)
            </li>
          </ul>
          {!completeness.ready_for_report && completeness.errors.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-amber-800">Pendências:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-900">
                {completeness.errors.slice(0, 15).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {completeness.errors.length > 15 && (
                  <li>... e mais {completeness.errors.length - 15} item(ns)</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {scores && (
        <Card className="mb-6">
          <h2 className="mb-2 font-semibold text-slate-800">Resumo da inspeção</h2>
          <p className="text-lg">
            Nota geral:{" "}
            <strong className="text-emserh-green">
              {scores.overall_score != null ? `${(scores.overall_score * 100).toFixed(1)}%` : "—"}
            </strong>
          </p>
          <p className="text-sm text-slate-500">
            <span className="text-emserh-green">C: {scores.overall_conforme}</span>
            {" · "}
            <span className="text-red-600">NC: {scores.overall_nao_conforme}</span>
            {" · "}
            <span className="text-slate-600">NA: {scores.overall_nao_aplicavel}</span>
          </p>
        </Card>
      )}

      {error && <p className="mb-4 whitespace-pre-line text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {!readOnly && (
          <Button
            type="button"
            size="lg"
            onClick={downloadPdf}
            disabled={generating || saveStatus === "saving" || !local?.server_id || !online}
            className="shadow-md"
          >
            {generating ? "Gerando PDF..." : "📄 Gerar e baixar relatório PDF"}
          </Button>
        )}
        {readOnly && inspection?.status === "finalizado" && local?.server_id && online && (
          <Button type="button" size="lg" onClick={downloadPdf} disabled={generating}>
            {generating ? "Gerando PDF..." : "📄 Baixar relatório PDF"}
          </Button>
        )}
        {!completeness?.ready_for_report && (
          <>
            {!completeness?.unit_complete && (
              <Link href={`/inspecoes/${rawId}/dados`}>
                <Button variant="secondary" size="lg">
                  Completar dados da unidade
                </Button>
              </Link>
            )}
            {!completeness?.checklist_complete && (
              <Link href={`/inspecoes/${rawId}/checklist`}>
                <Button variant="secondary" size="lg">
                  Completar checklist
                </Button>
              </Link>
            )}
          </>
        )}
      </div>

      {isStaff && auditLog.length > 0 && (
        <Card className="mt-6" title="Histórico de alterações">
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm text-slate-600">
            {auditLog.map((entry) => (
              <li key={entry.id} className="border-b border-border/60 pb-2 last:border-0">
                <span className="font-medium text-slate-800">{entry.action}</span>
                {entry.details && ` — ${entry.details}`}
                <br />
                <span className="text-xs text-slate-400">
                  {entry.user_name || "Sistema"} ·{" "}
                  {new Date(entry.created_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
