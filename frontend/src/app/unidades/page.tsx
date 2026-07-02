"use client";

import { useEffect, useState } from "react";
import UnitFieldsForm from "@/components/UnitFieldsForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { api, Unit, UnitInput } from "@/lib/api";

const empty: UnitInput = {
  name: "",
  regional: "Norte",
  city: "São Luís/MA",
  address: "",
  unit_type: "",
  employee_count: 0,
  admin_coordinator: "",
  general_director: "",
  characterization: "",
};

export default function UnidadesPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState<UnitInput>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.getUnits().then(setUnits);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await api.updateUnit(editingId, form);
    } else {
      await api.createUnit(form);
    }
    setForm(empty);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function startEdit(unit: Unit) {
    setForm({
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
    setEditingId(unit.id);
    setShowForm(true);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Unidades</h1>
          <p className="text-sm text-slate-500">Cadastro de unidades para inspeção</p>
        </div>
        <Button
          onClick={() => {
            setForm(empty);
            setEditingId(null);
            setShowForm(true);
          }}
        >
          Nova unidade
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6" title={editingId ? "Editar unidade" : "Nova unidade"}>
          <form onSubmit={handleSubmit}>
            <UnitFieldsForm unit={form} onChange={setForm} />
            <div className="mt-4 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {units.length === 0 ? (
          <Card className="text-center text-slate-500">Nenhuma unidade cadastrada.</Card>
        ) : (
          units.map((unit) => (
            <div
              key={unit.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-800">{unit.name}</p>
                <p className="text-sm text-slate-500">
                  {unit.regional} · {unit.city}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(unit)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (confirm("Excluir unidade?")) {
                      await api.deleteUnit(unit.id);
                      load();
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
