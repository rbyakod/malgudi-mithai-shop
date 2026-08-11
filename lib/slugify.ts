// lib/slugify.ts
// Shared slugify helper. Used by route handlers for slugless collections
// (qsr-menu-items, snack-products, merch-products) and by the sitemap
// generator — those collections have no `slug` field, so the detail URL is
// `slugify(name)`. Centralizing the transform here guarantees the sitemap
// emits URLs that resolve at the route handler.
//
// Behavior: lowercase → trim → collapse non-alphanumeric runs into a single
// hyphen → strip leading/trailing hyphens. Identical to the inline
// implementation previously copy-pasted across 4 files.

/**
 * Convert a free-text name into a URL-safe slug.
 *
 * Example: `"Masala Dosa 2.0"` → `"masala-dosa-2-0"`.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
