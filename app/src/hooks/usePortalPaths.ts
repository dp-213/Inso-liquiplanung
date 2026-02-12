"use client";

import { useMemo } from "react";

/**
 * Hook für Portal-Pfade, der Subdomain-Kontext berücksichtigt.
 *
 * Auf Subdomain (anchor.cases.gradify.de):
 *   casePath("123") → "/cases/123"
 *   loginPath → "/login"
 *   homePath → "/"
 *
 * Auf Hauptdomain (cases.gradify.de):
 *   casePath("123") → "/portal/cases/123"
 *   loginPath → "/customer-login"
 *   homePath → "/portal"
 */
export function usePortalPaths() {
  const isSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hostname = window.location.hostname;
    if (hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1")) {
      return false;
    }
    // Subdomain erkannt wenn Hostname auf .BASE_DOMAIN endet und NICHT exakt BASE_DOMAIN ist
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "cases.gradify.de";
    return hostname.endsWith(`.${baseDomain}`);
  }, []);

  return useMemo(
    () => ({
      isSubdomain,
      homePath: isSubdomain ? "/" : "/portal",
      loginPath: isSubdomain ? "/login" : "/customer-login",
      casePath: (caseId: string) =>
        isSubdomain ? `/cases/${caseId}` : `/portal/cases/${caseId}`,
      logoutPath: "/api/portal/auth/logout",
    }),
    [isSubdomain]
  );
}
