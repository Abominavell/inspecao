"use client";

import { Completeness } from "@/lib/api";

type Props = {
  completeness: Completeness | null;
  /** Na tela de checklist, mostrar só pendências do checklist. */
  scope?: "all" | "checklist";
};

function isChecklistPending(item: string): boolean {
  return (
    item.startsWith("Responder item") ||
    item.includes("item NC") ||
    item.startsWith("Checklist:")
  );
}

export default function PendingItemsPanel({ completeness, scope = "all" }: Props) {
  if (!completeness || completeness.ready_for_report) return null;

  const allItems = completeness.pending_items ?? [];
  const items =
    scope === "checklist" ? allItems.filter(isChecklistPending) : allItems;

  if (items.length === 0 && scope === "checklist" && completeness.checklist_complete) {
    return null;
  }

  if (items.length === 0 && scope === "all") return null;

  const pendingCount =
    scope === "checklist"
      ? items.length
      : completeness.pending_count;

  const pct =
    completeness.checklist_total > 0
      ? Math.round((completeness.checklist_answered / completeness.checklist_total) * 100)
      : 0;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">
          Pendências{scope === "checklist" ? " do checklist" : ""} ({pendingCount})
        </p>
        <p className="text-xs text-amber-800">
          Checklist: {completeness.checklist_answered}/{completeness.checklist_total} ({pct}%)
          {completeness.nc_without_photo > 0 && ` · ${completeness.nc_without_photo} NC sem foto`}
        </p>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-amber-200">
        <div className="h-full rounded-full bg-emserh-green transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-amber-900">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
        {scope === "all" && completeness.pending_count > items.length && (
          <li className="text-amber-700">… e mais {completeness.pending_count - items.length}</li>
        )}
      </ul>
    </div>
  );
}
