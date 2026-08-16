// app/api/mobile/v1/reviews/route.ts
// Authenticated review capture — conversion batch, Batch A (A4).
//
// POST upserts ONE review per (customer, product):
//   - zod-validated body {productId, rating 1-5, body?, authorName?},
//   - product must exist (404 PRODUCT_NOT_FOUND otherwise),
//   - verifiedPurchase is SERVER-STAMPED: true + linked order when the
//     customer has a delivered order containing that productId (most
//     recent first),
//   - an existing (customer, product) row is updated in place (rating/
//     body/authorName/verified stamp); moderation status is never touched
//     here — admin owns it,
//   - the collection itself blocks create (access: create => false), so
//     rows can only be born through this validated path.
//
// No public read/display yet — see collections/Reviews.ts.
//
// Path depth: app/api/mobile/v1/reviews/ = 5 dirs -> 5 `../` to root.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../lib/api/errors';
import { requireCustomer } from '../../../../../lib/api/authMiddleware';

const Body = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().min(1).max(2000).optional(),
  authorName: z.string().min(1).max(120).optional(),
});

interface ReviewDoc {
  id: string;
  status?: string;
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid review body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { productId, rating, body, authorName } = parsed.data;

    const payload = await getPayload({ config });

    // Product must still exist. overrideAccess + depth: 0 — the
    // products collection has no public read config and a populated
    // relation shape would differ from the plain id we stamp.
    let product: { id: string } | null;
    try {
      product = (await payload.findByID({
        collection: 'mithai-products',
        id: productId,
        overrideAccess: true,
        depth: 0,
      })) as { id: string } | null;
    } catch {
      product = null;
    }
    if (!product) {
      throw new ApiError(
        ErrorCode.PRODUCT_NOT_FOUND,
        `Product ${productId} is no longer available`,
      );
    }

    // Verified-purchase stamp: newest delivered order containing the
    // product. Local-API find bypasses collection access by default; the
    // customerId scoping below is the authorization.
    const deliveredWith = await payload.find({
      collection: 'orders',
      where: {
        and: [
          { customerId: { equals: customerId } },
          { status: { equals: 'delivered' } },
          { 'items.productId': { equals: productId } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    });
    const verifiedOrder = deliveredWith.docs[0] as { id: string } | undefined;

    // Upsert: one review per (customer, product).
    const existing = await payload.find({
      collection: 'reviews',
      where: {
        and: [
          { customer: { equals: customerId } },
          { product: { equals: productId } },
        ],
      },
      limit: 1,
      depth: 0,
    });
    const existingRow = existing.docs[0] as ReviewDoc | undefined;

    const data = {
      product: productId,
      customer: customerId,
      authorName: authorName ?? null,
      rating,
      body: body ?? null,
      order: verifiedOrder ? verifiedOrder.id : null,
      verifiedPurchase: Boolean(verifiedOrder),
    };

    let reviewId: string;
    let created: boolean;
    if (existingRow) {
      await payload.update({
        collection: 'reviews',
        id: existingRow.id,
        data,
      });
      reviewId = existingRow.id;
      created = false;
    } else {
      const row = (await payload.create({
        collection: 'reviews',
        data: { ...data, status: 'pending' },
      })) as ReviewDoc;
      reviewId = row.id;
      created = true;
    }

    return jsonResponse(
      {
        id: reviewId,
        productId,
        rating,
        body: body ?? null,
        authorName: authorName ?? null,
        verifiedPurchase: Boolean(verifiedOrder),
        orderId: verifiedOrder?.id ?? null,
        status: existingRow ? existingRow.status ?? 'pending' : 'pending',
        created,
      },
      { status: created ? 201 : 200, headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
