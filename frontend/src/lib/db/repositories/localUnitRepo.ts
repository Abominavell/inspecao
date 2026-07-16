import type { Unit } from "@/lib/api";
import { db, LocalUnit } from "@/lib/db";
import { getCachedReference } from "@/lib/db/repositories/inspectionRepo";

let nextLocalUnitId = -1;

async function refreshNextLocalId(): Promise<void> {
  const all = await db.local_units.toArray();
  const minId = all.reduce((m, u) => (u.id < m ? u.id : m), 0);
  if (minId < nextLocalUnitId) nextLocalUnitId = minId - 1;
}

export async function createLocalUnit(
  data: Omit<LocalUnit, "id" | "source" | "created_at">
): Promise<LocalUnit> {
  await refreshNextLocalId();
  const unit: LocalUnit = {
    ...data,
    id: nextLocalUnitId--,
    source: "local",
    created_at: new Date().toISOString(),
  };
  await db.local_units.put(unit);
  const cached = (await getCachedReference<Unit[]>("units")) ?? [];
  await db.reference_cache.put({
    key: "units",
    data: [...cached, unit as unknown as Unit],
    cached_at: new Date().toISOString(),
  });
  return unit;
}

export async function listAllUnits(): Promise<Unit[]> {
  const cached = (await getCachedReference<Unit[]>("units")) ?? [];
  const local = await db.local_units.toArray();
  const localAsUnit: Unit[] = local.map((u) => ({
    id: u.id,
    name: u.name,
    regional: u.regional,
    city: u.city,
    address: u.address,
    unit_type: u.unit_type,
    employee_count: u.employee_count,
    admin_coordinator: u.admin_coordinator,
    general_director: u.general_director,
    characterization: u.characterization,
    created_at: u.created_at,
  }));
  const ids = new Set(cached.map((u) => u.id));
  return [...cached, ...localAsUnit.filter((u) => !ids.has(u.id))];
}
