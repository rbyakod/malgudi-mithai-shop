import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/payments/razorpay/create-order/ is 7 dirs
// under app/, so 7 `../` to repo root from this file.

// Hoisted state shared with vi.mock factories. vi.mock factories run
// before any top-level const, so anything they close over must itself
// come from vi.hoisted.
const { stores, paymentCalls, jwtVerify, paymentCreateOrder } = vi.hoisted(() => ({
  stores: {
    snapshots: new Map<string, Record<string, unknown>>(),
    orders: new Map<string, Record<string, unknown>>(),
    payments: new Map<string, Record<string, unknown>>(),
    shipments: new Map<string, Record<string, unknown>>(),
    idempotencyKeys: new Map<string, Record<string, unknown>>(),
  },
  paymentCalls: { createOrder: 0 },
  jwtVerify: vi.fn(),
  paymentCreateOrder: vi.fn(),
}));

let idSeq = 1;
const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: string }) => {
      if (collection === 'snapshots') {
        return stores.snapshots.get(id) ?? null;
      }
      if (collection === 'orders') {
        const doc = stores.orders.get(id);
        if (!doc) {
          const err = new Error('not found');
          (err as { statusCode?: number }).statusCode = 404;
          throw err;
        }
        return doc;
      }
      return null;
    }),
    find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'payments') {
        const orderId = (where?.orderId as { equals?: string } | undefined)?.equals;
        const docs = orderId
          ? Array.from(stores.payments.values()).filter((p) => p.orderId === orderId)
          : Array.from(stores.payments.values());
        return { docs, totalDocs: docs.length };
      }
      if (collection === 'idempotencyKeys') {
        const key = (where?.key as { equals?: string } | undefined)?.equals;
        const doc = key ? stores.idempotencyKeys.get(key) : undefined;
        return { docs: doc ? [doc] : [], totalDocs: doc ? 1 : 0 };
      }
      if (collection === 'shipments') {
        return { docs: [], totalDocs: 0 };
      }
      return { docs: [], totalDocs: 0 };
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection === 'orders') {
        const id = nextId('order');
        const now = new Date().toISOString();
        const doc = { id, ...data, createdAt: now, updatedAt: now };
        stores.orders.set(id, doc);
        return doc;
      }
      if (collection === 'payments') {
        const id = nextId('pay');
        const doc = { id, ...data };
        stores.payments.set(id, doc);
        return doc;
      }
      if (collection === 'idempotencyKeys') {
        const key = data.key as string;
        stores.idempotencyKeys.set(key, data);
        return data;
      }
      throw new Error(`create: unknown collection ${collection}`);
    }),
    update: vi.fn(async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
      if (collection === 'orders') {
        const doc = stores.orders.get(id);
        if (!doc) throw new Error('order missing');
        const merged = { ...doc, ...data, updatedAt: new Date().toISOString() };
        stores.orders.set(id, merged);
        return merged;
      }
      if (collection === 'payments') {
        const doc = stores.payments.get(id);
        if (!doc) throw new Error('payment missing');
        const merged = { ...doc, ...data };
        stores.payments.set(id, merged);
        return merged;
      }
      throw new Error(`update: unknown collection ${collection}`);
    }),
  })),
}));

vi.mock('../../../../../../../payload.config', () => ({ default: {} }));

// Mock lib/config (required-env schema.parse crashes in the test env); the
// route reads razorpayKeyId as the keyId fallback.
vi.mock('../../../../../../../lib/config', () => ({
  config: { razorpayKeyId: 'rzp_test_config_fallback' },
}));

// Mock container with a fake PaymentService we can spy on + a stub
// jwtService so requireCustomer resolves for our fake token.
vi.mock('../../../../../../../lib/container', () => ({
  container: {
    jwtService: {
      verify: jwtVerify,
    },
    paymentService: {
      createOrder: paymentCreateOrder,
      verifySignature: vi.fn(async () => true),
    },
  },
}));

import { POST } from './route';

function resetStores() {
  stores.snapshots.clear();
  stores.orders.clear();
  stores.payments.clear();
  stores.shipments.clear();
  stores.idempotencyKeys.clear();
}

const VALID_BODY = {
  snapshotId: 'snap-1',
  deliveryAddressId: 'addr-1',
};

function authedReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/mobile/v1/payments/razorpay/create-order', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer fake-access-token',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function seedSnapshot(over: Partial<Record<string, unknown>> = {}) {
  stores.snapshots.set('snap-1', {
    id: 'snap-1',
    customerId: 'cust-1',
    items: [
      {
        productId: 'p1',
        slug: 'kaju-katli',
        name: 'Kaju Katli',
        quantity: 2,
        unit: '250g',
        priceInPaise: 40000,
      },
    ],
    totals: {
      itemsTotalInPaise: 80000,
      deliveryFeeInPaise: 5000,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 85000,
    },
    pincode: '560001',
    pincodeTier: 'shelf',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    ...over,
  });
}

describe('POST /payments/razorpay/create-order', () => {
  beforeEach(() => {
    resetStores();
    idSeq = 1;
    paymentCalls.createOrder = 0;
    jwtVerify.mockResolvedValue({ customerId: 'cust-1', jti: 'j1' });
    paymentCreateOrder.mockImplementation(async () => {
      paymentCalls.createOrder++;
      return { providerOrderId: 'order_rp_test_1' };
    });
  });

  it('returns 200 with orderId + razorpayOrderId + amountInPaise + keyId on happy path', async () => {
    seedSnapshot();
    const originalKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_key';

    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orderId).toBeTruthy();
    expect(body.data.razorpayOrderId).toBe('order_rp_test_1');
    expect(body.data.amountInPaise).toBe(85000);
    expect(body.data.keyId).toBe('rzp_test_key');

    // side-effects
    expect(stores.orders.size).toBe(1);
    expect(stores.payments.size).toBe(1);
    const order = Array.from(stores.orders.values())[0]!;
    expect(order.status).toBe('pending_payment');
    expect(order.razorpayOrderId).toBe('order_rp_test_1');
    expect(order.source).toBe('mobile-android'); // default when no X-Client-Source
    expect(stores.payments.values().next().value?.amountInPaise).toBe(85000);

    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    else process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalKey;
  });

  it('falls back to config.razorpayKeyId when NEXT_PUBLIC_RAZORPAY_KEY_ID is unset', async () => {
    seedSnapshot();
    const originalKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Same value RAZORPAY_KEY_ID holds on the server — keyId must never be
    // undefined or the client cannot open the Razorpay widget.
    expect(body.data.keyId).toBe('rzp_test_config_fallback');

    if (originalKey !== undefined) process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalKey;
  });

  it('rejects a stale zero-total snapshot with 422 and creates no order', async () => {
    seedSnapshot({
      totals: {
        itemsTotalInPaise: 0,
        deliveryFeeInPaise: 0,
        taxesInPaise: 0,
        discountInPaise: 0,
        totalInPaise: 0,
      },
    });
    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('re-validate');
    // No side effects: no order row, no Razorpay call.
    expect(stores.orders.size).toBe(0);
    expect(paymentCalls.createOrder).toBe(0);
  });

  it('returns 401 when auth is missing', async () => {
    seedSnapshot();
    const req = new Request('http://localhost/api/mobile/v1/payments/razorpay/create-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 422 VALIDATION when body is missing fields', async () => {
    seedSnapshot();
    const res = await POST(authedReq({ snapshotId: 'snap-1' }) as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('returns 404 SNAPSHOT_NOT_FOUND when snapshot does not exist', async () => {
    // no snapshot seeded
    const res = await POST(authedReq({ snapshotId: 'gone', deliveryAddressId: 'addr-1' }) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('returns 404 SNAPSHOT_NOT_FOUND when snapshot belongs to a different customer', async () => {
    seedSnapshot({ customerId: 'cust-other' });
    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('returns 422 VALIDATION when snapshot has expired', async () => {
    seedSnapshot({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('idempotent replay: same Idempotency-Key + body returns cached response and does NOT call handler twice', async () => {
    seedSnapshot();
    const headers = { 'Idempotency-Key': 'idem-1' };
    const body = JSON.stringify(VALID_BODY);

    const r1 = await POST(authedReq(body, headers) as any);
    expect(r1.status).toBe(200);
    expect(paymentCalls.createOrder).toBe(1);
    expect(stores.orders.size).toBe(1);

    const r2 = await POST(authedReq(body, headers) as any);
    expect(r2.status).toBe(200);
    // handler NOT called again — payment adapter call count stays at 1
    expect(paymentCalls.createOrder).toBe(1);
    // no new order / payment rows
    expect(stores.orders.size).toBe(1);
    expect(stores.payments.size).toBe(1);

    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b2).toEqual(b1);
  });

  it('idempotent replay with DIFFERENT body same key returns 409 CONFLICT', async () => {
    seedSnapshot();
    const headers = { 'Idempotency-Key': 'idem-2' };
    await POST(authedReq(JSON.stringify(VALID_BODY), headers) as any);

    const r2 = await POST(
      authedReq(
        JSON.stringify({ snapshotId: 'snap-1', deliveryAddressId: 'addr-2' }),
        headers,
      ) as any,
    );
    expect(r2.status).toBe(409);
  });

  it('respects X-Client-Source header and stamps it on the order', async () => {
    seedSnapshot();
    const res = await POST(
      authedReq(VALID_BODY, { 'X-Client-Source': 'mobile-ios' }) as any,
    );
    expect(res.status).toBe(200);
    const order = Array.from(stores.orders.values())[0]!;
    expect(order.source).toBe('mobile-ios');
  });

  it('returns 422 when X-Client-Source is not in the allow-list', async () => {
    seedSnapshot();
    const res = await POST(
      authedReq(VALID_BODY, { 'X-Client-Source': 'kiosk' }) as any,
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });
});
