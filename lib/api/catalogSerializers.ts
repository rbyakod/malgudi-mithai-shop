// lib/api/catalogSerializers.ts
// Shared catalog serializers for the mobile v1 API. Previously
// `serializeProduct` was duplicated between the products list and [slug]
// routes with a "keep them in sync" comment; the vertical routes (qsr,
// snacks, merch) and stories need the same image/Lexical flattening, so all
// of it lives here now.
//
// Conventions:
// - `images` is `[{ image: upload-ref }]` in Payload (qsr uses a singular
//   `image` upload); `image.url` is set when media is populated, otherwise
//   fall back to the ref id / bare string (seed/fixture shapes).
// - `story`/`body` are Lexical rich-text objects on scraped-catalog seeds or
//   plain strings on old fixtures — flattened via lib/api/richText.
// - qsr/snacks/merch have no `slug` field; their URL identity is
//   `slugify(name)`, matching the web storefront's routing.
import { flattenLexical } from './richText';

/** `Kaju Katli (500g)` → `kaju-katli-500g`. Mirrors the web PDP URL scheme. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical public origin for media URLs — same source as the web's
 * schema.org/sitemap helpers (lib/seo/schema.ts siteUrl).
 */
function mediaOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/**
 * Payload stores media `url` relative (`/api/media/file/<name>.jpg`). The web
 * resolves those against the page origin, but the apps' image loaders
 * (AsyncImage / Coil) require absolute URLs — a bare path fails silently.
 * Root site-relative paths at the site origin; anything else (absolute URLs,
 * the ref-id fallbacks below, data URLs) passes through untouched.
 */
export function absoluteMediaURL(url: string): string {
  return url.startsWith('/') ? `${mediaOrigin()}${url}` : url;
}

/** Upload-ref array → string[] (populated url → ref id → bare string). */
function flattenImages(images: unknown): string[] {
  return (Array.isArray(images) ? images : [])
    .map((i: any) => i?.image?.url ?? i?.image ?? i?.url ?? i)
    .filter((u: unknown): u is string => typeof u === 'string')
    .map(absoluteMediaURL);
}

/** Single upload field → string | null (qsr uses this shape). */
function flattenImage(image: unknown): string | null {
  const url = (image as any)?.url ?? image;
  return typeof url === 'string' && url.length > 0 ? absoluteMediaURL(url) : null;
}

// Shape mirrors collections/MithaiProducts.ts. `featured` drives the apps'
// "Best sellers" rail; `story` is flattened for the mobile contract.
export function serializeProduct(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    family: p.family,
    displayPrice: p.displayPrice ?? null,
    weight: p.weight ?? null,
    featured: p.featured === true,
    freshnessStatus: p.freshnessStatus ?? null,
    dietaryTags: p.dietaryTags ?? [],
    allergens: p.allergens ?? [],
    ingredients: p.ingredients ?? null,
    shelfLife: p.shelfLife ?? null,
    storage: p.storage ?? null,
    images: flattenImages(p.images),
    story: flattenLexical(p.story),
    karigar: typeof p.karigar === 'object' ? p.karigar?.id ?? null : p.karigar ?? null,
    updatedAt: p.updatedAt ?? null,
  };
}

// Shape mirrors collections/QsrMenuItems.ts. Counter-menu vertical: no price,
// no cart — walk-in only; `availableAtStores` is a plain store-slug list.
export function serializeQsrItem(d: any) {
  return {
    id: d.id,
    slug: slugify(d.name ?? ''),
    name: d.name,
    category: d.category ?? null,
    description: d.description ?? null,
    image: flattenImage(d.image),
    veg: d.veg ?? null,
    spiceLevel: d.spiceLevel ?? null,
    availableAtStores: d.availableAtStores ?? [],
    updatedAt: d.updatedAt ?? null,
  };
}

// Shape mirrors collections/SnackProducts.ts. Retail-only vertical: MSRP for
// display, purchases happen at external retailers.
export function serializeSnack(d: any) {
  return {
    id: d.id,
    slug: slugify(d.name ?? ''),
    name: d.name,
    category: d.category ?? null,
    description: d.description ?? null,
    images: flattenImages(d.images),
    weight: d.weight ?? null,
    msrp: d.msrp ?? null,
    retailers: (d.externalRetailers ?? []).map(
      (r: any) => ({ label: r?.label ?? '', url: r?.url ?? '' }),
    ).filter((r: { label: string; url: string }) => r.label && r.url),
    updatedAt: d.updatedAt ?? null,
  };
}

// Shape mirrors collections/MerchProducts.ts. Enquiry-led vertical;
// `availability: "enquiry-only"` routes the app UI to the leads form.
export function serializeMerch(d: any) {
  return {
    id: d.id,
    slug: slugify(d.name ?? ''),
    name: d.name,
    type: d.type ?? null,
    description: d.description ?? null,
    images: flattenImages(d.images),
    price: d.price ?? null,
    availability: d.availability ?? null,
    updatedAt: d.updatedAt ?? null,
  };
}

// Shape mirrors collections/Stories.ts. List projection — the [slug] route
// additionally flattens `body`.
export function serializeStory(s: any) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    pillar: s.pillar,
    excerpt: s.excerpt ?? null,
    heroImage: flattenImage(s.heroImage),
    publishedAt: s.publishedAt ?? null,
    updatedAt: s.updatedAt ?? null,
  };
}
