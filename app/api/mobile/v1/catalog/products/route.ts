// app/api/mobile/v1/catalog/products/route.ts
// Catalog products list endpoint with ETag-based conditional GET.
// Public, unauthenticated. Filters map to Payload `where` clauses; the
// collection slug "mithai-products" is the stable contract (see
// collections/MithaiProducts.ts).
//
// ETag = SHA-1 of `id:updatedAt` joined list, wrapped in double quotes,
// truncated to 16 hex chars. If `If-None-Match` matches → 304.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import { createHash } from 'node:crypto';
// 6 ../ to repo root from app/api/mobile/v1/catalog/products/
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { flattenLexical } from '../../../../../../lib/api/richText';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const family = url.searchParams.get('family') ?? undefined;
    const freshnessStatus = url.searchParams.get('freshnessStatus') ?? undefined;
    const dietaryTags = url.searchParams.getAll('dietaryTags');
    const q = url.searchParams.get('q') ?? undefined;
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100);

    const payload = await getPayload({ config });

    // Build Payload `where` clause. Use `any` because Payload's `Where`
    // type is a discriminated union that rejects plain object literals.
    const where: Record<string, any> = {};
    if (family) where.family = { equals: family };
    if (freshnessStatus) where.freshnessStatus = { equals: freshnessStatus };
    if (dietaryTags.length) where.dietaryTags = { in: dietaryTags };
    if (q) where.name = { contains: q };

    const result = await payload.find({
      collection: 'mithai-products',
      where,
      page,
      limit: pageSize,
      sort: '-updatedAt',
    });

    const etagInput = result.docs.map((d: any) => `${d.id}:${d.updatedAt ?? ''}`).join('|');
    const etag = '"' + createHash('sha1').update(etagInput).digest('hex').slice(0, 16) + '"';
    if (req.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return jsonResponse(
      {
        items: result.docs.map(serializeProduct),
        total: result.totalDocs,
        page: result.page,
        pageSize: result.limit,
      },
      { headers: { ETag: etag, 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}

// Shape mirrors collections/MithaiProducts.ts. `images` is an array of
// `{ image: upload-ref }` in Payload; `image.url` is populated when the
// referenced media doc is populated, otherwise we fall back to the ref id.
// Bare-string fallback guards against seed/fixture shapes. `story` is a
// Lexical rich-text object on Payload lexical fields (scraped-catalog seed)
// or a plain string (old fixtures) — flattened for the mobile contract.
function serializeProduct(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    family: p.family,
    displayPrice: p.displayPrice ?? null,
    freshnessStatus: p.freshnessStatus ?? null,
    dietaryTags: p.dietaryTags ?? [],
    allergens: p.allergens ?? [],
    ingredients: p.ingredients ?? null,
    shelfLife: p.shelfLife ?? null,
    storage: p.storage ?? null,
    images: (p.images ?? [])
      .map((i: any) => i?.image?.url ?? i?.image ?? i?.url ?? i)
      .filter((u: unknown): u is string => typeof u === 'string'),
    story: flattenLexical(p.story),
    karigar: typeof p.karigar === 'object' ? p.karigar?.id ?? null : p.karigar ?? null,
    updatedAt: p.updatedAt ?? null,
  };
}
