import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/admin-master", "/api/auth", "/~offline"];
const MASTER_PREFIX = "/admin-master";

function isPublic(pathname: string): boolean {
  if (pathname === "/") return false;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Assets e estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("next-auth.session-token");

  const masterHint = request.cookies.get("ssma_auth_context")?.value;
  const isMasterPath =
    pathname === MASTER_PREFIX || pathname.startsWith(`${MASTER_PREFIX}/`);

  // Isolamento: colaborador Entra não acessa master
  if (isMasterPath && masterHint === "entra" && sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Isolamento: master não usa área colaborador sem cookie master
  if (!isPublic(pathname) && !isMasterPath && masterHint === "master") {
    // permite; master pode ter JWT no localStorage — guard client-side reforça
    return NextResponse.next();
  }

  if (isPublic(pathname) || isMasterPath) {
    return NextResponse.next();
  }

  // Rotas privadas: sem cookie Auth.js ainda pode ter JWT legado — AppShell valida
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
