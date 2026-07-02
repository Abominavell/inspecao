import { UnitInput } from "@/lib/api";

type UnitDraft = {
  selectedUnitId: number;
  unit: UnitInput;
};

function draftKey(inspectionId: number) {
  return `inspecao-${inspectionId}-unit-draft`;
}

export function loadUnitDraft(inspectionId: number): UnitDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftKey(inspectionId));
    if (!raw) return null;
    return JSON.parse(raw) as UnitDraft;
  } catch {
    return null;
  }
}

export function saveUnitDraft(inspectionId: number, draft: UnitDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(draftKey(inspectionId), JSON.stringify(draft));
}

export function clearUnitDraft(inspectionId: number) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(inspectionId));
}
