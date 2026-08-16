// lib/verticals/catalogMedia.ts
// Media extraction + static artwork fallbacks shared by the vertical hubs,
// the /mithai search hub, and the gifts/occasions rails.
//
// Extracted verbatim from VerticalHub.tsx (Batch 6) so the mithai hub page —
// which now fetches its own docs instead of delegating to <VerticalHub/> —
// resolves card images identically without a second copy of the fallback map.

import {slugify} from "@/lib/slugify";

/** Vertical keys used for the per-vertical fallback artwork. */
export type VerticalMediaKey = "mithai" | "qsr" | "snacks" | "merch";

const VERTICAL_FALLBACK_IMAGE: Record<VerticalMediaKey, string | null> = {
  mithai: "/images/kaju-katli-box.jpg",
  qsr: "/images/gulab-jamun.jpg",
  snacks: "/images/besan-laddoo.jpg",
  merch: null,
};

// Known-name static artwork — keeps the grid anchored by photography while
// some seeded docs still lack uploaded media.
const FALLBACK_IMAGE_BY_SLUG: Record<string, string> = {
  "assorted-box": "/images/assorted-box.jpg",
  "badam-barfi": "/images/badam-barfi.jpg",
  "badam-burfi": "/images/badam-barfi.jpg",
  "besan-laddoo": "/images/besan-laddoo.jpg",
  "besan-laddu": "/images/besan-laddoo.jpg",
  "gulab-jamun": "/images/gulab-jamun.jpg",
  "ista-roll": "/images/ista-roll.jpg",
  "kaju-katli": "/images/kaju-katli.jpg",
  "kaju-katli-box": "/images/kaju-katli-box.jpg",
  "mango-peda": "/images/mango-peda.jpg",
  "motichoor-laddoo": "/images/motichoor-laddoo.jpg",
  "motichur-laddoo": "/images/motichoor-laddoo.jpg",
  rasgulla: "/images/rasgulla.jpg",
  rasmalai: "/images/rasmalai.jpg",
  "sugarfree-kaju": "/images/sugarfree-kaju.jpg",
};

/**
 * Pull the first media URL out of a doc, handling both the array shape
 * (mithai/snacks/merch/gifts: `images: [{image: {url}}]`) and the singular
 * shape (qsr: `image: {url}`).
 */
export function firstDocImage(
  doc: Record<string, unknown>,
  collection: string,
): string | null {
  if (collection === "qsr-menu-items") {
    const img = doc.image;
    if (img && typeof img === "object" && "url" in img) {
      return (img as {url?: string}).url ?? null;
    }
    return null;
  }
  const images = doc.images as Array<{image?: unknown} | null> | null;
  const image = images?.[0]?.image;
  if (image && typeof image === "object" && "url" in image) {
    return (image as {url?: string}).url ?? null;
  }
  return null;
}

/** Static-artwork fallback for a doc with no uploaded media (else null). */
export function fallbackDocImage(
  doc: Record<string, unknown>,
  vertical: VerticalMediaKey,
): string | null {
  const name =
    (doc.slug as string | undefined) ??
    (doc.name as string | undefined) ??
    (doc.title as string | undefined) ??
    "";
  return FALLBACK_IMAGE_BY_SLUG[slugify(name)] ?? VERTICAL_FALLBACK_IMAGE[vertical];
}
