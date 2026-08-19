// app/api/mobile/v1/catalog/qsr/route.ts
// QSR counter-menu list for the apps' vertical tab. Public, unauthenticated.
// Walk-in vertical: no price, no cart. Optional `category` filter (dosa,
// chaat, …); ETag pattern mirrors catalog/products/route.ts.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import type { Where } from 'payload';
import { createHash } from 'node:crypto';
// 6 ../ to repo root from app/api/mobile/v1/catalog/qsr/
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { serializeQsrItem, type QsrMenuItemDoc } from '../../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') ?? undefined;
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100);

    const payload = await getPayload({ config });

    const where: Where = {};
    if (category) where.category = { equals: category };

    const result = await payload.find({
      collection: 'qsr-menu-items',
      where,
      page,
      limit: pageSize,
      sort: '-updatedAt',
    });

    const etagInput = result.docs.map((d) => `${d.id}:${d.updatedAt ?? ''}`).join('|');
    const etag = '"' + createHash('sha1').update(etagInput).digest('hex').slice(0, 16) + '"';
    if (req.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return jsonResponse(
      {
        items: (result.docs as QsrMenuItemDoc[]).map(serializeQsrItem),
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
