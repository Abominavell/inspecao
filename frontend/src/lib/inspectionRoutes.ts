/** Rotas estáticas `/inspecoes/i/*?id=` funcionam offline no PWA e no APK Capacitor. */
import { isFieldApp } from "@/lib/runtime";

export type InspectionStep = "dados" | "checklist" | "revisao";

export const ACTIVE_INSPECTION_KEY = "active_inspection_client_id";

export function setActiveInspectionClientId(clientId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ACTIVE_INSPECTION_KEY, clientId);
}

export function getActiveInspectionClientId(): string {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(ACTIVE_INSPECTION_KEY) ?? "";
}

export function isClientInspectionId(id: string): boolean {
  return id.includes("-");
}

/** Garante barra final nas rotas de pasta (export estático / Capacitor WebView). */
export function normalizeAppHref(href: string): string {
  if (typeof window === "undefined") return href;
  try {
    const url = new URL(href, window.location.origin);
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !/\.\w+$/.test(url.pathname)) {
      url.pathname = `${url.pathname}/`;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function inspectionStepHref(step: InspectionStep, id: string): string {
  if (!id) return normalizeAppHref("/inspecoes/nova");
  if (isClientInspectionId(id)) {
    return normalizeAppHref(`/inspecoes/i/${step}?id=${encodeURIComponent(id)}`);
  }
  return normalizeAppHref(`/inspecoes/${id}/${step}`);
}

export function isAppShellRoute(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const path = new URL(href, window.location.origin).pathname;
    return (
      path === "/" ||
      path === "/login/" ||
      path === "/login" ||
      path === "/inspecoes/nova/" ||
      path === "/inspecoes/nova" ||
      path.startsWith("/inspecoes/i/")
    );
  } catch {
    return false;
  }
}

export function inspectionStepUsesHardNav(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const path = new URL(href, window.location.origin).pathname;
    return (
      path === "/inspecoes/nova" ||
      path === "/inspecoes/nova/" ||
      path.startsWith("/inspecoes/i/")
    );
  } catch {
    return href.startsWith("/inspecoes/i/") || href.includes("/inspecoes/nova");
  }
}

export function shouldUseHardNavigation(href: string): boolean {
  const normalized = normalizeAppHref(href);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    isFieldApp() ||
    inspectionStepUsesHardNav(normalized) ||
    (offline && isAppShellRoute(normalized))
  );
}

/**
 * Navegação segura no APK/PWA: `router.push` não carrega HTML estático no Capacitor.
 */
export function navigateApp(href: string, router?: { push: (url: string) => void }): void {
  const target = normalizeAppHref(href);

  try {
    const url = new URL(target, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    const id = url.searchParams.get("id");
    if (id && url.pathname.includes("/inspecoes/i/")) {
      setActiveInspectionClientId(id);
    }
  } catch {
    /* ignore */
  }

  if (shouldUseHardNavigation(target)) {
    window.location.assign(target);
    return;
  }

  if (router) {
    router.push(target);
    return;
  }

  window.location.assign(target);
}

/** @deprecated Use navigateApp */
export function navigateInspection(
  href: string,
  router?: { push: (url: string) => void }
): void {
  navigateApp(href, router);
}

export const OFFLINE_INSPECTION_ROUTES = [
  "/inspecoes/nova",
  "/inspecoes/i/dados",
  "/inspecoes/i/checklist",
  "/inspecoes/i/revisao",
] as const;

export const APP_SHELL_ROUTES = ["/", "/login", ...OFFLINE_INSPECTION_ROUTES] as const;

export function warmAppShellRoutes(): void {
  if (typeof window === "undefined" || !navigator.onLine || isFieldApp()) return;
  for (const path of APP_SHELL_ROUTES) {
    void fetch(normalizeAppHref(path), { credentials: "same-origin" }).catch(() => undefined);
  }
  for (const path of OFFLINE_INSPECTION_ROUTES) {
    if (!path.startsWith("/inspecoes/i/")) continue;
    void fetch(normalizeAppHref(`${path}?id=warm`), { credentials: "same-origin" }).catch(
      () => undefined
    );
  }
}

/** @deprecated Use warmAppShellRoutes */
export function warmOfflineInspectionRoutes(): void {
  warmAppShellRoutes();
}
