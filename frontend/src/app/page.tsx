"use client";

import AppLogo from "@/components/AppLogo";
import InspectionStepLink from "@/components/InspectionStepLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusBadge from "@/components/ui/StatusBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { api, Inspection, InspectionFilters, Unit } from "@/lib/api";
import {
  cacheReferenceData,
  listLocalInspections,
  localToInspectionDisplay,
} from "@/lib/db/repositories/inspectionRepo";
import { inspectionStepHref, warmAppShellRoutes } from "@/lib/inspectionRoutes";
import type { SyncStatus } from "@/lib/db";

type DashboardInspection = Inspection & {
  routeId: string;
  sync_status?: SyncStatus | "synced";
};

export default function DashboardPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<DashboardInspection[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [filters, setFilters] = useState<InspectionFilters>({ archived: "false" });
  const { toast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    if (navigator.onLine) {
      void cacheReferenceData();
      warmAppShellRoutes();
    }
    Promise.all([
      navigator.onLine ? api.getInspections(filters) : Promise.resolve([] as Inspection[]),
      navigator.onLine ? api.getUnits() : import("@/lib/db/repositories/inspectionRepo").then((m) => m.getCachedReference<Unit[]>("units").then((u) => u ?? [])),
      navigator.onLine ? api.me() : Promise.resolve({ is_staff: false, name: "" } as Awaited<ReturnType<typeof api.me>>),
      listLocalInspections(),
    ])
      .then(([serverList, unitList, me, localList]) => {
        const serverIds = new Set(serverList.map((i) => i.id));
        const localRows: DashboardInspection[] = localList
          .filter((l) => !l.server_id || !serverIds.has(l.server_id))
          .filter((l) => {
            if (filters.archived === "true" && !l.is_archived) return false;
            if (filters.archived === "false" && l.is_archived) return false;
            if (filters.status && l.status !== filters.status) return false;
            if (filters.search) {
              const q = filters.search.toLowerCase();
              if (!(l.unit_name ?? "").toLowerCase().includes(q)) return false;
            }
            if (filters.unit_id && l.unit_id !== filters.unit_id) return false;
            return true;
          })
          .map((l) => ({
            ...localToInspectionDisplay(l),
            routeId: l.client_id,
            sync_status: l.sync_status,
          }));
        const serverRows: DashboardInspection[] = serverList.map((i) => ({
          ...i,
          routeId: String(i.id),
          sync_status: "synced" as const,
        }));
        const merged = [...localRows, ...serverRows].sort(
          (a, b) =>
            new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
        );
        setInspections(merged);
        setUnits(unitList);
        setIsStaff(me.is_staff);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleArchive(id: number) {
    if (!confirm("Arquivar esta inspeção?")) return;
    try {
      await api.archiveInspection(id);
      toast("Inspeção arquivada", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao arquivar", "error");
    }
  }

  async function handleClone(id: number) {
    try {
      const clone = await api.cloneInspection(id);
      toast("Nova inspeção criada a partir da anterior", "success");
      router.push(`/inspecoes/${clone.id}/dados`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao clonar", "error");
    }
  }

  const total = inspections.length;
  const emAndamento = inspections.filter((i) => i.status === "rascunho").length;
  const finalizadas = inspections.filter((i) => i.status === "finalizado").length;
  const scores = inspections.map((i) => i.overall_score).filter((s): s is number => s != null);
  const mediaNota =
    scores.length > 0
      ? `${((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(1)}%`
      : "—";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inspeções</h1>
          <p className="text-sm text-slate-500">Diagnóstico de Saúde, Segurança e Meio Ambiente</p>
        </div>
        <Link href="/inspecoes/nova">
          <Button>Nova inspeção</Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Buscar unidade"
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Nome da unidade"
        />
        <Select
          label="Status"
          value={filters.status ?? ""}
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          <option value="rascunho">Em andamento</option>
          <option value="finalizado">Finalizado</option>
        </Select>
        <Select
          label="Unidade"
          value={filters.unit_id ?? ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              unit_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Todas</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Filtros</label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filters.mine === true}
              onChange={(e) => setFilters({ ...filters, mine: e.target.checked || undefined })}
            />
            Minhas inspeções
          </label>
          {isStaff && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={filters.archived === "true"}
                onChange={(e) =>
                  setFilters({ ...filters, archived: e.target.checked ? "true" : "false" })
                }
              />
              Mostrar arquivadas
            </label>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: String(total) },
          { label: "Em andamento", value: String(emAndamento) },
          { label: "Finalizadas", value: String(finalizadas) },
          { label: "Média de nota", value: mediaNota },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-emserh-green">{card.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : inspections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <AppLogo variant="empty" />
          <p className="text-slate-600">Nenhuma inspeção encontrada.</p>
          <Link href="/inspecoes/nova" className="mt-4 inline-block">
            <Button size="sm">Criar inspeção</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-emserh-green-light/60 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Unidade</th>
                  <th className="px-4 py-3 font-semibold">Regional</th>
                  <th className="px-4 py-3 font-semibold">Vistoria</th>
                  <th className="px-4 py-3 font-semibold">Inspetor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Nota</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {inspections.map((insp) => (
                  <tr key={insp.routeId} className="border-t border-border/80 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {insp.unit?.name}
                      {insp.sync_status && insp.sync_status !== "synced" && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          {insp.sync_status === "local" ? "local" : "pendente"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{insp.unit?.regional}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(insp.inspection_date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{insp.created_by_name || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={insp.is_archived ? "arquivado" : insp.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-emserh-green">
                      {insp.overall_score != null ? `${(insp.overall_score * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <InspectionStepLink
                          href={inspectionStepHref("dados", insp.routeId)}
                          className="font-medium text-emserh-green hover:underline"
                        >
                          Abrir
                        </InspectionStepLink>
                        {!insp.is_archived && insp.id > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleClone(insp.id)}
                              className="text-slate-500 hover:text-emserh-green"
                            >
                              Clonar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(insp.id)}
                              className="text-slate-500 hover:text-red-600"
                            >
                              Arquivar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {inspections.map((insp) => (
              <div key={insp.routeId} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <InspectionStepLink
                    href={inspectionStepHref("dados", insp.routeId)}
                    className="font-semibold text-slate-800"
                  >
                    {insp.unit?.name}
                  </InspectionStepLink>
                  <StatusBadge status={insp.is_archived ? "arquivado" : insp.status} />
                </div>
                <p className="text-sm text-slate-500">
                  {insp.unit?.regional} · {new Date(insp.inspection_date).toLocaleDateString("pt-BR")}
                </p>
                <p className="mt-2 text-sm font-medium text-emserh-green">
                  Nota: {insp.overall_score != null ? `${(insp.overall_score * 100).toFixed(1)}%` : "—"}
                </p>
                {!insp.is_archived && insp.id > 0 && (
                  <div className="mt-3 flex gap-3 text-sm">
                    <button type="button" onClick={() => handleClone(insp.id)} className="text-emserh-green">
                      Clonar
                    </button>
                    <button type="button" onClick={() => handleArchive(insp.id)} className="text-red-600">
                      Arquivar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
