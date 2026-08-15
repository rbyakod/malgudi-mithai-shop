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

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const payload = await getPayload({ config });
    const global = await payload.findGlobal({ slug: 'home-hero' } as any);
    const autoplayMs = clampAutoplayMs((global as any)?.autoplayMs);
    const rows: any[] = Array.isArray((global as any)?.slides) ? (global as any).slides : [];

    const slides = (
      await Promise.all(
        rows.map(async (row) => {
          const collection = row?.product?.relationTo;
          const id = row?.product?.value;
          const vertical = VERTICAL_BY_COLLECTION[collection ?? ''];
          if (!collection || !id || !vertical) return null;

          let doc: any;
          try {
            doc = await payload.findByID({ collection, id, draft: false });
          } catch {
            return null;
          }
          if (!doc || doc._status === 'draft' || !doc.slug) return null;

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
            slug: String(doc.slug),
            name: String(row.captionOverride?.trim() || doc.name || ''),
            priceLabel,
            imageURL: String(media.url),
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
