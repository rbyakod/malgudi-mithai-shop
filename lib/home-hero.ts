// lib/home-hero.ts
// Server-only. Reads the `home-hero` Payload global, resolves each
// polymorphic relationship into a flat Slide shape that the client
// HeroRotator can render without knowing anything about Payload.
//
// Image field shape differs per collection:
//   - mithai-products, snack-products, merch-products, gift-boxes:
//     `images: [{image: {url, alt}}]` (array, take [0])
//   - qsr-menu-items: `image: {url, alt}` (single)
//
// Price field differs per collection:
//   - mithai-products.displayPrice (string)
//   - merch-products.price (string)
//   - qsr-menu-items / snack-products / gift-boxes: undefined
//
// href is built from collection slug prefix + product.slug:
//   mithai-products -> /mithai/<slug>
//   qsr-menu-items  -> /qsr/<slug>
//   snack-products  -> /snacks/<slug>
//   merch-products  -> /merch/<slug>
//   gift-boxes      -> /build-a-gift/<slug>   (gift-boxes are showcased
//                                                inside build-a-gift flow)
//
// All 5 hero collections have localized `name` (and some have localized
// `description`/`story`). Pass the request locale so slide names + captions
// match the surrounding page. The `home-hero` global itself has no
// localized fields (autoplayMs + captionOverride are locale-agnostic) so
// findGlobal needs no locale arg.
//
// Any error → empty result. BrandHero falls back to static layout.
import { getPayload } from "@/lib/payload-client";
import { slugify } from "@/lib/api/catalogSerializers";

export type Slide = {
  id: string;
  collection: string;
  name: string;
  priceLabel?: string;
  image: string;
  imageAlt: string;
  href: string;
};

export type HomeHeroData = {
  slides: Slide[];
  autoplayMs: number;
};

const DEFAULT_AUTOPLAY_MS = 5000;
const AUTOPLAY_MIN = 3000;
const AUTOPLAY_MAX = 15000;

type PolymorphicRef = {
  relationTo: string;
  value: string | { id: string | number };
};

type GlobalRow = {
  product?: PolymorphicRef;
  captionOverride?: string;
};

type HomeHeroGlobal = {
  slides?: GlobalRow[];
  autoplayMs?: number | null;
};

const HREF_PREFIX: Record<string, string> = {
  "mithai-products": "/mithai",
  "qsr-menu-items": "/qsr",
  "snack-products": "/snacks",
  "merch-products": "/merch",
  "gift-boxes": "/build-a-gift",
};

// Minimal Payload SDK types for our usage.
type PayloadSDK = {
  findByID(params: {
    collection: string;
    id: string;
    locale?: string;
  }): Promise<PayloadDoc>;
  findGlobal(params: { slug: string }): Promise<HomeHeroGlobal>;
};

type PayloadDoc = {
  id: string | number;
  name?: string;
  slug?: string;
  _status?: "published" | "draft";
  displayPrice?: string;
  price?: string;
  images?: Array<{ image?: { url?: string; alt?: string } }>;
  image?: { url?: string; alt?: string };
};

type MediaResult = {
  url: string;
  alt: string;
};

function readImageAndAlt(doc: PayloadDoc, collection: string): MediaResult | null {
  if (collection === "qsr-menu-items") {
    const img = doc.image;
    if (!img?.url) return null;
    return { url: img.url, alt: img.alt || doc.name || "" };
  }
  const arr = Array.isArray(doc.images) ? doc.images : [];
  const first = arr[0]?.image;
  if (!first?.url) return null;
  return { url: first.url, alt: first.alt || doc.name || "" };
}

function readPriceLabel(doc: PayloadDoc, collection: string): string | undefined {
  if (collection === "mithai-products") return doc.displayPrice || undefined;
  if (collection === "merch-products") return doc.price || undefined;
  return undefined;
}

function clampAutoplayMs(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_AUTOPLAY_MS;
  }
  return Math.min(AUTOPLAY_MAX, Math.max(AUTOPLAY_MIN, Math.round(value)));
}

async function resolveOne(
  payload: PayloadSDK,
  row: GlobalRow,
  locale: string | undefined
): Promise<Slide | null> {
  if (!row.product?.relationTo || !row.product?.value) return null;
  const { relationTo: collection, value } = row.product;
  // findGlobal populates polymorphic relationships — value arrives as the
  // FULL product doc, not the bare id (Payload populates to depth 2 by
  // default on every read path). Passing the doc to findByID throws and
  // the slide silently dropped, so the carousel never rendered despite a
  // curated global. Accept both shapes.
  const id = typeof value === "object" && value !== null ? String(value.id) : value;

  let doc: PayloadDoc;
  try {
    doc = await payload.findByID({
      collection: collection,
      id,
      ...(locale ? { locale } : {}),
    });
  } catch {
    return null;
  }
  if (!doc || doc._status === "draft") return null;

  const media = readImageAndAlt(doc, collection);
  if (!media) return null;

  const prefix = HREF_PREFIX[collection];
  // Only mithai-products carries a `slug` field; the other hero collections
  // derive theirs from the name (the catalog serializers' rule). Without the
  // derivation, any non-mithai slide was silently dropped.
  const slug = doc.slug || slugify(String(doc.name ?? ""));
  if (!prefix || !slug) return null;

  return {
    id: String(doc.id ?? id),
    collection,
    name: row.captionOverride?.trim() || String(doc.name ?? ""),
    priceLabel: readPriceLabel(doc, collection),
    image: media.url,
    imageAlt: media.alt,
    href: `${prefix}/${slug}`,
  };
}

export async function resolveHomeHeroSlides(
  locale?: string
): Promise<HomeHeroData> {
  let payload: PayloadSDK;
  try {
    payload = await getPayload();
  } catch {
    return { slides: [], autoplayMs: DEFAULT_AUTOPLAY_MS };
  }

  let global: HomeHeroGlobal;
  try {
    global = await payload.findGlobal({ slug: "home-hero" });
  } catch {
    return { slides: [], autoplayMs: DEFAULT_AUTOPLAY_MS };
  }

  const autoplayMs = clampAutoplayMs(global?.autoplayMs);
  const rows = Array.isArray(global?.slides) ? global.slides : [];
  if (rows.length === 0) {
    return { slides: [], autoplayMs };
  }

  const settled = await Promise.all(
    rows.map((row) => resolveOne(payload, row, locale))
  );
  const slides = settled.filter((s): s is Slide => s !== null);
  return { slides, autoplayMs };
}
