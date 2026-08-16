import { describe, it, expect, beforeEach, vi } from 'vitest';

// Path depth: app/api/mobile/v1/reviews/ = 5 dirs -> 5 ../ to root.

// Review capture (A4): upsert one review per (customer, product),
// server-stamped verifiedPurchase from delivered orders, zod-validated.

const { stores, jwtVerify } = vi.hoisted(() => ({
  stores: {
    'mithai-products': new Map<string, Record<string, unknown>>(),
    orders: new Map<string, Record<string, unknown>>(),
    reviews: new Map<string, Record<string, unknown>>(),
  },
  jwtVerify: vi.fn(async () => ({ customerId: 'cust-1', jti: 'jti-1' })),
}));

let seq = 0;
const nextId = () => `rev-${++seq}`;

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: string }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        if (collection === 'mithai-products') return col.get(id) ?? null;
        return col?.get(id) ?? null;
      },
    ),
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: Record<string, unknown>;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const all = col ? Array.from(col.values()) : [];
        const clauses =
          (where as { and?: Array<Record<string, unknown>> })?.and ?? (where ? [where] : []);
        const docs = all.filter((d) =>
          clauses.every((clause) =>
            Object.entries(clause).every(([field, cond]) => {
              const eq = (cond as { equals?: unknown }).equals;
              // Dot-notation match for array subfields (items.productId):
              // a doc matches when ANY array element's subfield equals.
              if (field.includes('.')) {
                const [arrayField, sub] = field.split('.');
                const arr = d[arrayField];
                if (!Array.isArray(arr)) return false;
                return arr.some((el) => (el as Record<string, unknown>)?.[sub] === eq);
              }
              return eq !== undefined ? d[field] === eq : true;
            }),
          ),
        );
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(
      async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const id = nextId();
        const doc = { id, ...data, createdAt: new Date().toISOString() };
        (stores as Record<string, Map<string, Record<string, unknown>>>)[collection].set(id, doc);
        return doc;
      },
    ),
    update: vi.fn(
      async ({
        collection,
        id,
        data,
      }: {
        collection: string;
        id: string;
        data: Record<string, unknown>;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const doc = col.get(id);
        if (!doc) throw new Error('missing');
        const merged = { ...doc, ...data };
        col.set(id, merged);
        return merged;
      },
    ),
  })),
}));

vi.mock('../../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it
// (this route reads no config fields).
vi.mock('../../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../../lib/container', () => ({
  container: { jwtService: { verify: jwtVerify } },
}));

import type { NextRequest } from 'next/server';
import { POST } from './route';

// The route types its arg as NextRequest; tests build plain Requests.
function asReq(req: Request): NextRequest {
  return req as unknown as NextRequest;
}

const PRODUCT = 'p1';

function authedReq(body: unknown): Request {
  return new Request('http://localhost/api/mobile/v1/reviews', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer fake-access-token',
    },
    body: JSON.stringify(body),
  });
}

function seedProduct() {
  stores['mithai-products'].set(PRODUCT, { id: PRODUCT, slug: 'kaju-katli', name: 'Kaju Katli' });
}

function seedDeliveredOrder(orderId: string, productIds: string[], status = 'delivered') {
  stores.orders.set(orderId, {
    id: orderId,
    customerId: 'cust-1',
    status,
    items: productIds.map((productId) => ({ productId, quantity: 1 })),
  });
}

describe('POST /reviews', () => {
  beforeEach(() => {
    stores['mithai-products'].clear();
    stores.orders.clear();
    stores.reviews.clear();
    seq = 0;
    seedProduct();
  });

  it('creates a review with 201 and stamps verifiedPurchase from a delivered order', async () => {
    seedDeliveredOrder('o-1', [PRODUCT]);
    const res = await POST(asReq(authedReq({ productId: PRODUCT, rating: 5, body: 'Superb' })));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({
      productId: PRODUCT,
      rating: 5,
      body: 'Superb',
      verifiedPurchase: true,
      orderId: 'o-1',
      status: 'pending',
      created: true,
    });
    // The stored row links the order + the customer/product pair.
    expect(stores.reviews.size).toBe(1);
    const row = Array.from(stores.reviews.values())[0]!;
    expect(row).toMatchObject({
      product: PRODUCT,
      customer: 'cust-1',
      verifiedPurchase: true,
      order: 'o-1',
      status: 'pending',
    });
  });

  it('upserts: a second review for the same (customer, product) updates, never duplicates', async () => {
    const res1 = await POST(asReq(authedReq({ productId: PRODUCT, rating: 3 })));
    expect(res1.status).toBe(201);

    const res2 = await POST(asReq(authedReq({ productId: PRODUCT, rating: 4, body: 'Better now' })));
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.data.created).toBe(false);
    expect(body2.data.rating).toBe(4);

    expect(stores.reviews.size).toBe(1);
    const row = Array.from(stores.reviews.values())[0]!;
    expect(row.rating).toBe(4);
    expect(row.body).toBe('Better now');
  });

  it('keeps moderation status untouched on update', async () => {
    await POST(asReq(authedReq({ productId: PRODUCT, rating: 3 })));
    // Admin approves the row out-of-band.
    const row = Array.from(stores.reviews.values())[0]!;
    row.status = 'approved';

    await POST(asReq(authedReq({ productId: PRODUCT, rating: 4 })));
    expect(Array.from(stores.reviews.values())[0]!.status).toBe('approved');
  });

  it('leaves verifiedPurchase false (and order null) without a delivered order containing the product', async () => {
    // Delivered order for a DIFFERENT product + a non-delivered order for
    // this product — neither qualifies.
    seedDeliveredOrder('o-other', ['p2']);
    seedDeliveredOrder('o-pending', [PRODUCT], 'confirmed');

    const res = await POST(asReq(authedReq({ productId: PRODUCT, rating: 4 })));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.verifiedPurchase).toBe(false);
    expect(body.data.orderId).toBeNull();
    expect(Array.from(stores.reviews.values())[0]!.verifiedPurchase).toBe(false);
  });

  it('returns 404 PRODUCT_NOT_FOUND when the product no longer exists', async () => {
    const res = await POST(asReq(authedReq({ productId: 'gone', rating: 5 })));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(stores.reviews.size).toBe(0);
  });

  it('returns 422 VALIDATION for a rating outside 1-5', async () => {
    const tooHigh = await POST(asReq(authedReq({ productId: PRODUCT, rating: 6 })));
    expect(tooHigh.status).toBe(422);
    expect((await tooHigh.json()).error.code).toBe('VALIDATION');

    const zero = await POST(asReq(authedReq({ productId: PRODUCT, rating: 0 })));
    expect(zero.status).toBe(422);

    const missing = await POST(asReq(authedReq({ rating: 4 })));
    expect(missing.status).toBe(422);
    expect(stores.reviews.size).toBe(0);
  });

  it('returns 401 when auth is missing', async () => {
    const req = new Request('http://localhost/api/mobile/v1/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: PRODUCT, rating: 5 }),
    });
    const res = await POST(asReq(req));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('TOKEN_EXPIRED');
  });

  it('saves an optional authorName for display', async () => {
    const res = await POST(
      asReq(authedReq({ productId: PRODUCT, rating: 5, authorName: 'Ravi B.' })),
    );
    const body = await res.json();
    expect(body.data.authorName).toBe('Ravi B.');
    expect(Array.from(stores.reviews.values())[0]!.authorName).toBe('Ravi B.');
  });
});
