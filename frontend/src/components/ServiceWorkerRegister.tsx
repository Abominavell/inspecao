"use client";

import { useEffect } from "react";
import { warmAppShellRoutes } from "@/lib/inspectionRoutes";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const warm = () => warmAppShellRoutes();

        if (registration.active) {
          warm();
          return;
        }

        const worker = registration.installing ?? registration.waiting;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") warm();
        });
      })
      .catch(() => {
        // SW indisponível em dev sem build de produção
      });
  }, []);

  return null;
}
