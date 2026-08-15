// app/api/mobile/v1/catalog/snacks/[slug]/route.ts
// Snack detail. No `slug` field on the collection — URL identity is
// `slugify(name)`, computed server-side; lookup scans the collection
// (~39 docs) in memory. See qsr/[slug]/route.ts for the same tradeoff.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
// 7 ../ to repo root from app/api/mobile/v1/catalog/snacks/[slug]/
import config from '../../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { serializeSnack, slugify } from '../../../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { slug } = await params;
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: 'snack-products',
      limit: 500,
    });
    const doc = result.docs.find((d: any) => slugify(d.name ?? '') === slug);
    if (!doc) {
      throw new ApiError(ErrorCode.NOT_FOUND, `Snack "${slug}" not found`, { traceId });
    }

    return jsonResponse(serializeSnack(doc), {
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
