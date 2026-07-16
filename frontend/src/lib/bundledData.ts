import type { ChecklistSection, SsmaConfig, Unit } from "@/lib/api";
import { db } from "@/lib/db";
import { isFieldApp } from "@/lib/runtime";

type BundledChecklistFile = {
  sections: Array<{
    order: number;
    title: string;
    items: Array<{ order: number; item_code: string; question: string }>;
  }>;
};

function transformChecklist(raw: BundledChecklistFile): ChecklistSection[] {
  return raw.sections.map((sec) => ({
    id: sec.order,
    order: sec.order,
    title: sec.title,
    items: sec.items.map((item) => ({
      id: sec.order * 1000 + item.order,
      order: item.order,
      item_code: item.item_code,
      question: item.question,
    })),
  }));
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  return res.json() as Promise<T>;
}

/** Carrega checklist, SSMA e unidades embutidos no APK (public/data). */
export async function loadBundledReferenceData(): Promise<void> {
  const [checklistRaw, ssma, units] = await Promise.all([
    fetchJson<BundledChecklistFile>("/data/checklist.json"),
    fetchJson<SsmaConfig>("/data/ssma.json"),
    fetchJson<Unit[]>("/data/units.json"),
  ]);
  const now = new Date().toISOString();
  const checklist = transformChecklist(checklistRaw);
  await db.reference_cache.bulkPut([
    { key: "checklist", data: checklist, cached_at: now },
    { key: "ssma", data: ssma, cached_at: now },
    { key: "units", data: units, cached_at: now },
  ]);
}

/** Garante referência no cache; no app de campo usa dados embutidos. */
export async function ensureReferenceData(): Promise<void> {
  const checklist = await db.reference_cache.get("checklist");
  if (checklist?.data) return;
  if (isFieldApp()) {
    await loadBundledReferenceData();
    return;
  }
  const { cacheReferenceData } = await import("@/lib/db/repositories/inspectionRepo");
  if (typeof navigator !== "undefined" && navigator.onLine) {
    await cacheReferenceData();
  }
}
