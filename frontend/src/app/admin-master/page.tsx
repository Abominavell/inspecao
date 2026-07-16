"use client";

import AppLogo from "@/components/AppLogo";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminMasterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { getToken } = await import("@/lib/api");
      const { getAuthContext } = await import("@/lib/webAuth");
      if (getToken() && getAuthContext() === "master") {
        router.replace("/admin-master/painel");
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { api, setToken } = await import("@/lib/api");
      const { saveAuthSession } = await import("@/lib/sync/SyncEngine");
      const { setAuthContext } = await import("@/lib/webAuth");
      const data = await api.masterLogin(email, password);
      if (data.user.auth_source !== "INTERNAL_MASTER") {
        setError("Esta conta não é Super Administrador");
        return;
      }
      setToken(data.access_token);
      await saveAuthSession(
        data.access_token,
        data.refresh_token ?? null,
        data.user as unknown as Record<string, unknown>,
      );
      setAuthContext("master");
      router.replace("/admin-master/painel");
    } catch {
      setError("Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl"
      >
        <div className="mb-6 text-center">
          <AppLogo variant="login" />
          <h1 className="text-xl font-bold text-white">Área Administrativa</h1>
          <p className="mt-1 text-sm text-slate-400">
            Super Administrador — autenticação interna (sem Microsoft)
          </p>
        </div>
        {error && <p className="mb-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
        <div className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" disabled={loading} className="mt-6 w-full" size="lg">
          {loading ? "Entrando..." : "Entrar como Master"}
        </Button>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/login" className="text-slate-400 hover:underline">
            Voltar ao login de colaboradores
          </Link>
        </p>
      </form>
    </div>
  );
}
