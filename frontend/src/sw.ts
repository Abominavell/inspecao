/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Rotas do app que devem abrir offline (PWA em campo). */
function isOfflineAppShellPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/~offline" ||
    pathname === "/inspecoes/nova" ||
    pathname.startsWith("/inspecoes/i/")
  );
}

const offlineAppShellDocumentCache: RuntimeCaching = {
  matcher: ({ request, url }) => {
    if (request.mode !== "navigate" && request.destination !== "document") return false;
    return isOfflineAppShellPath(url.pathname);
  },
  handler: new CacheFirst({
    cacheName: "offline-app-documents",
    matchOptions: { ignoreSearch: true },
    plugins: [
      new ExpirationPlugin({
        maxEntries: 16,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
};

/** Evita NetworkFirst em HTML do app shell — offline falhava antes do precache. */
const runtimeCaching: RuntimeCaching[] = [
  offlineAppShellDocumentCache,
  ...defaultCache.filter((rule) => {
    if (typeof rule.matcher !== "function") return true;
    const inner = rule.matcher;
    return (args: Parameters<typeof inner>[0]) => {
      const contentType = args.request.headers.get("Content-Type") ?? "";
      const isHtmlRule =
        contentType.includes("text/html") ||
        (args.request.mode === "navigate" && args.sameOrigin && !args.url.pathname.startsWith("/api/"));
      if (isHtmlRule && isOfflineAppShellPath(args.url.pathname)) return false;
      return inner(args);
    };
  }),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Sem isso, /inspecoes/i/checklist?id=uuid não casa com o precache.
    ignoreURLParametersMatching: [/^id$/, /^utm_/, /^fbclid$/],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
