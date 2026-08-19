// app/api/mobile/v1/catalog/qsr/[slug]/route.ts
// QSR item detail. The collection has no `slug` field — URL identity is
// `slugify(name)`, generated server-side. Mongo can't query a computed
// transform, so this fetches the (small, ~33-doc) collection and matches
// in memory. First match wins; name collisions would need a real slug
// field on the collection later.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
// 7 ../ to repo root from app/api/mobile/v1/catalog/qsr/[slug]/
import config from '../../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { serializeQsrItem, slugify, type QsrMenuItemDoc } from '../../../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { slug } = await params;
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: 'qsr-menu-items',
      limit: 500,
    });
    const doc = (result.docs as QsrMenuItemDoc[]).find((d) => slugify(d.name ?? '') === slug);
    if (!doc) {
      throw new ApiError(ErrorCode.NOT_FOUND, `QSR item "${slug}" not found`, { traceId });
    }

    return jsonResponse(serializeQsrItem(doc), {
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
