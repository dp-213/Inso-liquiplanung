import { NextRequest, NextResponse } from "next/server";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "cases.gradify.de";

/**
 * Middleware für Subdomain-Routing
 *
 * Erkennt Kunden-Subdomains (z.B. anchor.cases.gradify.de) und setzt
 * einen x-tenant-slug Header + URL-Rewrites für das Portal.
 *
 * Hauptdomain (cases.gradify.de) und localhost werden normal geroutet.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Localhost und Hauptdomain: kein Subdomain-Routing
  if (
    hostname === BASE_DOMAIN ||
    hostname.startsWith("localhost") ||
    hostname.startsWith("127.0.0.1") ||
    hostname.includes("vercel.app")
  ) {
    return NextResponse.next();
  }

  // Subdomain extrahieren: "anchor.cases.gradify.de" → "anchor"
  const slug = hostname.replace(`.${BASE_DOMAIN}`, "").split(".")[0];

  if (!slug || slug === hostname) {
    // Kein gültiger Slug gefunden
    return NextResponse.next();
  }

  // Statische Assets und API-Aufrufe durchreichen (mit Tenant-Header)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Tenant-Header setzen für alle Requests
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", slug);

  // URL-Rewrites für Subdomain-Portal
  const url = request.nextUrl.clone();

  if (pathname === "/" || pathname === "") {
    // Root → Portal Dashboard
    url.pathname = "/portal";
    return NextResponse.rewrite(url, { headers: requestHeaders });
  }

  if (pathname === "/login") {
    // /login → Customer Login
    url.pathname = "/customer-login";
    return NextResponse.rewrite(url, { headers: requestHeaders });
  }

  if (pathname.startsWith("/cases/")) {
    // /cases/... → /portal/cases/...
    url.pathname = `/portal${pathname}`;
    return NextResponse.rewrite(url, { headers: requestHeaders });
  }

  if (pathname.startsWith("/api/")) {
    // API-Aufrufe durchreichen mit Tenant-Header
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Alle anderen Pfade: mit Header weiterleiten
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Alle Pfade außer statische Dateien
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
