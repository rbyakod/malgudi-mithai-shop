// app/api/mobile/v1/catalog/merch/route.ts
// Merchandise list for the apps' vertical tab. Public, unauthenticated.
// Enquiry-led vertical: `availability` defaults to enquiry-only, which the
// app uses to route to the leads form instead of a cart CTA. Optional
// `type` filter; ETag pattern mirrors catalog/products/route.ts.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import { createHash } from 'node:crypto';
// 6 ../ to repo root from app/api/mobile/v1/catalog/merch/
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { serializeMerch } from '../../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') ?? undefined;
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100);

    const payload = await getPayload({ config });

    const where: Record<string, any> = {};
    if (type) where.type = { equals: type };

    const result = await payload.find({
      collection: 'merch-products',
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
        items: result.docs.map(serializeMerch),
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
