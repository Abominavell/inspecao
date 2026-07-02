"use client";

import AppLogo from "@/components/AppLogo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api, setToken } from "@/lib/api";
import { cacheReferenceData } from "@/lib/db/repositories/inspectionRepo";
import { warmAppShellRoutes } from "@/lib/inspectionRoutes";
import { saveAuthSession } from "@/lib/sync/SyncEngine";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { access_token, refresh_token } = await api.login(email, password);
      setToken(access_token);
      const me = await api.me();
      await saveAuthSession(access_token, refresh_token ?? null, me as unknown as Record<string, unknown>);
      await cacheReferenceData();
      warmAppShellRoutes();
      router.push("/");
    } catch {
      setError("E-mail ou senha incorretos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emserh-green-light via-background to-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl"
      >
        <div className="mb-6 text-center">
          <AppLogo variant="login" />
          <h1 className="text-xl font-bold text-slate-800">Inspeção SSMA</h1>
          <p className="mt-1 text-sm text-slate-500">Diagnóstico de Saúde, Segurança e Meio Ambiente</p>
        </div>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
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
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
