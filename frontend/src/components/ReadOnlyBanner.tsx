"use client";

import DownloadInspectionPhotosButton from "@/components/DownloadInspectionPhotosButton";

type Props = {
  status: "finalizado" | "archived";
  isStaff?: boolean;
  onReopen?: () => void;
  clientId?: string;
  serverId?: number;
  unitName?: string;
};

export default function ReadOnlyBanner({
  status,
  isStaff,
  onReopen,
  clientId,
  serverId,
  unitName,
}: Props) {
  const message =
    status === "archived"
      ? "Esta inspeção está arquivada e não pode ser editada."
      : "Esta inspeção está finalizada. Os dados estão em modo somente leitura.";

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex-1">{message}</p>
        <div className="flex flex-wrap items-center gap-2">
          {clientId && (
            <DownloadInspectionPhotosButton
              clientId={clientId}
              serverId={serverId}
              unitName={unitName}
            />
          )}
          {status === "finalizado" && isStaff && onReopen && (
            <button
              type="button"
              onClick={onReopen}
              className="rounded-lg bg-amber-200 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-300"
            >
              Reabrir inspeção
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
