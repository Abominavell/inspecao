"use client";

import AppLogo from "@/components/AppLogo";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { useCampoAuth } from "@/components/CampoAuthGate";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import OfflineIndicator from "@/components/OfflineIndicator";
import SyncConflictHandler from "@/components/SyncConflictHandler";
import SyncStatusBar from "@/components/SyncStatusBar";
import { ToastProvider } from "@/components/ToastProvider";
import { api, clearToken, getToken, setToken } from "@/lib/api";
import { db } from "@/lib/db";
import { cacheReferenceData } from "@/lib/db/repositories/inspectionRepo";
import { normalizeAppHref, shouldUseHardNavigation, warmAppShellRoutes } from "@/lib/inspectionRoutes";
import { openCampoLogin } from "@/lib/campoAuth";
import { logoutFieldApp } from "@/lib/localAuth";
import { isFieldApp, isNativeApp } from "@/lib/runtime";

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/login/" || pathname.startsWith("/login/");
}

function isMasterPath(pathname: string): boolean {
  return (
    pathname === "/admin-master" ||
    pathname === "/admin-master/" ||
    pathname.startsWith("/admin-master/")
  );
}

const baseNav = [
  { href: "/", label: "Dashboard" },
  { href: "/inspecoes/nova", label: "Nova inspeção" },
];

function ShellLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const normalized = normalizeAppHref(href);
  if (shouldUseHardNavigation(normalized)) {
    return (
      <a href={normalized} className={className}>
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

const webNavExtra = [{ href: "/unidades", label: "Unidades" }];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const fieldAuth = useCampoAuth();
  const [userName, setUserName] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isLogin = isLoginPath(pathname);
  const isMaster = isMasterPath(pathname);

  const fieldApp = isFieldApp();
  const fieldUserName = fieldAuth?.session.user_name ?? "";
  const fieldIsStaff = fieldAuth?.session.is_admin ?? false;

  const nav = useMemo(() => {
    const staff = fieldApp ? fieldIsStaff : isStaff;
    if (fieldApp) {
      const items = [...baseNav];
      if (staff) items.push({ href: "/usuarios", label: "Usuários" });
      return items;
    }
    const items = [...baseNav.slice(0, 1), ...webNavExtra, baseNav[1]];
    return staff ? [...items, { href: "/usuarios", label: "Usuários" }] : items;
  }, [isStaff, fieldIsStaff, fieldApp]);

  useEffect(() => {
    if (isLogin || isMaster || fieldApp) return;

    async function ensureAuth() {
      if (getToken()) {
        try {
          const u = await api.me();
          setUserName(u.name);
          setIsStaff(u.is_staff);
          if (navigator.onLine) {
            void cacheReferenceData();
            warmAppShellRoutes();
          }
        } catch {
          const refreshed = await import("@/lib/sync/SyncEngine").then((m) => m.tryRefreshToken());
          if (refreshed) {
            const u = await api.me();
            setUserName(u.name);
            setIsStaff(u.is_staff);
            if (navigator.onLine) {
              void cacheReferenceData();
              warmAppShellRoutes();
            }
            return;
          }
          const session = await db.auth_session.get(1);
          if (session?.access_token && !navigator.onLine) {
            setToken(session.access_token);
            setUserName(String((session.user as { name?: string })?.name ?? "Usuário"));
            setIsStaff(Boolean((session.user as { is_staff?: boolean })?.is_staff));
            return;
          }
          clearToken();
          router.replace("/login");
        }
        return;
      }
      const session = await db.auth_session.get(1);
      if (session?.access_token) {
        setToken(session.access_token);
        setUserName(String((session.user as { name?: string })?.name ?? "Usuário"));
        setIsStaff(Boolean((session.user as { is_staff?: boolean })?.is_staff));
        if (navigator.onLine) {
          api.me().then((u) => {
            setUserName(u.name);
            setIsStaff(u.is_staff);
            void cacheReferenceData();
            warmAppShellRoutes();
          }).catch(() => router.replace("/login"));
        }
        return;
      }
      router.replace("/login");
    }
    void ensureAuth();
  }, [isLogin, isMaster, router, pathname, fieldApp]);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const displayName = fieldApp ? fieldUserName : userName;

  async function handleLogout() {
    if (isNativeApp()) {
      await logoutFieldApp();
      await openCampoLogin();
      return;
    }
    if (fieldApp) {
      await fieldAuth?.logout();
      return;
    }
    try {
      const { clearWebSession, getAuthContext } = await import("@/lib/webAuth");
      const { db } = await import("@/lib/db");
      const { api } = await import("@/lib/api");
      const ctx = getAuthContext();
      const session = await db.auth_session.get(1);
      if (ctx === "master" && session?.refresh_token) {
        await api.masterLogout(session.refresh_token).catch(() => undefined);
      }
      await clearWebSession();
      if (ctx !== "master" && process.env.NEXT_PUBLIC_AUTH_ENTRA_ENABLED === "true") {
        const { signOut } = await import("next-auth/react");
        await signOut({ redirect: false });
      }
    } catch {
      clearToken();
    }
    router.push("/login");
  }

  if (isLogin || isMaster) return <>{children}</>;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        {!fieldApp && <SyncStatusBar />}
        {!fieldApp && <SyncConflictHandler />}
        {!fieldApp && <OfflineIndicator />}
        <header className="border-b border-border bg-card shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <ShellLink href="/" className="flex items-center gap-3">
                <AppLogo variant="header" />
                <span className="hidden text-sm font-medium text-slate-600 sm:inline">
                  Inspeção SSMA
                </span>
              </ShellLink>
              <nav className="hidden gap-1 md:flex">
                {nav.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <ShellLink
                      key={item.href}
                      href={item.href}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-emserh-green-light text-emserh-green"
                          : "text-slate-600 hover:bg-slate-100 hover:text-emserh-green"
                      }`}
                    >
                      {item.label}
                    </ShellLink>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {fieldApp && displayName && (
                <span className="max-w-[8rem] truncate text-sm text-slate-600 sm:max-w-none">
                  {displayName}
                </span>
              )}
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-emserh-green"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <span>{displayName || "Usuário"}</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userMenuOpen && !fieldApp && (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-lg border border-border bg-card py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setPasswordModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Alterar senha
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Sair
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav className="border-t border-border bg-card px-4 py-3 md:hidden">
              <div className="flex flex-col gap-1">
                {nav.map((item) => (
                  <ShellLink
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-emserh-green-light"
                  >
                    {item.label}
                  </ShellLink>
                ))}
                {!fieldApp && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordModalOpen(true);
                  }}
                  className="rounded-lg px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  Alterar senha
                </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleLogout();
                  }}
                  className="rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Sair / trocar usuário
                </button>
              </div>
            </nav>
          )}
        </header>
        <ChangePasswordModal
          open={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
        />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
