import { api, Inspection, Unit, UnitInput } from "@/lib/api";
import { db, LocalInspection, newClientId, SyncMutation } from "@/lib/db";
import { isFieldApp } from "@/lib/runtime";
import { unitToInput } from "@/lib/unitForm";

function isUnitInputComplete(unit: Partial<UnitInput>): boolean {
  const fields: (keyof UnitInput)[] = [
    "name",
    "regional",
    "city",
    "address",
    "unit_type",
    "admin_coordinator",
    "general_director",
    "characterization",
  ];
  return fields.every((key) => String(unit[key] ?? "").trim()) && (unit.employee_count ?? 0) > 0;
}

/** Busca unidade completa no cache local ou na API (para validação após sync). */
export async function resolveFullUnit(unitId: number): Promise<UnitInput | null> {
  const cached = (await getCachedReference<Unit[]>("units")) ?? [];
  const fromCache = cached.find((u) => u.id === unitId);
  if (fromCache && isUnitInputComplete(fromCache)) return unitToInput(fromCache);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const units = await api.getUnits();
      const now = new Date().toISOString();
      await db.reference_cache.put({ key: "units", data: units, cached_at: now });
      const fromApi = units.find((u) => u.id === unitId);
      if (fromApi) return unitToInput(fromApi);
    } catch {
      /* offline */
    }
  }

  return fromCache ? unitToInput(fromCache) : null;
}

export async function listLocalInspections(): Promise<LocalInspection[]> {
  return db.inspections.orderBy("updated_at").reverse().toArray();
}

export async function getLocalInspection(clientId: string): Promise<LocalInspection | undefined> {
  return db.inspections.get(clientId);
}

export async function getLocalInspectionByServerId(
  serverId: number
): Promise<LocalInspection | undefined> {
  return db.inspections.where("server_id").equals(serverId).first();
}

export async function resolveInspectionClientId(idOrClientId: string | number): Promise<string> {
  if (typeof idOrClientId === "string" && idOrClientId.includes("-")) {
    const found = await db.inspections.get(idOrClientId);
    if (found) return idOrClientId;
  }
  const num = Number(idOrClientId);
  if (!Number.isNaN(num)) {
    const byServer = await getLocalInspectionByServerId(num);
    if (byServer) return byServer.client_id;
    return String(num);
  }
  return String(idOrClientId);
}

export async function saveLocalInspection(
  data: Partial<LocalInspection> & { client_id: string }
): Promise<LocalInspection> {
  const existing = await db.inspections.get(data.client_id);
  const now = new Date().toISOString();
  const record: LocalInspection = {
    inspection_date: data.inspection_date ?? existing?.inspection_date ?? new Date().toISOString().slice(0, 10),
    report_date: data.report_date ?? existing?.report_date ?? new Date().toISOString().slice(0, 10),
    status: data.status ?? existing?.status ?? "rascunho",
    methodology_text: data.methodology_text ?? existing?.methodology_text ?? "",
    objectives_text: data.objectives_text ?? existing?.objectives_text ?? "",
    limitations_text: data.limitations_text ?? existing?.limitations_text ?? "",
    final_considerations_text: data.final_considerations_text ?? existing?.final_considerations_text ?? "",
    general_info_text: data.general_info_text ?? existing?.general_info_text ?? "",
    cover_diretor_executivo: data.cover_diretor_executivo ?? existing?.cover_diretor_executivo ?? "",
    cover_gerente_geral: data.cover_gerente_geral ?? existing?.cover_gerente_geral ?? "",
    cover_gerente_sst: data.cover_gerente_sst ?? existing?.cover_gerente_sst ?? "",
    cover_gerente_meio_ambiente:
      data.cover_gerente_meio_ambiente ?? existing?.cover_gerente_meio_ambiente ?? "",
    sync_status: data.sync_status ?? (existing?.sync_status === "synced" ? "pending" : existing?.sync_status ?? "local"),
    updated_at: now,
    created_at: existing?.created_at ?? now,
    ...existing,
    ...data,
  };
  await db.inspections.put(record);
  return record;
}

export async function createLocalInspection(input: {
  unit_id: number;
  unit?: Unit;
  inspection_date: string;
  report_date: string;
}): Promise<LocalInspection> {
  const client_id = newClientId();
  const now = new Date().toISOString();
  const record: LocalInspection = {
    client_id,
    unit_id: input.unit_id,
    unit_name: input.unit?.name,
    unit_regional: input.unit?.regional,
    unit_city: input.unit?.city,
    unit_data: input.unit as unknown as Record<string, unknown>,
    inspection_date: input.inspection_date,
    report_date: input.report_date,
    status: "rascunho",
    methodology_text: "",
    objectives_text: "",
    limitations_text: "",
    final_considerations_text: "",
    general_info_text: "",
    cover_diretor_executivo: "",
    cover_gerente_geral: "",
    cover_gerente_sst: "",
    cover_gerente_meio_ambiente: "",
    sync_status: "local",
    updated_at: now,
    created_at: now,
  };
  await db.inspections.put(record);
  if (!isFieldApp()) {
    await enqueueMutation("inspection.create", {
      client_id,
      unit_id: input.unit_id,
      inspection_date: input.inspection_date,
      report_date: input.report_date,
    });
  }
  return record;
}

export async function upsertLocalFromServer(insp: Inspection): Promise<LocalInspection> {
  const existing = await getLocalInspectionByServerId(insp.id);
  const client_id = existing?.client_id ?? newClientId();
  const unitId = insp.unit_id ?? insp.unit?.id;
  const existingUnit = (existing?.unit_data ?? {}) as Partial<UnitInput>;
  let unitData: Record<string, unknown> | undefined = existing?.unit_data;

  if (!isUnitInputComplete(existingUnit) && unitId) {
    const full = await resolveFullUnit(unitId);
    if (full) unitData = full as unknown as Record<string, unknown>;
  }

  const now = new Date().toISOString();
  const record: LocalInspection = {
    client_id,
    server_id: insp.id,
    unit_id: unitId,
    unit_name: insp.unit?.name ?? existing?.unit_name,
    unit_regional: insp.unit?.regional ?? existing?.unit_regional,
    unit_city: insp.unit?.city ?? existing?.unit_city,
    unit_data: unitData,
    inspection_date: insp.inspection_date,
    report_date: insp.report_date,
    status: insp.status,
    is_archived: insp.is_archived,
    methodology_text: insp.methodology_text,
    objectives_text: insp.objectives_text,
    limitations_text: insp.limitations_text,
    final_considerations_text: insp.final_considerations_text,
    general_info_text: insp.general_info_text,
    cover_diretor_executivo: insp.cover_diretor_executivo,
    cover_gerente_geral: insp.cover_gerente_geral,
    cover_gerente_sst: insp.cover_gerente_sst,
    cover_gerente_meio_ambiente: insp.cover_gerente_meio_ambiente,
    cover_diretoria_executiva: insp.cover_diretoria_executiva,
    cover_gerencia_geral: insp.cover_gerencia_geral,
    cover_gerencia_sst: insp.cover_gerencia_sst,
    cover_gerencia_meio_ambiente: insp.cover_gerencia_meio_ambiente,
    has_address_photo: insp.has_address_photo,
    sync_status: "synced",
    updated_at: now,
    created_at: existing?.created_at ?? now,
  };
  await db.inspections.put(record);
  return record;
}

export async function saveLocalUnitData(
  clientId: string,
  unitId: number,
  unit: UnitInput
): Promise<void> {
  await saveLocalInspection({
    client_id: clientId,
    unit_id: unitId,
    unit_data: unit as unknown as Record<string, unknown>,
    unit_name: unit.name,
    unit_regional: unit.regional,
    unit_city: unit.city,
    sync_status: "pending",
  });
  await enqueueMutation("unit.update", { client_id: clientId, unit_id: unitId, unit });
}

export async function clearPendingMutationsForInspection(
  clientId: string,
  types?: string[]
): Promise<void> {
  const pending = await db.sync_mutations.where("status").equals("pending").toArray();
  const now = new Date().toISOString();
  for (const mut of pending) {
    if (mut.payload.client_id !== clientId && mut.payload.inspection_client_id !== clientId) {
      continue;
    }
    if (types && !types.includes(mut.type)) continue;
    await db.sync_mutations.update(mut.mutation_id, {
      status: "applied",
      applied_at: now,
    });
  }
}

export async function saveLocalReport(
  clientId: string,
  data: {
    cover_diretor_executivo: string;
    cover_gerente_geral: string;
    cover_gerente_sst: string;
    cover_gerente_meio_ambiente: string;
    general_info_text: string;
    methodology_text: string;
    objectives_text: string;
    limitations_text: string;
    final_considerations_text: string;
  },
  serverId?: number
): Promise<void> {
  await saveLocalInspection({
    client_id: clientId,
    ...data,
    sync_status: serverId ? "synced" : "pending",
  });

  if (serverId && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await api.updateInspection(serverId, data);
      await clearPendingMutationsForInspection(clientId, ["inspection.update"]);
      await saveLocalInspection({
        client_id: clientId,
        ...data,
        sync_status: "synced",
      });
      return;
    } catch {
      /* enfileira para retry offline */
    }
  }

  await enqueueMutation("inspection.update", { client_id: clientId, ...data });
  await saveLocalInspection({
    client_id: clientId,
    ...data,
    sync_status: "pending",
  });
}

export async function enqueueMutation(
  type: string,
  payload: Record<string, unknown>
): Promise<SyncMutation | null> {
  if (isFieldApp()) return null;
  const mutation: SyncMutation = {
    mutation_id: newClientId(),
    type,
    payload,
    status: "pending",
    retries: 0,
    created_at: new Date().toISOString(),
  };
  await db.sync_mutations.put(mutation);
  return mutation;
}

export async function getPendingMutationCount(): Promise<number> {
  return db.sync_mutations.where("status").equals("pending").count();
}

export function localToInspectionDisplay(local: LocalInspection): Inspection {
  return {
    id: local.server_id ?? 0,
    unit_id: local.unit_id ?? 0,
    inspection_date: local.inspection_date,
    report_date: local.report_date,
    status: local.status,
    is_archived: local.is_archived,
    methodology_text: local.methodology_text,
    objectives_text: local.objectives_text,
    limitations_text: local.limitations_text,
    final_considerations_text: local.final_considerations_text,
    general_info_text: local.general_info_text,
    cover_diretoria_executiva: local.cover_diretoria_executiva ?? "",
    cover_diretor_executivo: local.cover_diretor_executivo,
    cover_gerencia_geral: local.cover_gerencia_geral ?? "",
    cover_gerente_geral: local.cover_gerente_geral,
    cover_gerencia_sst: local.cover_gerencia_sst ?? "",
    cover_gerente_sst: local.cover_gerente_sst,
    cover_gerencia_meio_ambiente: local.cover_gerencia_meio_ambiente ?? "",
    cover_gerente_meio_ambiente: local.cover_gerente_meio_ambiente,
    overall_score: null,
    has_address_photo: local.has_address_photo,
    unit: local.unit_name
      ? { id: local.unit_id ?? 0, name: local.unit_name, regional: local.unit_regional ?? "", city: local.unit_city ?? "" }
      : undefined,
  };
}

export async function cacheReferenceData(): Promise<void> {
  if (!navigator.onLine) return;
  const now = new Date().toISOString();
  const [units, checklist, ssma] = await Promise.all([
    api.getUnits(),
    api.getChecklist(),
    api.getSsmaConfig(),
  ]);
  await db.reference_cache.bulkPut([
    { key: "units", data: units, cached_at: now },
    { key: "checklist", data: checklist, cached_at: now },
    { key: "ssma", data: ssma, cached_at: now },
  ]);
}

export async function getCachedReference<T>(key: string): Promise<T | null> {
  const row = await db.reference_cache.get(key);
  return (row?.data as T) ?? null;
}
