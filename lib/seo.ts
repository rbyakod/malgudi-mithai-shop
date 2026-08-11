import {routing} from "@/i18n/routing";

/**
 * Build hreflang alternate links for a given path.
 *
 * Accepts a path with or without a locale prefix, or root ("/"/"").
 * Returns an object suitable for Next.js Metadata `alternates` field.
 *
 * Examples:
 *   buildAlternates("/mithai/kaju-katli")
 *   buildAlternates("/")            -> { languages: { en: "/en", hi: "/hi", kn: "/kn", "x-default": "/en" } }
 *   buildAlternates("/en/mithai")   -> strips /en, rebuilds all locales
 */
export function buildAlternates(pathWithoutLocale: string): {
  languages: Record<string, string>;
} {
  const locales = routing.locales as readonly string[];
  const localePrefixRe = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

  // Strip any existing locale prefix, then strip trailing slash.
  const clean = pathWithoutLocale.replace(localePrefixRe, "").replace(/\/+$/, "");

  // Normalize empty back to "" so prefix concat yields "/en" not "/en/".
  const suffix = clean === "" ? "" : clean;

  const languages: Record<string, string> = {};
  for (const loc of locales) {
    languages[loc] = `/${loc}${suffix}`;
  }
  languages["x-default"] = `/${routing.defaultLocale}${suffix}`;

  return {languages};
}
