// lib/verticals/pdpHref.ts
// Single source of truth for "collection doc → detail-page href".
//
// Extracted from VerticalHub.tsx (which previously carried the mapping
// inline) so the gifts/occasions surfaces (Batch 7) and the PDP cross-sell
// rails (Batch 8) resolve identical URLs to the vertical hubs.
//
// Slug rules:
//   - mithai-products has a real (unique, non-localized) `slug` field — used
//     as-is.
//   - Every slugless collection (qsr, snacks, merch, gifts, occasions)
//     derives the URL from slugify(name) server-side. The [slug] routes
//     match the same transform, guaranteeing hrefs resolve.
//   - Payload here runs WITHOUT a `localization` config, so `name` is a
//     single canonical value — the derived slug is locale-stable.

import {slugify} from "@/lib/slugify";

/** Collections that resolve to a public detail page. */
export type PdpCollectionSlug =
  | "mithai-products"
  | "qsr-menu-items"
  | "snack-products"
  | "merch-products"
  | "gift-boxes"
  | "occasions";

/** Which route segment each collection's detail pages live under. */
const VERTICAL_PATH: Record<PdpCollectionSlug, string> = {
  "mithai-products": "mithai",
  "qsr-menu-items": "qsr",
  "snack-products": "snacks",
  "merch-products": "merch",
  "gift-boxes": "gifts",
  occasions: "occasions",
};

/**
 * Build the PDP href for a doc. Mithai uses its real slug; the slugless
 * collections derive the URL from slugify(name). Returns "#" when the doc
 * lacks the needed field so callers never emit a broken relative path.
 */
export function pdpHref(
  doc: Record<string, unknown>,
  collection: PdpCollectionSlug,
): string {
  const vertical = VERTICAL_PATH[collection];
  if (collection === "mithai-products") {
    const slug = doc.slug as string | undefined;
    return slug ? `/${vertical}/${slug}` : "#";
  }
  const name = (doc.name as string | undefined) ?? "";
  return name ? `/${vertical}/${slugify(name)}` : "#";
}
