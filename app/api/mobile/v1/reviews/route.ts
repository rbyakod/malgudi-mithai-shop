// app/api/mobile/v1/reviews/route.ts
// Review capture + public display — conversion batch, Batch A (A4) +
// known-gaps campaign B10 (public GET).
//
// POST (authenticated) upserts ONE review per (customer, product):
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
// GET (unauthenticated, B10) is the filtered public view for a product:
//   - ?productId= required; page/pageSize (default 1/20, cap 50),
//   - APPROVED rows only, newest first,
//   - PublicReview carries a DISPLAY NAME only — authorName when captured,
//     else the customer's saved name; never customer ids, phones, or
//     emails. Depth stays 0; missing names resolve through one batched
//     customers lookup,
//   - averageRating is the mean over the product's approved ratings
//     (null when there are none). Payload has no aggregate API, so it is
//     computed from up to the first 1000 approved rows — per-product
//     counts are tens today; revisit if a product ever crosses that.
//     The collection stays admin-read; the route's explicit status filter
//     IS the public view (overrideAccess on the local API).
//
// Path depth: app/api/mobile/v1/reviews/ = 5 dirs -> 5 `../` to root.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import type { Where } from 'payload';
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

// ---- GET: public, approved-only product reviews (B10) ----------------------

const Query = z.object({
  productId: z.string().min(1),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

type PublicReview = {
  id: string;
  rating: number;
  body: string | null;
  authorDisplayName: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      productId: url.searchParams.get('productId') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid reviews query', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { productId } = parsed.data;
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.pageSize ?? 20;

    const payload = await getPayload({ config });

    const approvedWhere: Where = {
      and: [
        { product: { equals: productId } },
        { status: { equals: 'approved' } },
      ],
    };

    const result = await payload.find({
      collection: 'reviews',
      where: approvedWhere,
      sort: '-createdAt',
      page,
      limit: pageSize,
      // The collection is admin-read; this route's explicit status filter
      // is the public view (see file header). depth 0 keeps relations as
      // plain ids so nothing beyond the display name can leak.
      overrideAccess: true,
      depth: 0,
    });

    type ReviewRow = {
      id: string;
      rating: number;
      body: string | null;
      authorName: string | null;
      customer: unknown;
      verifiedPurchase: boolean;
      createdAt: string;
    };
    const rows = result.docs as unknown as ReviewRow[];

    // Display name: captured authorName, else the customer's saved name.
    // One batched lookup; PublicReview never carries the customer id.
    const missingNameIds = [
      ...new Set(
        rows
          .filter((r) => !r.authorName && typeof r.customer === 'string')
          .map((r) => r.customer as string),
      ),
    ];
    const customerNames = new Map<string, string>();
    if (missingNameIds.length > 0) {
      const customers = await payload.find({
        collection: 'customers',
        where: { id: { in: missingNameIds } },
        limit: missingNameIds.length,
        overrideAccess: true,
        depth: 0,
      });
      for (const doc of customers.docs as Array<{ id: string; name?: string | null }>) {
        if (doc.name) customerNames.set(doc.id, doc.name);
      }
    }

    const items: PublicReview[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body ?? null,
      authorDisplayName:
        r.authorName ??
        (typeof r.customer === 'string' ? customerNames.get(r.customer) ?? null : null),
      verifiedPurchase: Boolean(r.verifiedPurchase),
      createdAt: r.createdAt,
    }));

    // Average over ALL approved ratings for the product (not just the
    // page). Computed from up to 1000 rows — see file header.
    let averageRating: number | null = null;
    if (result.totalDocs > 0) {
      const aggregate = await payload.find({
        collection: 'reviews',
        where: approvedWhere,
        limit: Math.min(Math.max(result.totalDocs, 1), 1000),
        overrideAccess: true,
        depth: 0,
      });
      const ratings = (aggregate.docs as unknown as Array<{ rating: number }>).map(
        (d) => d.rating,
      );
      if (ratings.length > 0) {
        averageRating =
          Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
      }
    }

    return jsonResponse(
      {
        items,
        averageRating,
        total: result.totalDocs,
        page,
        pageSize,
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
