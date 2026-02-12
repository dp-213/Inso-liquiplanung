import { headers } from "next/headers";
import prisma from "@/lib/db";

/**
 * Liest den Tenant-Slug aus dem x-tenant-slug Header.
 * Wird von der Middleware gesetzt wenn eine Subdomain erkannt wird.
 */
export async function getTenantSlug(): Promise<string | null> {
  const headerStore = await headers();
  return headerStore.get("x-tenant-slug") || null;
}

/**
 * Lädt den CustomerUser anhand des Tenant-Slugs.
 * Gibt null zurück wenn kein Slug gesetzt oder kein Kunde gefunden.
 */
export async function getTenantCustomer() {
  const slug = await getTenantSlug();
  if (!slug) return null;

  return prisma.customerUser.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      email: true,
      slug: true,
      company: true,
      logoUrl: true,
      isActive: true,
    },
  });
}

/**
 * Prüft ob der aktuelle Request über eine Subdomain kommt.
 */
export async function isSubdomainRequest(): Promise<boolean> {
  const slug = await getTenantSlug();
  return slug !== null;
}
