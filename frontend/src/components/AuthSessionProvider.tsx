"use client";

import { useEffect, useState, type ReactNode, type ComponentType } from "react";

/**
 * Carrega SessionProvider do Auth.js apenas no web (não no Capacitor/offline).
 */
export default function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_OFFLINE_ONLY === "true" ||
      process.env.CAPACITOR === "true"
    ) {
      return;
    }
    void import("next-auth/react").then((mod) => {
      setProvider(() => mod.SessionProvider);
    });
  }, []);

  if (!Provider) return <>{children}</>;
  return <Provider>{children}</Provider>;
}
