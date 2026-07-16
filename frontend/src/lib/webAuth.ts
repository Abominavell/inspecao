/** Helpers de autenticação web (não usados no build Capacitor/offline). */

function cookieSecureSuffix(): string {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setAuthContext(kind: "entra" | "master" | "legacy" | "") {
  if (typeof document === "undefined") return;
  if (!kind) {
    document.cookie = `ssma_auth_context=; Max-Age=0; path=/; SameSite=Lax${cookieSecureSuffix()}`;
    return;
  }
  document.cookie = `ssma_auth_context=${kind}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${cookieSecureSuffix()}`;
}

export function getAuthContext(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )ssma_auth_context=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function clearWebSession(): Promise<void> {
  const { clearToken } = await import("@/lib/api");
  const { clearAuthSession } = await import("@/lib/sync/SyncEngine");
  clearToken();
  await clearAuthSession();
  setAuthContext("");
}
