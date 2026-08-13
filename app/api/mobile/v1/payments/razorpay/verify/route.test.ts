import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/payments/razorpay/verify/ = 7 dirs.

const { stores, verifySig, jwtVerify } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
    payments: new Map<string, Record<string, unknown>>(),
    shipments: new Map<string, Record<string, unknown>>(),
    idempotencyKeys: new Map<string, Record<string, unknown>>(),
  },
  verifySig: vi.fn(async () => true),
  jwtVerify: vi.fn().mockResolvedValue({ customerId: 'cust-1', jti: 'j1' }),
}));

let idSeq = 1;
const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: string }) => {
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
        const orderId = (where?.orderId as { equals?: string } | undefined)?.equals;
        const docs = orderId
          ? Array.from(stores.shipments.values()).filter((p) => p.orderId === orderId)
          : Array.from(stores.shipments.values());
        return { docs, totalDocs: docs.length };
      }
      return { docs: [], totalDocs: 0 };
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection === 'shipments') {
        const id = nextId('shipment');
        const doc = { id, ...data };
        stores.shipments.set(id, doc);
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
      if (collection === 'shipments') {
        const doc = stores.shipments.get(id);
        if (!doc) throw new Error('shipment missing');
        const merged = { ...doc, ...data };
        stores.shipments.set(id, merged);
        return merged;
      }
      throw new Error(`update: unknown collection ${collection}`);
    }),
  })),
}));

vi.mock('../../../../../../../payload.config', () => ({ default: {} }));

vi.mock('../../../../../../../lib/container', () => ({
  container: {
    jwtService: {
      verify: jwtVerify,
    },
    paymentService: {
      verifySignature: verifySig,
      createOrder: vi.fn(),
    },
  },
}));

import { POST } from './route';

function resetStores() {
  stores.orders.clear();
  stores.payments.clear();
  stores.shipments.clear();
  stores.idempotencyKeys.clear();
}

function authedReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/mobile/v1/payments/razorpay/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer fake-access-token',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function seedOrderAndPayment(over: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  const order = {
    id: 'order-1',
    customerId: 'cust-1',
    items: [
      { productId: 'p1', slug: 'kaju-katli', name: 'Kaju Katli', quantity: 2, unit: '250g', priceInPaise: 40000 },
    ],
    totals: {
      itemsTotalInPaise: 80000,
      deliveryFeeInPaise: 5000,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 85000,
    },
    status: 'pending_payment',
    paymentStatus: 'pending',
    deliveryAddressId: 'addr-1',
    source: 'mobile-android',
    razorpayOrderId: 'order_rp_test_1',
    createdAt: now,
    updatedAt: now,
    ...over,
  };
  stores.orders.set('order-1', order);
  const payment = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'razorpay',
    providerOrderId: 'order_rp_test_1',
    status: 'created',
    amountInPaise: 85000,
    currency: 'INR',
  };
  stores.payments.set('pay-1', payment);
  return { order, payment };
}

describe('POST /payments/razorpay/verify', () => {
  beforeEach(() => {
    resetStores();
    idSeq = 1;
    verifySig.mockReset();
    verifySig.mockResolvedValue(true);
    jwtVerify.mockResolvedValue({ customerId: 'cust-1', jti: 'j1' });
  });

  const VALID_BODY = {
    orderId: 'order-1',
    razorpayPaymentId: 'pay_rp_1',
    signature: 'sig_abc',
  };

  it('happy path: verifies sig, captures payment, transitions to confirmed', async () => {
    seedOrderAndPayment();
    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.order.status).toBe('confirmed');
    expect(body.data.order.paymentStatus).toBe('paid');

    // payment row flipped to captured
    const pay = Array.from(stores.payments.values())[0]!;
    expect(pay.status).toBe('captured');
    expect(pay.providerPaymentId).toBe('pay_rp_1');

    expect(verifySig).toHaveBeenCalledTimes(1);
  });

  it('returns 402 PAYMENT_FAILED when signature is invalid', async () => {
    seedOrderAndPayment();
    verifySig.mockResolvedValue(false);

    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_FAILED');
    // order/payment unchanged
    expect(stores.orders.get('order-1')!.status).toBe('pending_payment');
    expect(stores.payments.get('pay-1')!.status).toBe('created');
  });

  it('returns 404 ORDER_NOT_FOUND when order id is unknown', async () => {
    const res = await POST(
      authedReq({ orderId: 'nope', razorpayPaymentId: 'p', signature: 's' }) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 404 ORDER_NOT_FOUND when order belongs to a different customer', async () => {
    seedOrderAndPayment({ customerId: 'cust-other' });
    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 402 PAYMENT_FAILED when order has no razorpayOrderId', async () => {
    seedOrderAndPayment({ razorpayOrderId: undefined });
    const res = await POST(authedReq(VALID_BODY) as any);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_FAILED');
  });

  it('in-handler short-circuit: payment already captured returns order without re-transitioning', async () => {
    seedOrderAndPayment();
    // first call captures + transitions
    await POST(authedReq(VALID_BODY) as any);
    expect(verifySig).toHaveBeenCalledTimes(1);
    expect(stores.orders.get('order-1')!.status).toBe('confirmed');

    // second call (no Idempotency-Key) re-runs the handler. The signature
    // is still re-verified (every callback must prove provenance), but the
    // in-handler short-circuit sees payment.status === 'captured' and
    // returns the order WITHOUT re-transitioning or re-writing rows.
    const r2 = await POST(authedReq(VALID_BODY) as any);
    expect(r2.status).toBe(200);
    expect(verifySig).toHaveBeenCalledTimes(2); // sig re-verified, safe by design
    const body2 = await r2.json();
    expect(body2.data.order.status).toBe('confirmed');
    expect(body2.data.order.paymentStatus).toBe('paid');
    // single payment row, still captured
    expect(stores.payments.size).toBe(1);
    expect(stores.payments.get('pay-1')!.status).toBe('captured');
  });

  it('idempotent replay with Idempotency-Key: cached response, verify NOT called twice', async () => {
    seedOrderAndPayment();
    const headers = { 'Idempotency-Key': 'idem-v-1' };
    const bodyStr = JSON.stringify(VALID_BODY);

    const r1 = await POST(authedReq(bodyStr, headers) as any);
    expect(r1.status).toBe(200);

    const r2 = await POST(authedReq(bodyStr, headers) as any);
    expect(r2.status).toBe(200);
    expect(verifySig).toHaveBeenCalledTimes(1);
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b2).toEqual(b1);
  });

  it('returns 401 when auth is missing', async () => {
    seedOrderAndPayment();
    const req = new Request('http://localhost/api/mobile/v1/payments/razorpay/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 422 VALIDATION when body is missing fields', async () => {
    seedOrderAndPayment();
    const res = await POST(authedReq({ orderId: 'order-1' }) as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });
});
