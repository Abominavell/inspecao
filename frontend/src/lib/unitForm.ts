import { SsmaConfig, Unit, UnitInput } from "@/lib/api";

export function emptyUnitInput(defaults?: Pick<SsmaConfig, "regional" | "cidade">): UnitInput {
  return {
    name: "",
    regional: defaults?.regional ?? "Norte",
    city: defaults?.cidade ?? "São Luís/MA",
    address: "",
    unit_type: "",
    employee_count: 0,
    admin_coordinator: "",
    general_director: "",
    characterization: "",
  };
}

export function unitToInput(unit: Unit, defaults?: Pick<SsmaConfig, "regional" | "cidade">): UnitInput {
  return {
    name: unit.name,
    regional: unit.regional || defaults?.regional || "",
    city: unit.city || defaults?.cidade || "",
    address: unit.address,
    unit_type: unit.unit_type,
    employee_count: unit.employee_count,
    admin_coordinator: unit.admin_coordinator,
    general_director: unit.general_director,
    characterization: unit.characterization,
  };
}
