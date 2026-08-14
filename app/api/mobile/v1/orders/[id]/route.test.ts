import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/orders/[id]/ is 6 dirs under app/, so 7 `../`
// to repo root from this file.

// Hoisted state shared with vi.mock factories.
const { stores, jwtVerify } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
  },
  jwtVerify: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: string }) => {
      if (collection !== 'orders') return null;
      return stores.orders.get(id) ?? null;
    }),
    find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
  })),
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));

vi.mock('../../../../../../lib/container', () => ({
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

function authedReq(id: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/mobile/v1/orders/${id}`, {
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

describe('GET /orders/{id}', () => {
  beforeEach(() => {
    resetStores();
    jwtVerify.mockResolvedValue({ customerId: 'cust-1', jti: 'j1' });
  });

  it('returns 200 with the serialized order', async () => {
    seedOrder({ id: 'order-1' });
    const res = await GET(authedReq('order-1') as any, {
      params: Promise.resolve({ id: 'order-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('order-1');
    expect(body.data.customerId).toBe('cust-1');
    expect(body.data.items.length).toBe(1);
    expect(body.data.totals.totalInPaise).toBe(165000);
  });

  it('returns 404 ORDER_NOT_FOUND when order does not exist', async () => {
    const res = await GET(authedReq('missing-id') as any, {
      params: Promise.resolve({ id: 'missing-id' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 404 ORDER_NOT_FOUND (no leak) when order belongs to a different customer', async () => {
    seedOrder({ id: 'theirs', customerId: 'cust-other' });
    const res = await GET(authedReq('theirs') as any, {
      params: Promise.resolve({ id: 'theirs' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 401 when auth is missing', async () => {
    seedOrder({ id: 'order-1' });
    const req = new Request('http://localhost/api/mobile/v1/orders/order-1');
    const res = await GET(req as any, {
      params: Promise.resolve({ id: 'order-1' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });
});
