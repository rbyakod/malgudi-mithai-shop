// app/api/mobile/v1/catalog/products/[slug]/route.ts
// Product detail by slug. Public, unauthenticated. Single-doc fetch via
// Payload `find` with a `slug.equals` where clause (Payload has no
// `findBySlug` helper; the `slug` field is `unique: true` on the
// collection, so the result set is at most one).
//
// Serializer shape mirrors Task 3.1 (catalog list) field-for-field so
// clients can reuse one type. See collections/MithaiProducts.ts for the
// canonical schema; brief-specified fields like `tier`, `category`,
// `priceInPaise`, `stock`, `unit`, `freshnessDays`, `relatedProductIds`
// are NOT present on this collection and are intentionally omitted.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
// Path depth: app/api/mobile/v1/catalog/products/[slug]/ = 7 dirs -> 7 ../ to root.
import config from '../../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { serializeProduct, type MithaiProductDoc } from '../../../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { slug } = await params;
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: 'mithai-products',
      where: { slug: { equals: slug } },
      limit: 1,
    });

    if (!result.docs[0]) {
      throw new ApiError(ErrorCode.PRODUCT_NOT_FOUND, `Product "${slug}" not found`, { traceId });
    }

    return jsonResponse(serializeProduct(result.docs[0] as MithaiProductDoc), {
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
