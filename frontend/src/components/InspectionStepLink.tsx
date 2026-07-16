"use client";

import { normalizeAppHref, setActiveInspectionClientId, shouldUseHardNavigation } from "@/lib/inspectionRoutes";
import Link from "next/link";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

/** No APK e rotas `/inspecoes/i/*`, usa `<a>` para carregar o HTML estático correto. */
export default function InspectionStepLink({ href, className, children }: Props) {
  const normalized = normalizeAppHref(href);
  const hardNav = shouldUseHardNavigation(normalized);

  function rememberInspectionId() {
    try {
      const url = new URL(normalized, typeof window !== "undefined" ? window.location.origin : "https://localhost");
      const id = url.searchParams.get("id");
      if (id) setActiveInspectionClientId(id);
    } catch {
      /* ignore */
    }
  }

  if (hardNav) {
    return (
      <a href={normalized} className={className} onClick={rememberInspectionId}>
        {children}
      </a>
    );
  }
  return (
    <Link href={normalized} className={className}>
      {children}
    </Link>
  );
}
