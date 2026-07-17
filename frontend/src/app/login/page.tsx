"use client";

import AppLogo from "@/components/AppLogo";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ensureReferenceData } from "@/lib/bundledData";
import {
  ensureDefaultAdmin,
  getValidLocalSession,
  saveLocalSession,
  verifyLocalLogin,
} from "@/lib/localAuth";
import { navigateApp, normalizeAppHref } from "@/lib/inspectionRoutes";
import { openCampoApp } from "@/lib/campoAuth";
import { isFieldApp, isNativeApp } from "@/lib/runtime";

/** Portão Microsoft: só quem é da empresa vê o formulário interno. */
const entraGate = process.env.NEXT_PUBLIC_AUTH_ENTRA_GATE_ENABLED === "true";
/** Modo legado: login só via Microsoft (exchange) — não usar junto com o gate. */
const entraAsAppLogin = process.env.NEXT_PUBLIC_AUTH_ENTRA_ENABLED === "true" && !entraGate;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fieldApp = isFieldApp();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(fieldApp);
  const [gateChecking, setGateChecking] = useState(entraGate);
  const [gateReady, setGateReady] = useState(!entraGate);
  const [entraProof, setEntraProof] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const [username, setUsername] = useState("");
  const [localPassword, setLocalPassword] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!fieldApp) return;
    void (async () => {
      try {
        const { purgeLegacyPersistedSession } = await import("@/lib/localAuth");
        await purgeLegacyPersistedSession();
        await ensureReferenceData();
        await ensureDefaultAdmin();
        const session = await getValidLocalSession();
        if (session) {
          if (isNativeApp()) {
            await openCampoApp();
            return;
          }
          window.location.replace(normalizeAppHref("/"));
          return;
        }
      } finally {
        setBooting(false);
      }
    })();
  }, [fieldApp]);

  // Portão Entra: SSO Microsoft → depois mostra formulário e-mail/senha interno
  useEffect(() => {
    if (fieldApp || !entraGate) return;
    const err = searchParams.get("error");
    if (err) {
      setError("Não foi possível validar o acesso corporativo Microsoft.");
      setGateChecking(false);
      setGateReady(false);
      return;
    }

    void (async () => {
      try {
        const { getSession, signIn } = await import("next-auth/react");
        const session = await getSession();
        const proof = session?.entraIdToken || session?.entraAccessToken;
        if (proof) {
          setEntraProof(proof);
          setGateReady(true);
          setGateChecking(false);
          return;
        }
        setGateChecking(true);
        await signIn("microsoft-entra-id", { callbackUrl: "/login" });
      } catch {
        setError("Falha ao iniciar autenticação Microsoft da empresa.");
        setGateChecking(false);
        setGateReady(false);
      }
    })();
  }, [fieldApp, searchParams]);

  // Modo antigo: Microsoft = login da aplicação (exchange)
  useEffect(() => {
    if (fieldApp || !entraAsAppLogin) return;
    const err = searchParams.get("error");
    if (err) {
      setError("Falha na autenticação Microsoft. Tente novamente.");
      return;
    }

    void (async () => {
      try {
        const { getSession } = await import("next-auth/react");
        const session = await getSession();
        const entraToken = session?.entraAccessToken;
        if (!entraToken) return;

        setExchanging(true);
        setError("");
        const { api, setToken } = await import("@/lib/api");
        const { saveAuthSession } = await import("@/lib/sync/SyncEngine");
        const { cacheReferenceData } = await import("@/lib/db/repositories/inspectionRepo");
        const { warmAppShellRoutes } = await import("@/lib/inspectionRoutes");
        const { setAuthContext } = await import("@/lib/webAuth");

        const data = await api.entraExchange(entraToken);
        setToken(data.access_token);
        await saveAuthSession(
          data.access_token,
          data.refresh_token ?? null,
          data.user as unknown as Record<string, unknown>,
        );
        setAuthContext("entra");
        await cacheReferenceData();
        warmAppShellRoutes();
        router.replace("/");
      } catch {
        setError("Não foi possível concluir o login Microsoft com a API.");
      } finally {
        setExchanging(false);
      }
    })();
  }, [fieldApp, router, searchParams]);

  async function handleMicrosoftLogin() {
    setLoading(true);
    setError("");
    try {
      const { signIn } = await import("next-auth/react");
      await signIn("microsoft-entra-id", { callbackUrl: "/login" });
    } catch {
      setError("Não foi possível iniciar o login Microsoft");
      setLoading(false);
    }
  }

  async function handleWebLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { api, setToken } = await import("@/lib/api");
      const { cacheReferenceData } = await import("@/lib/db/repositories/inspectionRepo");
      const { warmAppShellRoutes } = await import("@/lib/inspectionRoutes");
      const { saveAuthSession } = await import("@/lib/sync/SyncEngine");
      const { setAuthContext } = await import("@/lib/webAuth");
      const { access_token, refresh_token } = await api.login(
        email,
        password,
        entraGate ? entraProof ?? undefined : undefined,
      );
      setToken(access_token);
      const me = await api.me();
      await saveAuthSession(access_token, refresh_token ?? null, me as unknown as Record<string, unknown>);
      setAuthContext(me.auth_source === "INTERNAL_MASTER" ? "master" : "legacy");
      await cacheReferenceData();
      warmAppShellRoutes();
      router.push(me.auth_source === "INTERNAL_MASTER" ? "/admin-master" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail ou senha incorretos");
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await verifyLocalLogin(username, localPassword);
      if (!user) {
        setError("Usuário ou senha incorretos");
        return;
      }
      await saveLocalSession(user);
      if (isNativeApp()) {
        await openCampoApp();
        return;
      }
      navigateApp("/");
    } finally {
      setLoading(false);
    }
  }

  if (fieldApp) {
    if (booting) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emserh-green-light via-background to-slate-100 px-4">
          <p className="text-sm text-slate-600">Carregando...</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emserh-green-light via-background to-slate-100 px-4">
        <form
          onSubmit={handleLocalLogin}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl"
        >
          <div className="mb-6 text-center">
            <AppLogo variant="login" />
            <h1 className="text-xl font-bold text-slate-800">Inspeção SSMA</h1>
            <p className="mt-1 text-sm text-slate-500">Modo offline — dados neste tablet</p>
          </div>
          {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="space-y-4">
            <Input
              label="Usuário *"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              label="Senha *"
              type="password"
              value={localPassword}
              onChange={(e) => setLocalPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={loading || !username} className="mt-6 w-full" size="lg">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    );
  }

  if (entraGate && gateChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emserh-green-light via-background to-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <AppLogo variant="login" />
          <p className="mt-4 text-sm text-slate-600">Validando acesso corporativo Microsoft...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emserh-green-light via-background to-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <AppLogo variant="login" />
          <h1 className="text-xl font-bold text-slate-800">Inspeção SSMA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Diagnóstico de Saúde, Segurança e Meio Ambiente
          </p>
        </div>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {exchanging && (
          <p className="mb-4 rounded-lg bg-emserh-green-light/40 p-3 text-sm text-slate-700">
            Concluindo autenticação Microsoft...
          </p>
        )}

        {entraAsAppLogin ? (
          <>
            <Button
              type="button"
              disabled={loading || exchanging}
              className="w-full"
              size="lg"
              onClick={() => void handleMicrosoftLogin()}
            >
              {loading || exchanging ? "Aguarde..." : "Entrar com Microsoft"}
            </Button>
            <p className="mt-4 text-center text-xs text-slate-500">
              Colaboradores autenticam exclusivamente com a conta corporativa.
            </p>
          </>
        ) : gateReady ? (
          <form onSubmit={handleWebLogin} className="space-y-4">
            {entraGate && (
              <p className="rounded-lg bg-emserh-green-light/30 px-3 py-2 text-xs text-slate-600">
                Acesso corporativo confirmado. Entre com seu usuário do sistema.
              </p>
            )}
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
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            disabled={loading}
            className="w-full"
            size="lg"
            onClick={() => void handleMicrosoftLogin()}
          >
            Validar acesso Microsoft
          </Button>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link href="/admin-master" className="underline-offset-2 hover:underline">
            Área Administrativa
          </Link>
        </p>
      </div>
    </div>
  );
}
