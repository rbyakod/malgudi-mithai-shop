// lib/verticals/crossSell.ts
// Pure selection logic for the mithai PDP same-family cross-sell rail
// (Batch 8). Kept free of Payload/server imports so it is trivially
// unit-testable and reusable if other verticals grow cross-sell rails.
//
// "Images first" here means real uploaded media (firstDocImage) sorts ahead
// of docs that would render the static-artwork / monogram fallback — the
// rail leads with photography. The sort is stable, so within each group the
// query's own order (featured first) survives.

import {firstDocImage} from "@/lib/verticals/catalogMedia";

/** Minimal doc shape the picker needs; extra fields pass through. */
export type CrossSellDoc = {
  id: string | number;
  name?: string | null;
  slug?: string | null;
  displayPrice?: string | null;
  images?: unknown;
};

/** A doc can be carded only when it has a title and a linkable slug. */
function isLinkable(doc: CrossSellDoc): boolean {
  return Boolean(doc.name) && Boolean(doc.slug);
}

function hasUploadedMedia(doc: CrossSellDoc): boolean {
  return Boolean(firstDocImage(doc as Record<string, unknown>, "mithai-products"));
}

/**
 * Pick same-family cross-sell candidates: drop the PDP's own doc, drop
 * uncardable docs, order docs with uploaded media first (stable), and cap
 * at `limit`. `selfSlug` excludes the current product; the rail is hidden
 * entirely when nothing survives.
 */
export function pickCrossSell<T extends CrossSellDoc>(
  docs: readonly T[],
  selfSlug: string,
  limit = 4,
): T[] {
  return docs
    .filter((doc) => isLinkable(doc) && doc.slug !== selfSlug)
    .sort((a, b) => Number(hasUploadedMedia(b)) - Number(hasUploadedMedia(a)))
    .slice(0, limit);
}
