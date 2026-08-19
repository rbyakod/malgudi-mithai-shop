import { describe, it, expect, beforeEach, vi } from 'vitest';

// Path depth: app/api/mobile/v1/reviews/ = 5 dirs -> 5 ../ to root.

// Review capture (A4): upsert one review per (customer, product),
// server-stamped verifiedPurchase from delivered orders, zod-validated.

const { stores, jwtVerify } = vi.hoisted(() => ({
  stores: {
    'mithai-products': new Map<string, Record<string, unknown>>(),
    orders: new Map<string, Record<string, unknown>>(),
    reviews: new Map<string, Record<string, unknown>>(),
    customers: new Map<string, Record<string, unknown>>(),
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
        sort,
        page,
        limit,
      }: {
        collection: string;
        where?: Record<string, unknown>;
        sort?: string;
        page?: number;
        limit?: number;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const all = col ? Array.from(col.values()) : [];
        const clauses =
          (where as { and?: Array<Record<string, unknown>> })?.and ?? (where ? [where] : []);
        const docs = all.filter((d) =>
          clauses.every((clause) =>
            Object.entries(clause).every(([field, cond]) => {
              const eq = (cond as { equals?: unknown }).equals;
              const inList = (cond as { in?: unknown[] }).in;
              // Dot-notation match for array subfields (items.productId):
              // a doc matches when ANY array element's subfield equals.
              if (field.includes('.')) {
                const [arrayField, sub] = field.split('.');
                const arr = d[field.split('.')[0]];
                if (!Array.isArray(arr)) return false;
                return arr.some((el) => (el as Record<string, unknown>)?.[sub] === eq);
              }
              if (inList !== undefined) return inList.includes(d[field]);
              return eq !== undefined ? d[field] === eq : true;
            }),
          ),
        );
        if (sort === '-createdAt') {
          docs.sort(
            (a, b) =>
              Date.parse(String(b.createdAt ?? 0)) - Date.parse(String(a.createdAt ?? 0)),
          );
        }
        const total = docs.length;
        const pageLimit = limit ?? total;
        const pageNo = page ?? 1;
        return {
          docs: docs.slice((pageNo - 1) * pageLimit, pageNo * pageLimit),
          totalDocs: total,
        };
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
import { GET, POST } from './route';

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

// ---- GET /reviews (B10): public, approved-only product reviews ---------------

describe('GET /reviews', () => {
  interface SeedReview {
    id: string;
    product?: string;
    customer?: string;
    authorName?: string | null;
    rating: number;
    body?: string | null;
    status?: string;
    verified?: boolean;
    createdAt: string;
  }

  function seedReview(r: SeedReview) {
    stores.reviews.set(r.id, {
      id: r.id,
      product: r.product ?? PRODUCT,
      customer: r.customer ?? 'cust-1',
      authorName: r.authorName ?? null,
      rating: r.rating,
      body: r.body ?? null,
      verifiedPurchase: r.verified ?? false,
      status: r.status ?? 'approved',
      createdAt: r.createdAt,
    });
  }

  function getReq(query: string): NextRequest {
    return asReq(
      new Request(`http://localhost/api/mobile/v1/reviews${query}`),
    );
  }

  beforeEach(() => {
    stores['mithai-products'].clear();
    stores.orders.clear();
    stores.reviews.clear();
    stores.customers.clear();
    seq = 0;
    seedProduct();
  });

  it('returns approved rows only, newest first, with the average', async () => {
    seedReview({ id: 'r1', rating: 5, createdAt: '2026-08-01T10:00:00.000Z' });
    seedReview({ id: 'r2', rating: 3, createdAt: '2026-08-03T10:00:00.000Z' });
    seedReview({ id: 'r3', rating: 4, status: 'pending', createdAt: '2026-08-05T10:00:00.000Z' });
    seedReview({ id: 'r4', rating: 1, status: 'rejected', createdAt: '2026-08-06T10:00:00.000Z' });

    const res = await GET(getReq(`?productId=${PRODUCT}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.map((i: { id: string }) => i.id)).toEqual(['r2', 'r1']);
    // (5 + 3) / 2 = 4 — pending/rejected rows never touch the average.
    expect(body.data.averageRating).toBe(4);
    expect(body.data.total).toBe(2);
  });

  it('paginates with pageSize and reports the full total', async () => {
    for (let i = 1; i <= 5; i++) {
      seedReview({
        id: `p-${String(i).padStart(2, '0')}`,
        rating: 5,
        createdAt: `2026-08-${String(i).padStart(2, '0')}T10:00:00.000Z`,
      });
    }

    const res = await GET(getReq(`?productId=${PRODUCT}&page=2&pageSize=2`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.map((i: { id: string }) => i.id)).toEqual(['p-03', 'p-02']);
    expect(body.data.total).toBe(5);
    expect(body.data.page).toBe(2);
    expect(body.data.pageSize).toBe(2);
  });

  it('resolves the display name from authorName, else the customer name — never ids', async () => {
    stores.customers.set('cust-2', { id: 'cust-2', name: 'Meera Rao', phone: '+9199999' });
    stores.customers.set('cust-3', { id: 'cust-3', name: null, phone: '+9188888' });
    seedReview({
      id: 'n1',
      customer: 'cust-1',
      authorName: 'Ravi B.',
      rating: 5,
      createdAt: '2026-08-01T10:00:00.000Z',
    });
    seedReview({
      id: 'n2',
      customer: 'cust-2',
      authorName: null,
      rating: 4,
      createdAt: '2026-08-02T10:00:00.000Z',
    });
    seedReview({
      id: 'n3',
      customer: 'cust-3',
      authorName: null,
      rating: 4,
      createdAt: '2026-08-03T10:00:00.000Z',
    });

    const res = await GET(getReq(`?productId=${PRODUCT}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    const byId = new Map(
      body.data.items.map((i: { id: string; authorDisplayName: string | null }) => [
        i.id,
        i.authorDisplayName,
      ]),
    );
    expect(byId.get('n1')).toBe('Ravi B.'); // captured name wins
    expect(byId.get('n2')).toBe('Meera Rao'); // falls back to the saved name
    expect(byId.get('n3')).toBeNull(); // nothing to show stays null
    // PublicReview shape only — no customer ids/phones can leak.
    for (const item of body.data.items) {
      expect(Object.keys(item).sort()).toEqual([
        'authorDisplayName',
        'body',
        'createdAt',
        'id',
        'rating',
        'verifiedPurchase',
      ]);
    }
  });

  it('isolates products — another product\'s reviews never appear', async () => {
    seedReview({ id: 'mine-1', product: PRODUCT, rating: 5, createdAt: '2026-08-01T10:00:00.000Z' });
    seedReview({ id: 'other-1', product: 'p2', rating: 5, createdAt: '2026-08-02T10:00:00.000Z' });

    const res = await GET(getReq(`?productId=${PRODUCT}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.map((i: { id: string }) => i.id)).toEqual(['mine-1']);
    expect(body.data.total).toBe(1);
  });

  it('returns an empty list and a null average when nothing is approved', async () => {
    seedReview({ id: 'r1', rating: 5, status: 'pending', createdAt: '2026-08-01T10:00:00.000Z' });

    const res = await GET(getReq(`?productId=${PRODUCT}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toEqual([]);
    expect(body.data.averageRating).toBeNull();
    expect(body.data.total).toBe(0);
  });

  it('rounds the average to one decimal', async () => {
    seedReview({ id: 'a1', rating: 5, createdAt: '2026-08-01T10:00:00.000Z' });
    seedReview({ id: 'a2', rating: 4, createdAt: '2026-08-02T10:00:00.000Z' });
    seedReview({ id: 'a3', rating: 4, createdAt: '2026-08-03T10:00:00.000Z' });

    const res = await GET(getReq(`?productId=${PRODUCT}`));

    expect((await res.json()).data.averageRating).toBe(4.3); // 13/3 = 4.33…
  });

  it('rejects a missing productId with 422 VALIDATION', async () => {
    const res = await GET(getReq(''));

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('caps pageSize at 50 (422 above)', async () => {
    const res = await GET(getReq(`?productId=${PRODUCT}&pageSize=51`));

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });
});
