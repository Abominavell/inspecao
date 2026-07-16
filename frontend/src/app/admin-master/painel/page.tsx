"use client";

import Button from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserAccount } from "@/lib/api";

export default function AdminMasterPainelPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const { api, getToken } = await import("@/lib/api");
        const { getAuthContext } = await import("@/lib/webAuth");
        if (!getToken() || getAuthContext() !== "master") {
          router.replace("/admin-master");
          return;
        }
        const me = await api.me();
        if (me.auth_source !== "INTERNAL_MASTER") {
          router.replace("/admin-master");
          return;
        }
        setUser(me);
      } catch {
        setError("Sessão inválida");
        router.replace("/admin-master");
      }
    })();
  }, [router]);

  async function handleLogout() {
    try {
      const { api } = await import("@/lib/api");
      const { db } = await import("@/lib/db");
      const { clearWebSession } = await import("@/lib/webAuth");
      const session = await db.auth_session.get(1);
      if (session?.refresh_token) {
        await api.masterLogout(session.refresh_token).catch(() => undefined);
      }
      await clearWebSession();
    } finally {
      router.replace("/admin-master");
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
        {error || "Carregando..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Painel Master</h1>
            <p className="text-sm text-slate-400">{user.email}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void handleLogout()}>
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
          <h2 className="text-base font-semibold">Super Administrador</h2>
          <p className="mt-2 text-sm text-slate-400">
            Área isolada da autenticação Microsoft. Use este painel para operações sensíveis
            (usuários internos, configuração e auditoria).
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Nome</dt>
              <dd>{user.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Papel</dt>
              <dd>{user.role || "SUPER_ADMIN"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Origem</dt>
              <dd>{user.auth_source}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
          <h2 className="mb-3 text-base font-semibold">Atalhos</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="text-emserh-green hover:underline" href="/usuarios">
                Gestão de usuários (API)
              </Link>
            </li>
            <li>
              <Link className="text-emserh-green hover:underline" href="/">
                Abrir aplicação (como master)
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
