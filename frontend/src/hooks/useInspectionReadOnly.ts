import { useEffect, useState } from "react";
import { api, Inspection } from "@/lib/api";

export function useInspectionReadOnly(inspectionId: number) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getInspection(inspectionId)
      .then(setInspection)
      .catch(() => setInspection(null))
      .finally(() => setLoading(false));
  }, [inspectionId]);

  const readOnly =
    inspection?.status === "finalizado" || Boolean(inspection?.is_archived);

  return { inspection, readOnly, loading, refresh: () => api.getInspection(inspectionId).then(setInspection) };
}
