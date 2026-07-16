"use client";

import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveInspectionClientId } from "@/lib/inspectionRoutes";

function queryIdFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("id") ?? "";
}

/** ID da inspeção na URL (`[id]` numérico/UUID ou `?id=` nas rotas `/inspecoes/i/*`). */
export function useInspectionRouteId(): string {
  const params = useParams();
  const pathname = usePathname();
  const isOfflineRoute = pathname.includes("/inspecoes/i/");
  const [queryId, setQueryId] = useState(() => {
    if (!isOfflineRoute) return "";
    return queryIdFromUrl() || getActiveInspectionClientId();
  });

  useEffect(() => {
    if (!isOfflineRoute) return;
    const fromUrl = queryIdFromUrl();
    const id = fromUrl || getActiveInspectionClientId();
    setQueryId(id);
  }, [isOfflineRoute, pathname]);

  if (isOfflineRoute) return queryId;
  return String(params.id ?? "");
}
