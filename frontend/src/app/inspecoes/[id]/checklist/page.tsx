"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AutoSaveIndicator from "@/components/AutoSaveIndicator";
import InspectionNav from "@/components/InspectionNav";
import NcPhotoCapture, { LocalPhotoPreview } from "@/components/NcPhotoCapture";
import PendingItemsPanel from "@/components/PendingItemsPanel";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ToastProvider";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useInspectionRouteId } from "@/hooks/useInspectionRouteId";
import { useLocalInspection } from "@/hooks/useLocalInspection";
import { inspectionStepHref, navigateApp } from "@/lib/inspectionRoutes";
import {
  AnswerInput,
  ChecklistSection,
  Completeness,
  Photo,
  SectionScore,
} from "@/lib/api";
import { getLocalAnswers, saveLocalAnswers } from "@/lib/db/repositories/answerRepo";
import { getCachedReference } from "@/lib/db/repositories/inspectionRepo";
import { getLocalPhotos } from "@/lib/db/repositories/photoRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";
import { buildSectionBatch, sectionAnswersKey } from "@/lib/checklistSave";

type LocalAnswer = AnswerInput & {
  item_code: string;
  question: string;
  answerId?: number;
  photos: Photo[];
};

const STATUS_STYLES = {
  C: {
    active: "border-emserh-green bg-emserh-green text-white shadow-sm",
    idle: "border-emserh-green/40 text-emserh-green hover:bg-emserh-green-light",
    label: "Conforme",
  },
  NC: {
    active: "border-red-600 bg-red-600 text-white shadow-sm",
    idle: "border-red-300 text-red-700 hover:bg-red-50",
    label: "Não conforme",
  },
  NA: {
    active: "border-slate-500 bg-slate-500 text-white shadow-sm",
    idle: "border-slate-300 text-slate-600 hover:bg-slate-50",
    label: "N/A",
  },
} as const;

function sectionProgress(sec: ChecklistSection, answers: Record<number, LocalAnswer>) {
  let answered = 0;
  for (const item of sec.items) {
    if (answers[item.id]?.status) answered++;
  }
  return { answered, total: sec.items.length };
}

export default function ChecklistPage() {
  const router = useRouter();
  const rawId = useInspectionRouteId();
  const { clientId, inspection, loading: localLoading, readOnly, local } = useLocalInspection(rawId);
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [answers, setAnswers] = useState<Record<number, LocalAnswer>>({});
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Record<number, LocalPhotoPreview[]>>({});
  const [sectionScore, setSectionScore] = useState<SectionScore | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const { toast } = useToast();
  const serverId = local?.server_id ?? 0;

  const load = useCallback(async () => {
    if (!clientId) return;
    setReady(false);
    const checklist =
      (await getCachedReference<ChecklistSection[]>("checklist")) ?? [];
    const localAnswers = await getLocalAnswers(clientId);
    const localPhotos = await getLocalPhotos(clientId);
    const previews: Record<number, LocalPhotoPreview[]> = {};
    for (const p of localPhotos) {
      if (p.checklist_item_id && p.photo_type === "nc") {
        const itemId = p.checklist_item_id;
        if (!previews[itemId]) previews[itemId] = [];
        previews[itemId].push({
          clientPhotoId: p.client_photo_id,
          url: URL.createObjectURL(p.blob),
        });
      }
    }
    setLocalPreviewUrls(previews);

    const answerByItem = new Map(localAnswers.map((a) => [a.checklist_item_id, a]));
    const map: Record<number, LocalAnswer> = {};
    for (const sec of checklist) {
      for (const item of sec.items) {
        const ex = answerByItem.get(item.id);
        map[item.id] = {
          checklist_item_id: item.id,
          status: ex?.status ?? null,
          description: ex?.description ?? "",
          recommendation: ex?.recommendation ?? "",
          normative: ex?.normative ?? "",
          item_code: item.item_code,
          question: item.question,
          answerId: ex?.server_answer_id,
          photos: [],
        };
      }
    }

    if (local?.server_id && navigator.onLine) {
      try {
        const { api } = await import("@/lib/api");
        const existing = await api.getAnswers(local.server_id);
        const serverByItem = new Map(existing.map((a) => [a.checklist_item_id, a]));
        for (const sec of checklist) {
          for (const item of sec.items) {
            const ex = serverByItem.get(item.id);
            if (ex) {
              map[item.id] = {
                ...map[item.id],
                status: ex.status ?? map[item.id].status,
                description: ex.description || map[item.id].description,
                recommendation: ex.recommendation || map[item.id].recommendation,
                normative: ex.normative || map[item.id].normative,
                answerId: ex.id,
                photos: ex.photos ?? [],
              };
            }
          }
        }
        const comp = await api.getCompleteness(local.server_id);
        setCompleteness(comp);
        const me = await api.me();
        setIsStaff(me.is_staff);
      } catch {
        /* offline */
      }
    }

    setSections(checklist);
    setAnswers(map);
    setReady(true);
  }, [clientId, local?.server_id]);

  useEffect(() => {
    if (!localLoading && clientId) load();
  }, [load, localLoading, clientId]);

  useEffect(() => {
    if (!local?.server_id || !navigator.onLine) return;
    import("@/lib/api").then(({ api }) => {
      api.getScores(local.server_id!).then((scores) => {
        const sec = sections[activeSection];
        if (sec) {
          const found = scores.sections.find((s) => s.section_id === sec.id);
          setSectionScore(found ?? null);
        }
      });
    });
  }, [local?.server_id, activeSection, sections, answers]);

  const current = sections[activeSection];

  const sectionKey = useMemo(
    () => sectionAnswersKey(current, answers),
    [current, answers]
  );

  const persistSection = useCallback(async () => {
    if (!current || !clientId) return;
    const batch = buildSectionBatch(current, answers);
    if (batch.length === 0) return;

    await saveLocalAnswers(clientId, batch);
    if (navigator.onLine) await syncEngine.syncNow();

    if (local?.server_id && navigator.onLine) {
      const { api } = await import("@/lib/api");
      const scores = await api.getScores(local.server_id);
      const found = scores.sections.find((s) => s.section_id === current.id);
      setSectionScore(found ?? null);
      const comp = await api.getCompleteness(local.server_id);
      setCompleteness(comp);
    }
  }, [clientId, current, answers, local?.server_id]);

  const { status: saveStatus, error: saveError, saveNow } = useAutoSave(sectionKey, persistSection, {
    ready: ready && !!current && !readOnly,
    delay: 600,
    label: "Checklist",
    onSaved: () => toast("Checklist salvo", "success"),
    onError: (msg) => toast(msg, "error"),
  });

  function updateAnswer(itemId: number, patch: Partial<LocalAnswer>) {
    setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  function updatePhotos(itemId: number, photos: Photo[], answerId?: number) {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        photos,
        ...(answerId ? { answerId } : {}),
      },
    }));
  }

  async function changeSection(nextIndex: number) {
    if (nextIndex === activeSection) return;
    try {
      await saveNow();
    } catch {
      return;
    }
    setActiveSection(nextIndex);
  }

  function computeLocalScore() {
    if (!current) return null;
    let c = 0,
      nc = 0,
      na = 0;
    for (const item of current.items) {
      const a = answers[item.id];
      if (!a?.status) continue;
      if (a.status === "C") c++;
      else if (a.status === "NC") nc++;
      else if (a.status === "NA") na++;
    }
    const total = c + nc + na;
    return total ? { c, nc, na, score: c / total } : null;
  }

  const localScore = computeLocalScore();

  if (!current) return <p className="text-sm text-slate-500">Carregando checklist…</p>;

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
              const { api } = await import("@/lib/api");
              await api.reopenInspection(local.server_id);
              toast("Inspeção reaberta", "success");
              load();
            }
          }}
        />
      )}

      <PendingItemsPanel completeness={completeness} />

      <p className="mb-4 text-sm text-slate-600">
        Respostas da seção são salvas automaticamente. Ao marcar <strong>NC</strong>, preencha descrição e
        recomendação para gravar; use <strong>Tirar foto</strong> para registrar com a câmera.
      </p>

      <AutoSaveIndicator status={saveStatus} error={saveError} />

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="shrink-0 lg:w-72">
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-sm">
            {sections.map((sec, idx) => {
              const prog = sectionProgress(sec, answers);
              const pct = prog.total ? Math.round((prog.answered / prog.total) * 100) : 0;
              const complete = prog.answered === prog.total && prog.total > 0;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => changeSection(idx)}
                  className={`mb-1 w-full rounded-lg px-3 py-3 text-left transition-colors ${
                    idx === activeSection
                      ? "bg-emserh-green text-white"
                      : complete
                        ? "bg-emserh-green-light text-emserh-green-dark hover:bg-emserh-green-light/80"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug">{sec.title}</span>
                    {complete && idx !== activeSection && (
                      <span className="shrink-0 text-xs font-bold">✓</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className={`h-1.5 flex-1 overflow-hidden rounded-full ${
                        idx === activeSection ? "bg-white/30" : "bg-slate-200"
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          idx === activeSection ? "bg-white" : "bg-emserh-green"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={`shrink-0 text-xs ${
                        idx === activeSection ? "text-white/90" : "text-slate-500"
                      }`}
                    >
                      {prog.answered}/{prog.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{current.title}</h2>
            <div className="text-sm text-slate-500">
              Seção {activeSection + 1} de {sections.length}
            </div>
          </div>

          <div className="space-y-4">
            {current.items.map((item) => {
              const a = answers[item.id];
              return (
                <Card key={item.id} className="p-4">
                  <p className="mb-3 text-base font-medium text-slate-800">
                    <span className="mr-2 font-mono text-sm text-slate-400">{item.item_code}</span>
                    {item.question}
                  </p>
                  <div className="mb-3 flex flex-wrap gap-3">
                    {(["C", "NC", "NA"] as const).map((s) => {
                      const styles = STATUS_STYLES[s];
                      const selected = a?.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={readOnly}
                          onClick={() => updateAnswer(item.id, { status: s })}
                          className={`flex min-h-12 min-w-[5.5rem] flex-col items-center justify-center rounded-xl border-2 px-5 py-2 text-base font-semibold transition-colors ${
                            selected ? styles.active : styles.idle
                          }`}
                        >
                          <span>{s}</span>
                          <span className="text-xs font-normal opacity-80">{styles.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {a?.status === "NC" && (
                    <div className="grid gap-3 rounded-lg border border-red-100 bg-red-50/50 p-4 sm:grid-cols-2">
                      <Textarea
                        label="Descrição *"
                        value={a.description}
                        disabled={readOnly}
                        onChange={(e) => updateAnswer(item.id, { description: e.target.value })}
                        rows={2}
                      />
                      <Input
                        label="Normativa"
                        value={a.normative}
                        disabled={readOnly}
                        onChange={(e) => updateAnswer(item.id, { normative: e.target.value })}
                      />
                      <div className="sm:col-span-2">
                        <Textarea
                          label="Recomendação *"
                          value={a.recommendation}
                          disabled={readOnly}
                          onChange={(e) => updateAnswer(item.id, { recommendation: e.target.value })}
                          rows={2}
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <NcPhotoCapture
                          inspectionId={serverId}
                          inspectionClientId={clientId}
                          checklistItemId={item.id}
                          answerId={a.answerId}
                          photos={a.photos}
                          localPreviews={localPreviewUrls[item.id] ?? []}
                          disabled={readOnly}
                          onLocalPhotoAdded={(itemId, preview) =>
                            setLocalPreviewUrls((prev) => ({
                              ...prev,
                              [itemId]: [...(prev[itemId] ?? []), preview],
                            }))
                          }
                          onLocalPhotoRemoved={(itemId, clientPhotoId) =>
                            setLocalPreviewUrls((prev) => {
                              const removed = (prev[itemId] ?? []).find(
                                (p) => p.clientPhotoId === clientPhotoId
                              );
                              if (removed) URL.revokeObjectURL(removed.url);
                              return {
                                ...prev,
                                [itemId]: (prev[itemId] ?? []).filter(
                                  (p) => p.clientPhotoId !== clientPhotoId
                                ),
                              };
                            })
                          }
                          onPhotosChange={(photos, answerId) => updatePhotos(item.id, photos, answerId)}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {(localScore || sectionScore) && (
            <div className="mt-4 rounded-xl border border-border bg-emserh-green-light/50 p-4 text-sm">
              <strong className="text-emserh-green-dark">Totais da seção:</strong>{" "}
              <span className="text-emserh-green">C={localScore?.c ?? sectionScore?.conforme}</span>
              {" · "}
              <span className="text-red-700">NC={localScore?.nc ?? sectionScore?.nao_conforme}</span>
              {" · "}
              <span className="text-slate-600">NA={localScore?.na ?? sectionScore?.nao_aplicavel}</span>
              {" · "}
              <strong>Nota:</strong>{" "}
              {localScore?.score != null
                ? `${(localScore.score * 100).toFixed(1)}%`
                : sectionScore?.score != null
                  ? `${(sectionScore.score * 100).toFixed(1)}%`
                  : "—"}
            </div>
          )}

          {message && (
            <p className={`mt-2 text-sm ${message.includes("sucesso") ? "text-emserh-green" : "text-red-600"}`}>
              {message}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {activeSection > 0 && (
              <Button type="button" variant="ghost" size="lg" onClick={() => changeSection(activeSection - 1)}>
                Anterior
              </Button>
            )}
            {activeSection < sections.length - 1 ? (
              <Button type="button" variant="secondary" size="lg" onClick={() => changeSection(activeSection + 1)}>
                Próxima seção
              </Button>
            ) : (
              !readOnly && (
                <Button
                type="button"
                variant="success"
                size="lg"
                onClick={async () => {
                  try {
                    await saveNow();
                    navigateApp(inspectionStepHref("revisao", rawId), router);
                  } catch {
                    setMessage("Conclua os campos NC antes de continuar.");
                  }
                }}
              >
                Ir para relatório
              </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
