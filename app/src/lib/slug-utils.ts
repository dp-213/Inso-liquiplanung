/**
 * Slug-Utilities für Kunden-Subdomains
 * Slug = Subdomain-Prefix, z.B. "anchor" → anchor.cases.gradify.de
 */

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "portal",
  "view",
  "www",
  "app",
  "mail",
  "cdn",
  "static",
  "assets",
  "customer-login",
  "login",
  "auth",
  "docs",
  "help",
  "support",
  "status",
  "staging",
  "dev",
  "test",
]);

/**
 * Prüft ob ein Slug gültig ist:
 * - Nur Kleinbuchstaben, Ziffern und Bindestriche
 * - 3-30 Zeichen lang
 * - Beginnt und endet nicht mit Bindestrich
 * - Keine doppelten Bindestriche
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 30) return false;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return false;
  if (slug.includes("--")) return false;
  return true;
}

/**
 * Prüft ob ein Slug reserviert ist (System-Routen, etc.)
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Generiert einen Slug-Vorschlag aus einem Firmennamen
 * z.B. "Anchor Rechtsanwälte" → "anchor"
 * z.B. "Müller & Partner GbR" → "mueller-partner"
 */
export function suggestSlug(company: string): string {
  let slug = company
    .toLowerCase()
    .trim()
    // Deutsche Umlaute ersetzen (in Slugs nötig, da DNS keine Umlaute kann)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    // Rechtsformen und Füllwörter entfernen
    .replace(
      /\b(gmbh|gbr|ag|eg|e\.g\.|ohg|kg|partg|mbb|rechtsanw[äa]lte|kanzlei|rechtsanwaltskanzlei|steuerberater|und|&)\b/gi,
      ""
    )
    // Sonderzeichen durch Bindestriche ersetzen
    .replace(/[^a-z0-9]+/g, "-")
    // Doppelte Bindestriche entfernen
    .replace(/-+/g, "-")
    // Bindestriche am Anfang/Ende entfernen
    .replace(/^-|-$/g, "");

  // Auf 30 Zeichen begrenzen
  if (slug.length > 30) {
    slug = slug.substring(0, 30).replace(/-$/, "");
  }

  // Mindestlänge sicherstellen
  if (slug.length < 3) {
    slug = slug.padEnd(3, "x");
  }

  return slug;
}

/**
 * Vollständige Slug-Validierung: gültig UND nicht reserviert
 */
export function validateSlug(slug: string): {
  valid: boolean;
  error?: string;
} {
  if (!isValidSlug(slug)) {
    return {
      valid: false,
      error:
        "Slug muss 3-30 Zeichen lang sein und darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.",
    };
  }

  if (isReservedSlug(slug)) {
    return {
      valid: false,
      error: "Dieser Slug ist reserviert und kann nicht verwendet werden.",
    };
  }

  return { valid: true };
}
