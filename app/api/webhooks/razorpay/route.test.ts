import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

// Path depth: app/api/webhooks/razorpay/ = 4 dirs under app/, so 5 `../`
// to repo root from this file.

const { stores, securityEvents, jwtVerify } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
    payments: new Map<string, Record<string, unknown>>(),
    shipments: new Map<string, Record<string, unknown>>(),
  },
  // Track securityEvents.create calls by type for assertions.
  securityEvents: { created: [] as Array<{ type: string; details?: unknown }> },
  jwtVerify: vi.fn(),
}));

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
    find: vi.fn(async ({
      collection,
      where,
    }: {
      collection: string;
      where?: Record<string, unknown>;
    }) => {
      if (collection === 'payments') {
        const providerOrderId = (
          where?.providerOrderId as { equals?: string } | undefined
        )?.equals;
        const docs = providerOrderId
          ? Array.from(stores.payments.values()).filter(
              (p) => p.providerOrderId === providerOrderId,
            )
          : Array.from(stores.payments.values());
        return { docs, totalDocs: docs.length };
      }
      if (collection === 'shipments') {
        return { docs: [], totalDocs: 0 };
      }
      return { docs: [], totalDocs: 0 };
    }),
    create: vi.fn(
      async ({
        collection,
        data,
      }: {
        collection: string;
        data: Record<string, unknown>;
      }) => {
        if (collection === 'securityEvents') {
          securityEvents.created.push({
            type: data.type as string,
            details: data.details,
          });
          return { id: `sev-${securityEvents.created.length}`, ...data };
        }
        throw new Error(`create: unknown collection ${collection}`);
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
      },
    ),
  })),
}));

vi.mock('../../../../payload.config', () => ({ default: {} }));

vi.mock('../../../../lib/container', () => ({
  container: {
    jwtService: { verify: jwtVerify },
    paymentService: {
      verifySignature: vi.fn(),
      createOrder: vi.fn(),
    },
  },
}));

import { POST } from './route';

const WEBHOOK_SECRET = 'wh_test_secret_456';

function resetStores() {
  stores.orders.clear();
  stores.payments.clear();
  stores.shipments.clear();
  securityEvents.created = [];
}

function sign(body: string, secret: string = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function buildPaymentCapturedEvent(over: Partial<Record<string, unknown>> = {}) {
  const paymentEntity = {
    id: 'pay_rp_test_1',
    order_id: 'order_rp_test_1',
    amount: 85000,
    currency: 'INR',
    method: 'upi',
    status: 'captured',
    ...over,
  };
  return {
    entity: 'event',
    account_id: 'acc_1',
    event: 'payment.captured',
    contains: ['payment'],
    payload: { payment: { entity: paymentEntity } },
    created_at: 1700000000,
  };
}

function webhookReq(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': sign(body),
      ...headers,
    },
    body,
  });
}

function seedOrderAndPayment(over: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  const order = {
    id: 'order-1',
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
    // Relationship: store as string ID (matches Payload depth-1 read).
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

describe('POST /api/webhooks/razorpay', () => {
  beforeEach(() => {
    resetStores();
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it('happy path: verifies sig, captures payment, transitions order to confirmed', async () => {
    seedOrderAndPayment();
    const body = JSON.stringify(buildPaymentCapturedEvent());

    const res = await POST(webhookReq(body) as any);
    expect(res.status).toBe(200);

    const order = stores.orders.get('order-1')!;
    expect(order.status).toBe('confirmed');
    expect(order.paymentStatus).toBe('paid');

    const pay = stores.payments.get('pay-1')!;
    expect(pay.status).toBe('captured');
    expect(pay.providerPaymentId).toBe('pay_rp_test_1');
    // raw event appended for audit
    expect(Array.isArray(pay.rawWebhookEvents)).toBe(true);
    const events = pay.rawWebhookEvents as Array<{ receivedAt: string }>;
    expect(events).toHaveLength(1);
    expect(events[0]!.receivedAt).toBeTruthy();
  });

  it('idempotent: second webhook call with same payload does not double-transition or duplicate events', async () => {
    seedOrderAndPayment();
    const body = JSON.stringify(buildPaymentCapturedEvent());

    const r1 = await POST(webhookReq(body) as any);
    expect(r1.status).toBe(200);

    // Second call: payment is already captured. Route must short-circuit
    // and return 200 without writing again.
    const r2 = await POST(webhookReq(body) as any);
    expect(r2.status).toBe(200);

    const order = stores.orders.get('order-1')!;
    expect(order.status).toBe('confirmed');

    const pay = stores.payments.get('pay-1')!;
    expect(pay.status).toBe('captured');
    // No duplicate event appended on idempotent re-entry.
    expect(pay.rawWebhookEvents).toHaveLength(1);
  });

  it('bad signature: returns 400 + logs securityEvent', async () => {
    seedOrderAndPayment();
    const body = JSON.stringify(buildPaymentCapturedEvent());

    const res = await POST(
      webhookReq(body, { 'x-razorpay-signature': 'bogus' }) as any,
    );
    expect(res.status).toBe(400);

    expect(securityEvents.created.length).toBe(1);
    expect(securityEvents.created[0]!.type).toBe('webhook_signature_fail');
    // Order/payment unchanged
    expect(stores.orders.get('order-1')!.status).toBe('pending_payment');
    expect(stores.payments.get('pay-1')!.status).toBe('created');
  });

  it('missing x-razorpay-signature header: returns 400 + logs securityEvent', async () => {
    seedOrderAndPayment();
    const body = JSON.stringify(buildPaymentCapturedEvent());

    const res = await POST(webhookReq(body, { 'x-razorpay-signature': '' }) as any);
    expect(res.status).toBe(400);
    expect(securityEvents.created.length).toBe(1);
    expect(securityEvents.created[0]!.type).toBe('webhook_signature_fail');
  });

  it('missing RAZORPAY_WEBHOOK_SECRET env: returns 500 + logs webhook_config_error', async () => {
    seedOrderAndPayment();
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = JSON.stringify(buildPaymentCapturedEvent());

    // Build req with valid sig using a default secret — but the route must
    // not even check the sig when env is missing.
    const req = new Request('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sign(body),
      },
      body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
    expect(securityEvents.created.length).toBe(1);
    expect(securityEvents.created[0]!.type).toBe('webhook_config_error');
  });

  it('malformed JSON body: returns 400 + logs securityEvent', async () => {
    seedOrderAndPayment();
    // Sign the malformed bytes — signature is valid for the bytes, but
    // JSON.parse will throw. Route must surface 400, not 500.
    const malformed = 'this is not json';
    const req = new Request('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sign(malformed),
      },
      body: malformed,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(securityEvents.created.length).toBe(1);
    expect(securityEvents.created[0]!.type).toBe('webhook_malformed_json');
  });

  it('non-payment event (e.g. refund): returns 200 ok, no side effects', async () => {
    seedOrderAndPayment();
    const refundEvent = {
      entity: 'event',
      event: 'refund.processed',
      payload: { refund: { entity: { id: 'rfd_1', payment_id: 'pay_rp_test_1' } } },
    };
    const body = JSON.stringify(refundEvent);

    const res = await POST(webhookReq(body) as any);
    expect(res.status).toBe(200);

    // Order/payment untouched
    expect(stores.orders.get('order-1')!.status).toBe('pending_payment');
    expect(stores.payments.get('pay-1')!.status).toBe('created');
    const pay = stores.payments.get('pay-1')!;
    expect(pay.rawWebhookEvents).toBeUndefined();
  });

  it('payment not found in our DB: returns 200 ok (webhook may arrive before we persist)', async () => {
    // No payment row seeded — Razorpay race where webhook beats create-order.
    const body = JSON.stringify(buildPaymentCapturedEvent());
    const res = await POST(webhookReq(body) as any);
    expect(res.status).toBe(200);
    expect(stores.payments.size).toBe(0);
  });

  it('payment already captured from client verify path: no-op, 200 ok', async () => {
    // Simulate the verify route having already captured this payment.
    seedOrderAndPayment({
      status: 'confirmed',
      paymentStatus: 'paid',
    });
    stores.payments.set('pay-1', {
      id: 'pay-1',
      orderId: 'order-1',
      provider: 'razorpay',
      providerOrderId: 'order_rp_test_1',
      providerPaymentId: 'pay_rp_test_1',
      status: 'captured',
      amountInPaise: 85000,
      currency: 'INR',
    });

    const body = JSON.stringify(buildPaymentCapturedEvent());
    const res = await POST(webhookReq(body) as any);
    expect(res.status).toBe(200);

    // Still captured; no extra raw events appended.
    const pay = stores.payments.get('pay-1')!;
    expect(pay.status).toBe('captured');
    expect(pay.rawWebhookEvents).toBeUndefined();
  });
});
