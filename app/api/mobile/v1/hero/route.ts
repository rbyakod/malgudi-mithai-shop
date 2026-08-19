// app/api/mobile/v1/hero/route.ts
// Home hero slides for the apps — the same `home-hero` global the web's
// BrandHero/HeroRotator renders (globals/HomeHero.ts). Editors curate one
// list; every surface honors it. Each slide resolves its polymorphic
// product relationship server-side and is mapped to the mobile shape:
// `vertical` + `slug` is the apps' deep-link vocabulary (Route.productDetail
// / Route.verticalDetail on iOS, Routes.product/vertical detail on Android).
//
// Differences from the web resolver (lib/home-hero.ts):
//   - gift-boxes slides are SKIPPED — the apps have no gift-box surface;
//     the web routes them into /build-a-gift. Revisit if the apps grow one.
//   - no href — the apps navigate by vertical + slug, not URL prefix.
// Draft products and products without an image/slug are silently dropped
// (same rules as the web: a slide that can't render is not a slide).
//
// Empty global → `{slides: [], autoplayMs}` — the apps keep their local
// fallback hero (first featured product), so the screen never goes blank.
// ETag pattern mirrors catalog/products (SHA-1 of `id:updatedAt` joined,
// quoted, 16 hex chars; If-None-Match → 304).
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import { createHash } from 'node:crypto';
// 5 ../ to repo root from app/api/mobile/v1/hero/
import config from '../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { absoluteMediaURL, slugify } from '../../../../../lib/api/catalogSerializers';

/** App vertical for each hero-eligible collection. Gift boxes: see header. */
const VERTICAL_BY_COLLECTION: Record<string, string> = {
  'mithai-products': 'mithai',
  'qsr-menu-items': 'qsr',
  'snack-products': 'snacks',
  'merch-products': 'merch',
};

const DEFAULT_AUTOPLAY_MS = 5000;
const AUTOPLAY_MIN = 3000;
const AUTOPLAY_MAX = 15000;

function clampAutoplayMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_AUTOPLAY_MS;
  return Math.min(AUTOPLAY_MAX, Math.max(AUTOPLAY_MIN, Math.round(value)));
}

type HeroSlide = {
  id: string;
  vertical: string;
  slug: string;
  name: string;
  priceLabel?: string;
  imageURL: string;
  imageAlt: string;
};

/**
 * One `home-hero` slide row as stored on the global (globals/HomeHero.ts):
 * a polymorphic product relationship (populated doc or bare ref id — the
 * normalization comment below covers both) plus an optional caption.
 */
interface HeroGlobalSlide {
  product?: {
    relationTo?: string;
    value?: { id?: string | number } | string | number | null;
  } | null;
  captionOverride?: string | null;
}

/**
 * Wide read-shape of a hero-eligible product doc (mithai/qsr/snacks/merch
 * each fill a subset — only the fields the slide projection touches).
 */
interface HeroDoc {
  id?: string | number;
  name?: string | null;
  slug?: string | null;
  _status?: string;
  displayPrice?: string | null;
  price?: string | null;
  image?: { url?: unknown; alt?: unknown } | null;
  images?: { image?: { url?: unknown; alt?: unknown } | null }[];
}

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const payload = await getPayload({ config });
    const global = await payload.findGlobal({ slug: 'home-hero' });
    const autoplayMs = clampAutoplayMs(global?.autoplayMs);
    const rows: HeroGlobalSlide[] = Array.isArray(global?.slides)
      ? (global.slides as HeroGlobalSlide[])
      : [];

    const slides = (
      await Promise.all(
        rows.map(async (row) => {
          const collection = row?.product?.relationTo;
          // findGlobal populates polymorphic relationships — value arrives
          // as the FULL product doc, not the bare id (verified live: REST
          // /api/globals/home-hero returns a dict at default depth). Passing
          // the doc to findByID throws and every slide silently dropped —
          // the carousel never rendered on any surface. Normalize both
          // shapes before the draft:false re-read.
          const rawValue = row?.product?.value;
          const id = rawValue && typeof rawValue === 'object' ? rawValue.id : rawValue;
          const vertical = VERTICAL_BY_COLLECTION[collection ?? ''];
          if (!collection || !id || !vertical) return null;

          let doc: HeroDoc;
          try {
            doc = (await payload.findByID({ collection, id, draft: false })) as HeroDoc;
          } catch {
            return null;
          }
          // Only mithai-products carries a `slug` field; snacks/qsr/merch
          // derive theirs from the name (catalogSerializers' rule). Without
          // the derivation, any non-mithai slide was silently dropped.
          const slug = doc?.slug || (doc?.name ? slugify(String(doc.name)) : '');
          if (!doc || doc._status === 'draft' || !slug) return null;

          // Image field shape differs per collection (see lib/home-hero.ts).
          const media =
            collection === 'qsr-menu-items'
              ? doc.image
              : Array.isArray(doc.images)
                ? doc.images[0]?.image
                : undefined;
          if (!media?.url) return null;

          const priceLabel =
            collection === 'mithai-products'
              ? doc.displayPrice || undefined
              : collection === 'merch-products'
                ? doc.price || undefined
                : undefined;

          const slide: HeroSlide = {
            id: String(doc.id ?? id),
            vertical,
            slug: String(slug),
            name: String(row.captionOverride?.trim() || doc.name || ''),
            priceLabel,
            // Apps' image loaders need absolute URLs (relative /api/media
            // paths resolve only in a browser) — catalogSerializers' rule.
            imageURL: absoluteMediaURL(String(media.url)),
            imageAlt: String(media.alt || doc.name || ''),
          };
          return slide;
        }),
      )
    ).filter((s): s is HeroSlide => s !== null);

    // ETag over the resolved slides: an admin reorder or caption tweak on an
    // otherwise-unchanged product still changes the payload (name is part of
    // the input only via caption — updatedAt covers product edits).
    const etagInput = slides.map((s) => `${s.id}:${s.vertical}:${s.slug}:${s.name}`).join('|');
    const etag = '"' + createHash('sha1').update(etagInput).digest('hex').slice(0, 16) + '"';
    if (req.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return jsonResponse(
      { slides, autoplayMs },
      { headers: { ETag: etag, 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
