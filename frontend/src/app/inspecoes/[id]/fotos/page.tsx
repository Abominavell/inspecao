"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Redireciona rota legada /fotos para o checklist (fotos NC ficam no checklist). */
export default function FotosRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    router.replace(`/inspecoes/${id}/checklist`);
  }, [id, router]);

  return <p className="text-slate-500">Redirecionando para o checklist...</p>;
}
