/** Rotas estáticas `/inspecoes/i/*?id=` funcionam offline no PWA; UUIDs usam query param. */
export type InspectionStep = "dados" | "checklist" | "revisao";

export function isClientInspectionId(id: string): boolean {
  return id.includes("-");
}

export function inspectionStepHref(step: InspectionStep, id: string): string {
  if (!id) return "/inspecoes/nova";
  if (isClientInspectionId(id)) {
    return `/inspecoes/i/${step}?id=${encodeURIComponent(id)}`;
  }
  return `/inspecoes/${id}/${step}`;
}

export function isAppShellRoute(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const path = new URL(href, window.location.origin).pathname;
    return (
      path === "/" ||
      path === "/login" ||
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
    return path === "/inspecoes/nova" || path.startsWith("/inspecoes/i/");
  } catch {
    return href.startsWith("/inspecoes/i/") || href === "/inspecoes/nova";
  }
}

/** @deprecated Use inspectionStepUsesHardNav */
export function inspectionStepUsesHardNavOffline(href: string): boolean {
  return inspectionStepUsesHardNav(href);
}

/**
 * Navegação segura offline: `router.push` busca RSC na rede e falha sem internet.
 * Rotas do app shell usam navegação completa para o service worker servir o precache.
 */
export function navigateApp(href: string, router?: { push: (url: string) => void }): void {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (inspectionStepUsesHardNav(href) || (offline && isAppShellRoute(href))) {
    window.location.assign(href);
    return;
  }

  if (router) {
    router.push(href);
    return;
  }

  window.location.assign(href);
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

/** Páginas que o PWA precisa no cache para abrir sem rede. */
export const APP_SHELL_ROUTES = ["/", "/login", ...OFFLINE_INSPECTION_ROUTES] as const;

export function warmAppShellRoutes(): void {
  if (typeof window === "undefined" || !navigator.onLine) return;
  for (const path of APP_SHELL_ROUTES) {
    void fetch(path, { credentials: "same-origin" }).catch(() => undefined);
  }
  for (const path of OFFLINE_INSPECTION_ROUTES) {
    if (!path.startsWith("/inspecoes/i/")) continue;
    void fetch(`${path}?id=warm`, { credentials: "same-origin" }).catch(() => undefined);
  }
}

/** @deprecated Use warmAppShellRoutes */
export function warmOfflineInspectionRoutes(): void {
  warmAppShellRoutes();
}
