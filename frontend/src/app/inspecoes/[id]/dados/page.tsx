"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AutoSaveIndicator from "@/components/AutoSaveIndicator";
import InspectionNav from "@/components/InspectionNav";
import PendingItemsPanel from "@/components/PendingItemsPanel";
import ReadOnlyBanner from "@/components/ReadOnlyBanner";
import UnitFieldsForm from "@/components/UnitFieldsForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useInspectionRouteId } from "@/hooks/useInspectionRouteId";
import { useLocalCompleteness } from "@/hooks/useLocalCompleteness";
import { useLocalInspection } from "@/hooks/useLocalInspection";
import { inspectionStepHref, navigateApp } from "@/lib/inspectionRoutes";
import { api, Unit, UnitInput } from "@/lib/api";
import type { LocalInspection } from "@/lib/db";
import { ensureReferenceData } from "@/lib/bundledData";
import {
  cacheReferenceData,
  getCachedReference,
  saveLocalUnitData,
} from "@/lib/db/repositories/inspectionRepo";
import { listAllUnits } from "@/lib/db/repositories/localUnitRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";
import { emptyUnitInput, unitToInput } from "@/lib/unitForm";
import { isFieldApp } from "@/lib/runtime";

export default function DadosPage() {
  const router = useRouter();
  const rawId = useInspectionRouteId();
  const { local, clientId, inspection, loading: localLoading, readOnly } = useLocalInspection(rawId);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [unit, setUnit] = useState<UnitInput>(emptyUnitInput());
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [hasAddressPhoto, setHasAddressPhoto] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    async function load() {
      if (isFieldApp()) await ensureReferenceData();
      else if (navigator.onLine) await cacheReferenceData();
      const list = isFieldApp()
        ? await listAllUnits()
        : (await getCachedReference<Unit[]>("units")) ?? [];
      const defaults = (await getCachedReference<{ regional: string; cidade: string }>("ssma")) ?? {
        regional: "",
        cidade: "",
      };
      if (!active) return;
      setUnits(list);
      if (local) {
        setSelectedUnitId(local.unit_id ?? null);
        if (local.unit_data) {
          setUnit(local.unit_data as unknown as UnitInput);
        } else if (local.unit_id) {
          const linked = list.find((u) => u.id === local.unit_id);
          if (linked) setUnit(unitToInput(linked, defaults));
        }
        setHasAddressPhoto(Boolean(local.has_address_photo));
      }
      if (navigator.onLine) {
        try {
          const me = await api.me();
          setIsStaff(me.is_staff);
        } catch {
          /* ignore */
        }
      }
      setReady(true);
    }
    if (!localLoading) load();
    return () => {
      active = false;
    };
  }, [local, localLoading]);

  const savePayloadKey = useMemo(
    () => JSON.stringify({ selectedUnitId, unit, clientId }),
    [selectedUnitId, unit, clientId]
  );

  const persistUnit = useCallback(async () => {
    if (!clientId || selectedUnitId == null) return;
    await saveLocalUnitData(clientId, selectedUnitId, unit);
    if (navigator.onLine) await syncEngine.syncNow();
  }, [clientId, selectedUnitId, unit]);

  const localForCompleteness = useMemo((): LocalInspection | null => {
    if (!local) return null;
    return {
      ...local,
      unit_data: unit as unknown as Record<string, unknown>,
      unit_name: unit.name,
      unit_regional: unit.regional,
      unit_city: unit.city,
      has_address_photo: hasAddressPhoto || local.has_address_photo,
    };
  }, [local, unit, hasAddressPhoto]);

  const completeness = useLocalCompleteness(clientId, localForCompleteness, savePayloadKey, {
    enabled: ready && !!localForCompleteness,
  });

  const { status: saveStatus, error: saveError } = useAutoSave(savePayloadKey, persistUnit, {
    ready: ready && selectedUnitId != null && !!clientId && !readOnly,
    label: "Dados da unidade",
    onSaved: () => toast("Dados salvos", "success"),
    onError: (msg) => toast(msg, "error"),
  });

  function handleUnitSelect(unitId: number) {
    const selected = units.find((u) => u.id === unitId);
    if (selected) {
      setSelectedUnitId(selected.id);
      setUnit(unitToInput(selected));
    }
  }

  function handleUnitChange(next: UnitInput) {
    setUnit(next);
  }

  const serverId = local?.server_id ?? 0;

  return (
    <div>
      <InspectionNav title={inspection?.unit?.name || unit.name || "Nova inspeção"} />

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
              router.refresh();
            }
          }}
        />
      )}

      <PendingItemsPanel completeness={completeness} />

      <p className="mb-4 text-sm text-slate-600">
        {isFieldApp()
          ? "Os dados são salvos neste tablet."
          : "Os dados são salvos no tablet e sincronizados automaticamente quando houver internet."}
      </p>

      <AutoSaveIndicator status={saveStatus} error={saveError} />

      {localLoading || !ready ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card title="Dados da unidade">
            <Select
              label="Unidade cadastrada *"
              value={selectedUnitId ?? ""}
              onChange={(e) => handleUnitSelect(Number(e.target.value))}
              required
              className="mb-4"
              disabled={readOnly}
            >
              {selectedUnitId == null && (
                <option value="" disabled>
                  Selecione uma unidade...
                </option>
              )}
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.city}
                </option>
              ))}
            </Select>

            {selectedUnitId != null && (
              <UnitFieldsForm
                unit={unit}
                onChange={handleUnitChange}
                disabled={readOnly || saveStatus === "saving"}
                inspectionId={local?.server_id ?? serverId}
                inspectionClientId={clientId}
                serverId={local?.server_id}
                hasAddressPhoto={hasAddressPhoto}
                onAddressPhotoChange={setHasAddressPhoto}
              />
            )}
          </Card>

          {message && <p className="text-sm text-red-600">{message}</p>}

          <Button
            type="button"
            size="lg"
            onClick={() => navigateApp(inspectionStepHref("checklist", rawId), router)}
          >
            Ir para checklist →
          </Button>
        </div>
      )}
    </div>
  );
}
