"use client";

import { useParams, useRouter } from "next/navigation";
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
import { useLocalInspection } from "@/hooks/useLocalInspection";
import { api, Completeness, Unit, UnitInput } from "@/lib/api";
import {
  cacheReferenceData,
  getCachedReference,
  saveLocalUnitData,
} from "@/lib/db/repositories/inspectionRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";
import { emptyUnitInput, unitToInput } from "@/lib/unitForm";

export default function DadosPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const { local, clientId, inspection, loading: localLoading, readOnly } = useLocalInspection(rawId);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [unit, setUnit] = useState<UnitInput>(emptyUnitInput());
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [hasAddressPhoto, setHasAddressPhoto] = useState(false);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    async function load() {
      if (navigator.onLine) await cacheReferenceData();
      const list = (await getCachedReference<Unit[]>("units")) ?? [];
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
      if (local?.server_id && navigator.onLine) {
        try {
          const comp = await api.getCompleteness(local.server_id);
          setCompleteness(comp);
        } catch {
          /* offline */
        }
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
        Os dados são salvos no tablet e sincronizados automaticamente quando houver internet.
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
                inspectionId={serverId}
                inspectionClientId={clientId}
                hasAddressPhoto={hasAddressPhoto}
                onAddressPhotoChange={setHasAddressPhoto}
              />
            )}
          </Card>

          {message && <p className="text-sm text-red-600">{message}</p>}

          <Button
            type="button"
            size="lg"
            onClick={() => router.push(`/inspecoes/${rawId}/checklist`)}
          >
            Ir para checklist →
          </Button>
        </div>
      )}
    </div>
  );
}
