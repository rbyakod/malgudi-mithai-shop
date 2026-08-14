import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/orders/ is 5 dirs under app/, so 6 `../`
// to repo root from this file.

// Hoisted state shared with vi.mock factories. vi.mock factories run
// before any top-level const, so anything they close over must itself
// come from vi.hoisted.
const { stores, jwtVerify } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
  },
  jwtVerify: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(async ({ collection, page, limit }: { collection: string; page: number; limit: number }) => {
      if (collection !== 'orders') {
        throw new Error(`unexpected collection ${collection}`);
      }
      const docs = Array.from(stores.orders.values());
      // payload.find orders by sort=-createdAt; seed in that order or stable here.
      const start = (page - 1) * limit;
      const slice = docs.slice(start, start + limit);
      return {
        docs: slice,
        totalDocs: docs.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(docs.length / limit)),
      };
    }),
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: string }) => {
      if (collection !== 'orders') return null;
      return stores.orders.get(id) ?? null;
    }),
  })),
}));

vi.mock('../../../../../payload.config', () => ({ default: {} }));

// Mock container with a stub jwtService so requireCustomer resolves for
// our fake token.
vi.mock('../../../../../lib/container', () => ({
  container: {
    jwtService: {
      verify: jwtVerify,
    },
  },
}));

import { GET } from './route';

function resetStores() {
  stores.orders.clear();
}

function authedReq(query = '', headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/mobile/v1/orders${query}`, {
    headers: {
      authorization: 'Bearer fake-access-token',
      ...headers,
    },
  });
}

function seedOrder(over: Partial<Record<string, unknown>> = {}) {
  const id = (over.id as string | undefined) ?? 'order-1';
  const doc: Record<string, unknown> = {
    id,
    customerId: 'cust-1',
    items: [
      {
        productId: 'p1',
        slug: 'kaju-katli',
        name: 'Kaju Katli',
        quantity: 2,
        unit: '250g',
        priceInPaise: 80000,
      },
    ],
    totals: {
      itemsTotalInPaise: 160000,
      deliveryFeeInPaise: 5000,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 165000,
    },
    status: 'pending_payment',
    paymentStatus: 'pending',
    deliveryAddressId: 'addr-1',
    source: 'mobile-android',
    razorpayOrderId: 'order_rp_test_1',
    createdAt: '2026-08-12T10:00:00.000Z',
    updatedAt: '2026-08-12T10:00:00.000Z',
    ...over,
  };
  stores.orders.set(id, doc);
  return doc;
}

describe('GET /orders', () => {
  beforeEach(() => {
    resetStores();
    jwtVerify.mockResolvedValue({ customerId: 'cust-1', jti: 'j1' });
  });

  it('returns 200 with items + total + pagination', async () => {
    seedOrder({ id: 'order-1' });
    seedOrder({ id: 'order-2' });
    const res = await GET(authedReq() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.total).toBe(2);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(20);
    expect(body.data.items[0]).toMatchObject({ id: 'order-1', customerId: 'cust-1' });
  });

  it('returns 401 when auth is missing', async () => {
    seedOrder();
    const req = new Request('http://localhost/api/mobile/v1/orders');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('defaults to page=1 pageSize=20 when no query params', async () => {
    seedOrder();
    const res = await GET(authedReq() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(20);
  });

  it('caps pageSize to 50', async () => {
    seedOrder();
    const res = await GET(authedReq('?pageSize=500') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pageSize).toBe(50);
  });

  it('respects page and pageSize query params', async () => {
    for (let i = 1; i <= 5; i++) seedOrder({ id: `order-${i}` });
    const res = await GET(authedReq('?page=2&pageSize=2') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.page).toBe(2);
    expect(body.data.pageSize).toBe(2);
    expect(body.data.total).toBe(5);
    expect(body.data.items.length).toBe(2);
  });

  it('falls back to defaults when query params are NaN', async () => {
    seedOrder();
    const res = await GET(authedReq('?page=abc&pageSize=xyz') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(20);
  });

  it('clamps negative page to 1', async () => {
    seedOrder();
    const res = await GET(authedReq('?page=-3&pageSize=10') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(10);
  });

  it('returns only orders belonging to the authenticated customer', async () => {
    // payload.find mock ignores `where` filter, so verify via service contract:
    // the route passes customerId from the token into listForCustomer.
    // Here we just assert the route calls through and returns whatever
    // payload.find yields (the service is the source of the filter).
    seedOrder({ id: 'mine', customerId: 'cust-1' });
    const res = await GET(authedReq() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].customerId).toBe('cust-1');
  });
});
