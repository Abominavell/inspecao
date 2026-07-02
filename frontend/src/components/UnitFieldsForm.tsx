import AddressPhotoCapture from "@/components/AddressPhotoCapture";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { UnitInput } from "@/lib/api";

type Props = {
  unit: UnitInput;
  onChange: (unit: UnitInput) => void;
  disabled?: boolean;
  inspectionId?: number;
  inspectionClientId?: string;
  serverId?: number;
  hasAddressPhoto?: boolean;
  onAddressPhotoChange?: (hasPhoto: boolean) => void;
};

const fieldsBeforeAddress = [
  ["name", "Nome da unidade *"],
  ["regional", "Regional *"],
  ["city", "Cidade *"],
] as const;

const fieldsAfterAddress = [
  ["unit_type", "Porte da unidade *"],
  ["admin_coordinator", "Coordenador(a) administrativo *"],
  ["general_director", "Diretor geral *"],
] as const;

export default function UnitFieldsForm({
  unit,
  onChange,
  disabled,
  inspectionId,
  inspectionClientId,
  serverId,
  hasAddressPhoto = false,
  onAddressPhotoChange,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fieldsBeforeAddress.map(([key, label]) => (
        <Input
          key={key}
          label={label}
          value={unit[key]}
          onChange={(e) => onChange({ ...unit, [key]: e.target.value })}
          required
          disabled={disabled}
        />
      ))}

      <div className="sm:col-span-2">
        <Input
          label="Endereço completo *"
          value={unit.address}
          onChange={(e) => onChange({ ...unit, address: e.target.value })}
          required
          disabled={disabled}
        />
        {(inspectionId != null || inspectionClientId) && onAddressPhotoChange && (
          <AddressPhotoCapture
            inspectionId={inspectionId ?? 0}
            inspectionClientId={inspectionClientId}
            serverId={serverId}
            hasPhoto={hasAddressPhoto}
            onPhotoChange={onAddressPhotoChange}
            disabled={disabled}
          />
        )}
      </div>

      {fieldsAfterAddress.map(([key, label]) => (
        <Input
          key={key}
          label={label}
          value={unit[key]}
          onChange={(e) => onChange({ ...unit, [key]: e.target.value })}
          required
          disabled={disabled}
        />
      ))}

      <Input
        label="Quantidade de funcionários *"
        type="number"
        min={1}
        value={unit.employee_count || ""}
        onChange={(e) => onChange({ ...unit, employee_count: Number(e.target.value) })}
        required
        disabled={disabled}
      />
      <div className="sm:col-span-2">
        <Textarea
          label="Caracterização da unidade (ambientes/salas) *"
          value={unit.characterization}
          onChange={(e) => onChange({ ...unit, characterization: e.target.value })}
          rows={5}
          placeholder="Descreva cada ambiente e sua finalidade, conforme o modelo do relatório."
          required
          disabled={disabled}
        />
      </div>
    </div>
  );
}
