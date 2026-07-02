"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import InspectionStepLink from "@/components/InspectionStepLink";
import { useInspectionRouteId } from "@/hooks/useInspectionRouteId";
import { api, Completeness } from "@/lib/api";
import { isClientInspectionId, inspectionStepHref } from "@/lib/inspectionRoutes";

const steps = [
  { suffix: "dados" as const, label: "Dados", key: "unit" as const },
  { suffix: "checklist" as const, label: "Checklist", key: "checklist" as const },
  { suffix: "revisao" as const, label: "Relatório", key: "report" as const },
];

function stepDone(step: (typeof steps)[number], comp: Completeness | null): boolean {
  if (!comp) return false;
  if (step.key === "unit") return comp.unit_complete;
  if (step.key === "checklist") return comp.checklist_complete;
  return comp.cover_complete && comp.texts_complete;
}

export default function InspectionNav({ title }: { title?: string }) {
  const pathname = usePathname();
  const id = useInspectionRouteId();
  const [completeness, setCompleteness] = useState<Completeness | null>(null);

  useEffect(() => {
    if (!id || isClientInspectionId(id)) return;
    api.getCompleteness(Number(id)).then(setCompleteness).catch(() => setCompleteness(null));
  }, [id, pathname]);

  return (
    <div className="mb-6">
      {title && <h1 className="mb-4 text-2xl font-bold text-slate-800">{title}</h1>}

      <nav aria-label="Etapas da inspeção" className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {steps.map((step, index) => {
          const href = inspectionStepHref(step.suffix, id);
          const active = pathname.includes(step.suffix);
          const done = stepDone(step, completeness);

          return (
            <InspectionStepLink
              key={step.suffix}
              href={href}
              className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                active
                  ? "border-emserh-green bg-emserh-green text-white shadow-sm"
                  : done
                    ? "border-emserh-green/40 bg-emserh-green-light text-emserh-green-dark"
                    : "border-border bg-card text-slate-600 hover:border-emserh-green/30"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active
                    ? "bg-white/20 text-white"
                    : done
                      ? "bg-emserh-green text-white"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {done && !active ? "✓" : index + 1}
              </span>
              <span className="text-sm font-semibold sm:text-base">{step.label}</span>
            </InspectionStepLink>
          );
        })}
      </nav>

      {completeness && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emserh-green transition-all"
            style={{
              width: `${Math.round(
                ((completeness.unit_complete ? 1 : 0) +
                  (completeness.checklist_complete ? 1 : 0) +
                  (completeness.cover_complete && completeness.texts_complete ? 1 : 0)) *
                  (100 / 3)
              )}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
