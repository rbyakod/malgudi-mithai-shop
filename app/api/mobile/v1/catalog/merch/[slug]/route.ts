// app/api/mobile/v1/catalog/merch/[slug]/route.ts
// Merch detail. No `slug` field on the collection — URL identity is
// `slugify(name)`, computed server-side; lookup scans the collection
// in memory. See qsr/[slug]/route.ts for the same tradeoff.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
// 7 ../ to repo root from app/api/mobile/v1/catalog/merch/[slug]/
import config from '../../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { serializeMerch, slugify, type MerchProductDoc } from '../../../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { slug } = await params;
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: 'merch-products',
      limit: 500,
    });
    const doc = (result.docs as MerchProductDoc[]).find((d) => slugify(d.name ?? '') === slug);
    if (!doc) {
      throw new ApiError(ErrorCode.NOT_FOUND, `Merch item "${slug}" not found`, { traceId });
    }

    return jsonResponse(serializeMerch(doc), {
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
