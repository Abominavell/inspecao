"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { openCampoApp, openCampoLogin } from "@/lib/campoAuth";
import { ensureReferenceData } from "@/lib/bundledData";
import { normalizeAppHref } from "@/lib/inspectionRoutes";
import {
  ensureDefaultAdmin,
  getValidLocalSession,
  logoutFieldApp,
  purgeLegacyPersistedSession,
  type LocalSession,
} from "@/lib/localAuth";
import { isCampoAuthRequired, isNativeApp } from "@/lib/runtime";

type AuthStatus = "booting" | "unauthenticated" | "authenticated";

type CampoAuthContextValue = {
  session: LocalSession;
  logout: () => Promise<void>;
};

const CampoAuthContext = createContext<CampoAuthContextValue | null>(null);

export function useCampoAuth(): CampoAuthContextValue | null {
  return useContext(CampoAuthContext);
}

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/login/" || pathname.startsWith("/login/");
}

function currentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function initialAuthStatus(): AuthStatus {
  if (!isCampoAuthRequired()) return "authenticated";
  if (typeof window === "undefined") return "booting";
  return "booting";
}

export default function CampoAuthGate({ children }: { children: ReactNode }) {
  const campoAuthRequired = isCampoAuthRequired();
  const pathname = usePathname();
  const nativeApp = isNativeApp();
  const [status, setStatus] = useState<AuthStatus>(initialAuthStatus);
  const [session, setSession] = useState<LocalSession | null>(null);

  const logout = useCallback(async () => {
    await logoutFieldApp();
    setSession(null);
    setStatus("unauthenticated");
    if (nativeApp) {
      await openCampoLogin();
      return;
    }
    window.location.replace(normalizeAppHref("/login"));
  }, [nativeApp]);

  useEffect(() => {
    if (!campoAuthRequired) return;

    let cancelled = false;

    async function boot() {
      setStatus("booting");
      await purgeLegacyPersistedSession();
      await ensureDefaultAdmin();
      const valid = await getValidLocalSession();
      if (cancelled) return;

      if (valid) {
        await ensureReferenceData();
        if (cancelled) return;
        setSession(valid);
        setStatus("authenticated");
        if (nativeApp) {
          if (isLoginPath(pathname) || isLoginPath(currentPathname())) {
            await openCampoApp();
          }
          return;
        }
        if (isLoginPath(pathname)) {
          window.location.replace(normalizeAppHref("/"));
        }
        return;
      }

      setSession(null);
      setStatus("unauthenticated");
      if (nativeApp) {
        if (!isLoginPath(pathname) && !isLoginPath(currentPathname())) {
          await openCampoLogin();
        }
        return;
      }
      if (!isLoginPath(pathname) && !isLoginPath(currentPathname())) {
        window.location.replace(normalizeAppHref("/login"));
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [campoAuthRequired, nativeApp, pathname]);

  useEffect(() => {
    if (!campoAuthRequired || !nativeApp) return;
    if (status !== "unauthenticated") return;
    if (isLoginPath(pathname) || isLoginPath(currentPathname())) return;
    void openCampoLogin();
  }, [campoAuthRequired, nativeApp, pathname, status]);

  if (!campoAuthRequired) {
    return <>{children}</>;
  }

  if (status === "booting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-slate-600">Carregando...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    if (!isLoginPath(pathname) && !isLoginPath(currentPathname())) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-slate-600">Redirecionando para login...</p>
        </div>
      );
    }
    return <>{children}</>;
  }

  if (isLoginPath(pathname) || isLoginPath(currentPathname())) {
    if (nativeApp) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-slate-600">Abrindo app...</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-slate-600">Redirecionando...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-slate-600">Carregando...</p>
      </div>
    );
  }

  return (
    <CampoAuthContext.Provider value={{ session, logout }}>
      {children}
    </CampoAuthContext.Provider>
  );
}
