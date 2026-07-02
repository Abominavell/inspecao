import { AutoSaveStatus } from "@/hooks/useAutoSave";

type Props = {
  status: AutoSaveStatus;
  error?: string;
};

export default function AutoSaveIndicator({ status, error }: Props) {
  if (status === "idle" && !error) return null;

  const label =
    status === "saving"
      ? "Salvando…"
      : status === "saved"
        ? "Salvo"
        : status === "error"
          ? error || "Erro ao salvar"
          : null;

  if (!label) return null;

  const className =
    status === "error"
      ? "bg-red-600 text-white"
      : status === "saved"
        ? "bg-emserh-green text-white"
        : "bg-slate-700 text-white";

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 rounded-full px-4 py-2 text-xs font-medium shadow-lg ${className}`}
      role="status"
    >
      {label}
    </div>
  );
}
