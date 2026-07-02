"use client";

import { inspectionStepUsesHardNav } from "@/lib/inspectionRoutes";
import Link from "next/link";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

/** Rotas `/inspecoes/i/*` e `/inspecoes/nova` usam `<a>` para o SW servir precache offline. */
export default function InspectionStepLink({ href, className, children }: Props) {
  if (inspectionStepUsesHardNav(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
