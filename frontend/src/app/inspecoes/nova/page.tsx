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
import { createLocalInspection, saveLocalUnitData } from "@/lib/db/repositories/inspectionRepo";
import { getCachedReference, cacheReferenceData } from "@/lib/db/repositories/inspectionRepo";
import { inspectionStepHref, navigateApp, warmAppShellRoutes } from "@/lib/inspectionRoutes";
import { syncEngine } from "@/lib/sync/SyncEngine";
import { emptyUnitInput, unitToInput } from "@/lib/unitForm";

export default function NovaInspecaoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [unit, setUnit] = useState(emptyUnitInput());
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState<{ regional: string; cidade: string } | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    if (navigator.onLine) warmAppShellRoutes();
  }, []);

  useEffect(() => {
    async function load() {
      if (navigator.onLine) await cacheReferenceData();
      const list = (await getCachedReference<Unit[]>("units")) ?? [];
      const ssma = (await getCachedReference<{ regional: string; cidade: string }>("ssma")) ?? {
        regional: "",
        cidade: "",
      };
      setUnits(list);
      setDefaults({ regional: ssma.regional, cidade: ssma.cidade });
      setUnit(emptyUnitInput(ssma));
    }
    load();
  }, []);

  function handleUnitSelect(id: string) {
    setUnitId(id);
    if (!id) {
      setUnit(emptyUnitInput(defaults ?? undefined));
      return;
    }
    const selected = units.find((u) => String(u.id) === id);
    if (selected) setUnit(unitToInput(selected));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId) return;
    setLoading(true);
    try {
      const selected = units.find((u) => String(u.id) === unitId);
      const local = await createLocalInspection({
        unit_id: Number(unitId),
        unit: selected,
        inspection_date: inspectionDate,
        report_date: reportDate,
      });
      await saveLocalUnitData(local.client_id, Number(unitId), unit);
      if (navigator.onLine) {
        try {
          await api.updateUnit(Number(unitId), unit);
          await syncEngine.syncNow();
        } catch {
          toast("Inspeção salva localmente; sincronize quando possível", "info");
        }
      } else {
        toast("Inspeção criada offline", "success");
      }
      navigateApp(inspectionStepHref("dados", local.client_id), router);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar inspeção", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Nova inspeção</h1>
      <p className="mb-6 text-sm text-slate-600">
        A inspeção é salva no tablet e sincronizada com o servidor quando houver internet.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Unidade">
          {units.length === 0 && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {isOffline
                ? "Nenhuma unidade no cache. Conecte à internet, faça login e abra o app uma vez antes de usar offline."
                : "Nenhuma unidade encontrada. Cadastre unidades ou atualize a página."}
            </p>
          )}
          <Select
            label="Unidade cadastrada *"
            value={unitId}
            onChange={(e) => handleUnitSelect(e.target.value)}
            required
            className="mb-4"
          >
            <option value="">Selecione uma unidade...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.city}
              </option>
            ))}
          </Select>
          {unitId && defaults !== null && (
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
        <Button type="submit" size="lg" disabled={loading || !unitId}>
          {loading ? "Criando..." : "Criar inspeção"}
        </Button>
      </form>
    </div>
  );
}
