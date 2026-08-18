import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/orders/cod/ = 6 dirs under app/, so 6
// `../` to the repo root from this file.

// COD order creation (B12): consume a validated cart snapshot and mint an
// order born confirmed / cash pending — no provider order, no payments
// row — plus the ≥2-uncollected-cash abuse guard.

const { stores, jwtVerify, paymentCreateOrder } = vi.hoisted(() => ({
  stores: {
    snapshots: new Map<string, Record<string, unknown>>(),
    orders: new Map<string, Record<string, unknown>>(),
    coupons: new Map<string, Record<string, unknown>>(),
    payments: new Map<string, Record<string, unknown>>(),
    idempotencyKeys: new Map<string, Record<string, unknown>>(),
  },
  jwtVerify: vi.fn(),
  paymentCreateOrder: vi.fn(),
}));

let idSeq = 1;
const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: string }) => {
        if (collection === 'snapshots') {
          return stores.snapshots.get(id) ?? null;
        }
        if (collection === 'orders') {
          // emitOrderEvent(order.id, 'confirmed') reloads the fresh order;
          // the subsequent customer lookup then misses (no customers store)
          // and the emitter no-ops before touching any container service.
          return stores.orders.get(id) ?? null;
        }
        return null;
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
        const store = (stores as Record<string, Map<string, Record<string, unknown>>>)[
          collection
        ];
        if (!store) return { docs: [], totalDocs: 0 };
        // `where` is either {field:{equals|in}} or {and:[clauses]} — both
        // reduce to "every clause matches on every field".
        const clauses =
          (where as { and?: Array<Record<string, unknown>> })?.and ?? (where ? [where] : []);
        const docs = Array.from(store.values()).filter((d) =>
          clauses.every((clause) =>
            Object.entries(clause).every(([field, cond]) => {
              const eq = (cond as { equals?: unknown }).equals;
              const inList = (cond as { in?: unknown[] }).in;
              if (inList !== undefined) return inList.includes(d[field]);
              return eq !== undefined ? d[field] === eq : true;
            }),
          ),
        );
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(
      async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        if (collection === 'orders') {
          const id = nextId('order');
          const now = new Date().toISOString();
          const doc = { id, ...data, createdAt: now, updatedAt: now };
          stores.orders.set(id, doc);
          return doc;
        }
        if (collection === 'idempotencyKeys') {
          stores.idempotencyKeys.set(data.key as string, data);
          return data;
        }
        throw new Error(`create: unexpected collection ${collection}`);
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
        const store = (stores as Record<string, Map<string, Record<string, unknown>>>)[
          collection
        ];
        const doc = store?.get(id);
        if (!doc) throw new Error(`${collection} ${id} missing`);
        const merged = { ...doc, ...data };
        store.set(id, merged);
        return merged;
      },
    ),
  })),
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it.
vi.mock('../../../../../../lib/config', () => ({ config: {} }));

// requireCustomer resolves through container.jwtService. paymentService is
// present with a counting spy — the COD route must never touch it.
vi.mock('../../../../../../lib/container', () => ({
  container: {
    jwtService: { verify: jwtVerify },
    paymentService: { createOrder: paymentCreateOrder },
  },
}));

import { POST } from './route';

function resetStores() {
  stores.snapshots.clear();
  stores.orders.clear();
  stores.coupons.clear();
  stores.payments.clear();
  stores.idempotencyKeys.clear();
}

const VALID_BODY = { snapshotId: 'snap-1', deliveryAddressId: 'addr-1' };

function asReq(req: Request): NextRequestCompat {
  return req as unknown as NextRequestCompat;
}
type NextRequestCompat = Parameters<typeof POST>[0];

function authedReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/mobile/v1/orders/cod', {
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
        quantity: 1,
        unit: '250g',
        priceInPaise: 40000,
      },
    ],
    totals: {
      itemsTotalInPaise: 40000,
      deliveryFeeInPaise: 5000,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 45000,
    },
    pincode: '560001',
    pincodeTier: 'shelf',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    ...over,
  });
}

function seedUncollectedCod(id: string, status: string) {
  stores.orders.set(id, {
    id,
    customerId: 'cust-1',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    status,
  });
}

describe('POST /orders/cod', () => {
  beforeEach(() => {
    resetStores();
    idSeq = 1;
    paymentCreateOrder.mockClear();
    jwtVerify.mockResolvedValue({ customerId: 'cust-1', jti: 'j1' });
  });

  it('mints an order born confirmed / cash pending / cod with no provider artifacts', async () => {
    seedSnapshot({ couponCode: 'TEST100' });
    stores.coupons.set('c1', { id: 'c1', code: 'TEST100', usedCount: 3 });

    const res = await POST(asReq(authedReq(VALID_BODY)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('confirmed');
    expect(body.data.paymentStatus).toBe('pending');
    expect(body.data.paymentMethod).toBe('cod');
    expect(body.data.couponCode).toBe('TEST100');
    expect(body.data.razorpayOrderId ?? null).toBeNull();

    // Side effects: exactly one order row; NO payments row; NO provider
    // call; the coupon burned once (same writer as the online path).
    expect(stores.orders.size).toBe(1);
    expect(stores.payments.size).toBe(0);
    expect(paymentCreateOrder).not.toHaveBeenCalled();
    const order = Array.from(stores.orders.values())[0]!;
    expect(order).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      source: 'mobile-android',
      couponCode: 'TEST100',
    });
    expect(stores.coupons.get('c1')!.usedCount).toBe(4);
  });

  it('returns 404 SNAPSHOT_NOT_FOUND for another customer\'s snapshot', async () => {
    seedSnapshot({ customerId: 'someone-else' });
    const res = await POST(asReq(authedReq(VALID_BODY)));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('SNAPSHOT_NOT_FOUND');
    expect(stores.orders.size).toBe(0);
  });

  it('returns 422 for an expired snapshot', async () => {
    seedSnapshot({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
    const res = await POST(asReq(authedReq(VALID_BODY)));
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toContain('expired');
    expect(stores.orders.size).toBe(0);
  });

  it('returns 422 for a zero-total snapshot (nothing to collect at the door)', async () => {
    seedSnapshot({
      totals: {
        itemsTotalInPaise: 0,
        deliveryFeeInPaise: 0,
        taxesInPaise: 0,
        discountInPaise: 0,
        totalInPaise: 0,
      },
    });
    const res = await POST(asReq(authedReq(VALID_BODY)));
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toContain('re-validate');
    expect(stores.orders.size).toBe(0);
  });

  it('refuses COD once 2 uncollected cash orders sit at delivered/failed_delivery', async () => {
    seedSnapshot();
    seedUncollectedCod('o-unc-1', 'delivered');
    seedUncollectedCod('o-unc-2', 'failed_delivery');

    const res = await POST(asReq(authedReq(VALID_BODY)));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.message).toContain('await collection');
    // No third order minted; the two guard rows untouched.
    expect(stores.orders.size).toBe(2);
  });

  it('allows COD with one uncollected order and paid delivered orders', async () => {
    seedSnapshot();
    seedUncollectedCod('o-unc-1', 'delivered');
    stores.orders.set('o-paid', {
      id: 'o-paid',
      customerId: 'cust-1',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      status: 'delivered',
    });
    // In-flight COD (not yet at the door) never counts either.
    stores.orders.set('o-flight', {
      id: 'o-flight',
      customerId: 'cust-1',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'packed',
    });

    const res = await POST(asReq(authedReq(VALID_BODY)));
    expect(res.status).toBe(200);
    expect(stores.orders.size).toBe(4);
  });

  it('replays idempotently: same key + body mints exactly one order', async () => {
    seedSnapshot();
    // A Request body can only be read once — build a fresh one per call
    // (a real replay is a new HTTP request carrying the same key + body).
    const first = await POST(asReq(authedReq(VALID_BODY, { 'Idempotency-Key': 'idem-1' })));
    expect(first.status).toBe(200);
    const firstOrderId = (await first.json()).data.id;

    const replay = await POST(asReq(authedReq(VALID_BODY, { 'Idempotency-Key': 'idem-1' })));
    expect(replay.status).toBe(200);
    expect((await replay.json()).data.id).toBe(firstOrderId);
    expect(stores.orders.size).toBe(1);
  });

  it('returns 401 when auth is missing', async () => {
    seedSnapshot();
    const req = new Request('http://localhost/api/mobile/v1/orders/cod', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    const res = await POST(asReq(req));
    expect(res.status).toBe(401);
    expect(stores.orders.size).toBe(0);
  });
});
