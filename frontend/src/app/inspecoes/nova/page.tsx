"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import UnitFieldsForm from "@/components/UnitFieldsForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ToastProvider";
import { api, Unit } from "@/lib/api";
import { ensureReferenceData } from "@/lib/bundledData";
import { createLocalInspection, saveLocalUnitData, getCachedReference } from "@/lib/db/repositories/inspectionRepo";
import { createLocalUnit, listAllUnits } from "@/lib/db/repositories/localUnitRepo";
import { getValidLocalSession } from "@/lib/localAuth";
import {
  inspectionStepHref,
  navigateApp,
  setActiveInspectionClientId,
  warmAppShellRoutes,
} from "@/lib/inspectionRoutes";
import { isFieldApp } from "@/lib/runtime";
import { syncEngine } from "@/lib/sync/SyncEngine";
import { emptyUnitInput, unitToInput } from "@/lib/unitForm";

export default function NovaInspecaoPage() {
  const router = useRouter();
  const fieldApp = isFieldApp();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [unit, setUnit] = useState(emptyUnitInput());
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState<{ regional: string; cidade: string } | null>(null);
  const [createNewUnit, setCreateNewUnit] = useState(false);

  useEffect(() => {
    if (!fieldApp && navigator.onLine) warmAppShellRoutes();
  }, [fieldApp]);

  useEffect(() => {
    async function load() {
      if (fieldApp) await ensureReferenceData();
      else if (navigator.onLine) {
        const { cacheReferenceData } = await import("@/lib/db/repositories/inspectionRepo");
        await cacheReferenceData();
      }
      const list = fieldApp ? await listAllUnits() : (await getCachedReference<Unit[]>("units")) ?? [];
      const ssma = (await getCachedReference<{ regional: string; cidade: string }>("ssma")) ?? {
        regional: "",
        cidade: "",
      };
      setUnits(list);
      setDefaults({ regional: ssma.regional, cidade: ssma.cidade });
      setUnit(emptyUnitInput(ssma));
    }
    load();
  }, [fieldApp]);

  function handleUnitSelect(id: string) {
    setUnitId(id);
    setCreateNewUnit(false);
    if (!id) {
      setUnit(emptyUnitInput(defaults ?? undefined));
      return;
    }
    const selected = units.find((u) => String(u.id) === id);
    if (selected) setUnit(unitToInput(selected));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let selectedId = unitId ? Number(unitId) : 0;
      let selected = units.find((u) => String(u.id) === unitId);

      if (fieldApp && (createNewUnit || !unitId)) {
        const created = await createLocalUnit({
          name: unit.name,
          regional: unit.regional,
          city: unit.city,
          address: unit.address,
          unit_type: unit.unit_type,
          employee_count: unit.employee_count,
          admin_coordinator: unit.admin_coordinator,
          general_director: unit.general_director,
          characterization: unit.characterization,
        });
        selectedId = created.id;
        selected = created as unknown as Unit;
        setUnits(await listAllUnits());
      }

      if (!selectedId) {
        toast("Selecione ou cadastre uma unidade", "error");
        return;
      }

      const session = fieldApp ? await getValidLocalSession() : null;
      const local = await createLocalInspection({
        unit_id: selectedId,
        unit: selected,
        inspection_date: inspectionDate,
        report_date: reportDate,
      });
      if (session) {
        const { saveLocalInspection } = await import("@/lib/db/repositories/inspectionRepo");
        await saveLocalInspection({ client_id: local.client_id, local_user_id: session.user_id });
      }
      await saveLocalUnitData(local.client_id, selectedId, unit);
      if (!fieldApp && navigator.onLine) {
        try {
          await api.updateUnit(selectedId, unit);
          await syncEngine.syncNow();
        } catch {
          toast("Inspeção salva localmente; sincronize quando possível", "info");
        }
      } else {
        toast(fieldApp ? "Inspeção criada no tablet" : "Inspeção criada offline", "success");
      }
      setActiveInspectionClientId(local.client_id);
      navigateApp(inspectionStepHref("dados", local.client_id), router);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar inspeção", "error");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = fieldApp
    ? createNewUnit
      ? Boolean(unit.name?.trim())
      : Boolean(unitId)
    : Boolean(unitId);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Nova inspeção</h1>
      <p className="mb-6 text-sm text-slate-600">
        {fieldApp
          ? "A inspeção é salva apenas neste tablet."
          : "A inspeção é salva no tablet e sincronizada com o servidor quando houver internet."}
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Unidade">
          {units.length === 0 && !fieldApp && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Nenhuma unidade encontrada. Cadastre unidades ou atualize a página.
            </p>
          )}
          {fieldApp && (
            <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createNewUnit}
                onChange={(e) => {
                  setCreateNewUnit(e.target.checked);
                  if (e.target.checked) setUnitId("");
                }}
                className="h-4 w-4 rounded border-border text-emserh-green"
              />
              Cadastrar nova unidade neste tablet
            </label>
          )}
          {!createNewUnit && (
            <Select
              label="Unidade *"
              value={unitId}
              onChange={(e) => handleUnitSelect(e.target.value)}
              required={!fieldApp}
              className="mb-4"
            >
              <option value="">Selecione uma unidade...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.city}
                </option>
              ))}
            </Select>
          )}
          {(unitId || createNewUnit) && defaults !== null && (
            <UnitFieldsForm unit={unit} onChange={setUnit} disabled={loading} />
          )}
        </Card>
        <Card title="Datas">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Data da vistoria *"
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              required
            />
            <Input
              label="Data apresentação do relatório *"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              required
            />
          </div>
        </Card>
        <Button type="submit" size="lg" disabled={loading || !canSubmit}>
          {loading ? "Criando..." : "Criar inspeção"}
        </Button>
      </form>
    </div>
  );
}
