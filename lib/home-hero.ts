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
// Any error → empty array. BrandHero falls back to static layout.
import { getPayload } from "@/lib/payload-client";

export type Slide = {
  id: string;
  collection: string;
  name: string;
  priceLabel?: string;
  image: string;
  imageAlt: string;
  href: string;
};

type PolymorphicRef = {
  relationTo: string;
  value: string;
};

type GlobalRow = {
  product?: PolymorphicRef;
  captionOverride?: string;
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
  findByID(params: { collection: string; id: string }): Promise<PayloadDoc>;
  findGlobal(params: { slug: string }): Promise<{ slides?: GlobalRow[] }>;
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

async function resolveOne(
  payload: PayloadSDK,
  row: GlobalRow
): Promise<Slide | null> {
  if (!row.product?.relationTo || !row.product?.value) return null;
  const { relationTo: collection, value: id } = row.product;

  let doc: PayloadDoc;
  try {
    doc = await payload.findByID({ collection: collection, id });
  } catch {
    return null;
  }
  if (!doc || doc._status === "draft") return null;

  const media = readImageAndAlt(doc, collection);
  if (!media) return null;

  const prefix = HREF_PREFIX[collection];
  if (!prefix || !doc.slug) return null;

  return {
    id: String(doc.id ?? id),
    collection,
    name: row.captionOverride?.trim() || String(doc.name ?? ""),
    priceLabel: readPriceLabel(doc, collection),
    image: media.url,
    imageAlt: media.alt,
    href: `${prefix}/${doc.slug}`,
  };
}

export async function resolveHomeHeroSlides(): Promise<Slide[]> {
  let payload: PayloadSDK;
  try {
    payload = await getPayload();
  } catch {
    return [];
  }

  let global: { slides?: GlobalRow[] };
  try {
    global = await payload.findGlobal({ slug: "home-hero" });
  } catch {
    return [];
  }

  const rows = Array.isArray(global?.slides) ? global.slides : [];
  if (rows.length === 0) return [];

  const settled = await Promise.all(
    rows.map((row) => resolveOne(payload, row))
  );
  return settled.filter((s): s is Slide => s !== null);
}
