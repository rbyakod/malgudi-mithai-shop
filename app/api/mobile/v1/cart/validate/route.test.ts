import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/cart/validate/ = 6 dirs -> 6 ../ to root.

// Mock the DI container so requireCustomer -> container.jwtService.verify
// resolves without real JWT crypto + Payload lookup.
vi.mock('../../../../../../lib/container', () => ({
  container: {
    jwtService: {
      verify: vi.fn().mockResolvedValue({ customerId: 'c1', jti: 'j1' }),
    },
  },
}));

// Mock lib/config to avoid the required-env schema.parse crash in the test
// environment; expose the delivery-fee + free-delivery-threshold fields the
// route reads (production defaults: ₹49/₹99 fees, ₹999/₹1,999 thresholds).
vi.mock('../../../../../../lib/config', () => ({
  config: {
    deliveryFeeFreshPaise: 4900,
    deliveryFeeShelfStablePaise: 9900,
    freeDeliveryThresholdFreshPaise: 99900,
    freeDeliveryThresholdShelfStablePaise: 199900,
  },
}));

// Mutable fixture holders so each test can shape Payload responses. The
// snapshot `create` calls are captured so tests can assert exactly what the
// route persisted (stamped items, totals, normalized slot).
const { snapshotCreates, payloadCreate } = vi.hoisted(() => ({
  snapshotCreates: [] as Array<Record<string, unknown>>,
  payloadCreate: vi.fn(),
}));

type FixturePincode = { pincode: string; tier: string; city: string; active: boolean };
type FixtureProduct = {
  id: string;
  slug: string;
  name: string;
  freshnessStatus: string;
  displayPrice: string;
  weight: string;
  images: Array<{ image: { url: string } }>;
};
type FixtureCoupon = {
  id: string;
  code: string;
  discountType: string;
  value: number;
  minSubtotalInPaise: number | null;
  maxDiscountInPaise: number | null;
  activeFrom: string | null;
  activeTo: string | null;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  active: boolean;
};

let pincodeDocs: FixturePincode[] = [];
let productById: Record<string, FixtureProduct> = {};
// Coupon fixtures (B7): the coupons lookup + the per-customer order count.
let couponDocs: FixtureCoupon[] = [];
let orderCount = 0;

vi.mock('payload', () => {
  const find = vi.fn(async function (args: { collection?: string }) {
    if (args && args.collection === 'serviceablePincodes') {
      return { docs: pincodeDocs };
    }
    if (args && args.collection === 'coupons') {
      return { docs: couponDocs };
    }
    return { docs: [] };
  });
  const findByID = vi.fn(async function (args: { id?: string }) {
    const id = args && args.id;
    return (id && productById[id]) || null;
  });
  const count = vi.fn(async function () {
    return { totalDocs: orderCount };
  });
  const create = vi.fn(async function (args: { collection?: string; data?: Record<string, unknown> }) {
    // Minimal snapshot persistence: return a doc whose id is stable enough
    // for the route to surface as snapshotId. Real persistence is exercised
    // via integration tests against Mongo.
    if (args && args.collection === 'snapshots') {
      snapshotCreates.push(args.data ?? {});
      return { id: 'snap-mock-1', ...args.data };
    }
    return { id: 'mock-1' };
  });
  payloadCreate.mockImplementation(create);
  const payloadStub = { find: find, findByID: findByID, count: count, create: create };
  const getPayload = vi.fn(async function () {
    return payloadStub;
  });
  return { getPayload: getPayload };
});

// Stub payload.config so its heavy import graph is not evaluated in unit test.
vi.mock('../../../../../../payload.config', () => ({ default: {} }));

import { POST } from './route';

// The route types its arg as NextRequest; tests build plain Requests.
// (Only the new free-delivery tests use this — the legacy tests above
// predate it and keep their existing casts.)
import type { NextRequest } from 'next/server';
function asReq(req: Request): NextRequest {
  return req as unknown as NextRequest;
}

function authedReq(body: unknown): Request {
  return new Request('http://localhost/api/mobile/v1/cart/validate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer fake-access-token',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /cart/validate', () => {
  beforeEach(() => {
    pincodeDocs = [{ pincode: '560001', tier: 'shelf', city: 'Bengaluru', active: true }];
    productById = {
      p1: {
        id: 'p1',
        slug: 'kaju-katli',
        name: 'Kaju Katli',
        freshnessStatus: 'made-to-order',
        displayPrice: '₹920 / 250g',
        weight: '250 g',
        images: [{ image: { url: '/api/media/file/kaju-katli.jpg' } }],
      },
    };
    snapshotCreates.length = 0;
    payloadCreate.mockClear();
    couponDocs = [];
    orderCount = 0;
  });

  it('returns 200 with a priced cart snapshot for a valid body', async () => {
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 2 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.snapshotId).toBeTruthy();
    expect(body.data.customerId).toBe('c1');
    expect(body.data.pincodeTier).toBe('shelf');
    expect(body.data.expiresAt).toBeTruthy();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0]).toMatchObject({
      productId: 'p1',
      slug: 'kaju-katli',
      name: 'Kaju Katli',
      quantity: 2,
      freshnessStatus: 'made-to-order',
      packLabel: null,
      unit: '250g',
      priceInPaise: 92000,
    });
    expect(body.data.items[0].image).toContain('/api/media/file/kaju-katli.jpg');
    // Real totals: 2 x ₹920 + shelf-tier ₹99 delivery.
    expect(body.data.totals).toEqual({
      itemsTotalInPaise: 184000,
      deliveryFeeInPaise: 9900,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 193900,
    });
  });

  it('persists the snapshot with the same stamped items + totals', async () => {
    await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 2 }],
      pincode: '560001',
    })));

    expect(snapshotCreates).toHaveLength(1);
    expect(snapshotCreates[0]).toMatchObject({
      customerId: 'c1',
      pincode: '560001',
      pincodeTier: 'shelf',
      totals: { totalInPaise: 193900 },
    });
    expect((snapshotCreates[0] as { items: Array<Record<string, unknown>> }).items[0]).toMatchObject({
      unit: '250g',
      priceInPaise: 92000,
      packLabel: null,
    });
  });

  it('prices a packLabel line against the derived pack ladder', async () => {
    productById.p1.displayPrice = '₹1,109 / 1 kg';
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1, packLabel: '500g' }],
      pincode: '560001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    // 500g derived from ₹1,109/1kg: 1109/2 = 554.5 → ₹550 (round-to-₹10).
    expect(body.data.items[0]).toMatchObject({
      packLabel: '500g',
      unit: '500g',
      priceInPaise: 55000,
    });
    expect(body.data.totals.itemsTotalInPaise).toBe(55000);
    expect(body.data.totals.totalInPaise).toBe(55000 + 9900);
  });

  it('applies the fresh-tier delivery fee to fresh pincodes', async () => {
    pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '110001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pincodeTier).toBe('fresh');
    expect(body.data.totals).toEqual({
      itemsTotalInPaise: 92000,
      deliveryFeeInPaise: 4900,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 96900,
    });
  });

  it('normalizes iOS relative slot tokens when persisting the snapshot', async () => {
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
      slot: { date: 'today', window: 'evening' },
    })));

    expect(res.status).toBe(200);
    expect(snapshotCreates[0]).toMatchObject({
      slot: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), window: '16:00-20:00' },
    });
  });

  it('passes Android slot shapes through unchanged', async () => {
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
      slot: { date: '2026-09-05', window: '10:00-14:00' },
    })));

    expect(res.status).toBe(200);
    expect(snapshotCreates[0]).toMatchObject({
      slot: { date: '2026-09-05', window: '10:00-14:00' },
    });
  });

  it('rejects made-daily items on a shelf-tier pincode, naming the line (422 PINCODE_NOT_SERVICEABLE)', async () => {
    productById.p1.freshnessStatus = 'made-daily';
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('PINCODE_NOT_SERVICEABLE');
    expect(body.error.message).toContain('Kaju Katli');
    // Nothing persisted for a rejected cart.
    expect(snapshotCreates).toHaveLength(0);
  });

  it('accepts made-daily items on a fresh-tier pincode', async () => {
    productById.p1.freshnessStatus = 'made-daily';
    pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '110001',
    })));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { pincodeTier: 'fresh' } });
  });

  it('rejects unpriceable (on-request) lines with 422 VALIDATION', async () => {
    productById.p1.displayPrice = '₹ on request / pack';
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('not priced for online ordering');
  });

  it('rejects a stale packLabel that no longer derives (422 VALIDATION)', async () => {
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1, packLabel: '2 kg' }],
      pincode: '560001',
    })));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('not priced for online ordering');
  });

  it('returns 404 PRODUCT_NOT_FOUND when a product no longer exists', async () => {
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'gone', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 422 PINCODE_NOT_SERVICEABLE when pincode is not served', async () => {
    pincodeDocs = []; // unserviceable
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '999999',
    })));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('PINCODE_NOT_SERVICEABLE');
  });

  it('returns 422 VALIDATION when body is missing items', async () => {
    const res = await POST(asReq(authedReq({
      pincode: '560001',
    })));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('waives the delivery fee at the fresh-tier free-delivery threshold (₹999)', async () => {
    pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
    // 2 x ₹920 = ₹1,840 ≥ ₹999 fresh threshold → fee ₹0.
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 2 }],
      pincode: '110001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totals).toEqual({
      itemsTotalInPaise: 184000,
      deliveryFeeInPaise: 0,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 184000,
    });
    // The persisted snapshot carries the same fee-0 totals.
    expect(snapshotCreates[0]).toMatchObject({
      totals: { deliveryFeeInPaise: 0, totalInPaise: 184000 },
    });
  });

  it('keeps the fresh fee below the threshold (₹920 < ₹999)', async () => {
    pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '110001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totals.deliveryFeeInPaise).toBe(4900);
    expect(body.data.totals.totalInPaise).toBe(92000 + 4900);
  });

  it('does not inherit the fresh waiver on the shelf tier (₹1,840 < ₹1,999 shelf threshold)', async () => {
    // Same cart as the fresh-waiver test: clears ₹999 but not ₹1,999 — a
    // shelf cart must still pay the ₹99 courier fee.
    const res = await POST(asReq(authedReq({
      items: [{ productId: 'p1', quantity: 2 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totals.deliveryFeeInPaise).toBe(9900);
    expect(body.data.totals.totalInPaise).toBe(184000 + 9900);
  });

  // Coupons (B7) — wiring only; the eligibility/discount matrix itself is
  // table-driven in tests/unit/couponValidation.test.ts.
  describe('couponCode (B7)', () => {
    const flatCoupon = {
      id: 'cpn1',
      code: 'FLAT100',
      discountType: 'flat',
      value: 10000,
      minSubtotalInPaise: null,
      maxDiscountInPaise: null,
      activeFrom: null,
      activeTo: null,
      usageLimitTotal: null,
      usageLimitPerCustomer: null,
      usedCount: 0,
      active: true,
    };

    it('applies a valid code: discount in totals, code stamped on snapshot + response', async () => {
      couponDocs = [flatCoupon];
      // 2 x ₹920 = ₹1,840 shelf cart; ₹100 off → ₹1,740 still under the
      // ₹1,999 shelf threshold, so the ₹99 fee stays.
      const res = await POST(asReq(authedReq({
        items: [{ productId: 'p1', quantity: 2 }],
        pincode: '560001',
        couponCode: ' flat100 ', // case + whitespace normalized
      })));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.couponCode).toBe('FLAT100');
      expect(body.data.totals).toEqual({
        itemsTotalInPaise: 184000,
        deliveryFeeInPaise: 9900,
        taxesInPaise: 0,
        discountInPaise: 10000,
        totalInPaise: 183900,
      });
      // The persisted snapshot carries the code — create-order re-reads it
      // and stamps the order + burns the redemption.
      expect(snapshotCreates[0]).toMatchObject({
        couponCode: 'FLAT100',
        totals: { discountInPaise: 10000, totalInPaise: 183900 },
      });
    });

    it('returns couponCode null and a 0 discount without a code', async () => {
      const res = await POST(asReq(authedReq({
        items: [{ productId: 'p1', quantity: 1 }],
        pincode: '560001',
      })));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.couponCode).toBeNull();
      expect(body.data.totals.discountInPaise).toBe(0);
      expect(snapshotCreates[0]).toMatchObject({ couponCode: null });
    });

    it('rejects an unknown code with 422 INVALID_COUPON, persisting nothing', async () => {
      const res = await POST(asReq(authedReq({
        items: [{ productId: 'p1', quantity: 1 }],
        pincode: '560001',
        couponCode: 'NOPE',
      })));

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_COUPON');
      expect(snapshotCreates).toHaveLength(0);
    });

    it('rejects an inactive code with 422 INVALID_COUPON', async () => {
      couponDocs = [{ ...flatCoupon, active: false }];
      const res = await POST(asReq(authedReq({
        items: [{ productId: 'p1', quantity: 1 }],
        pincode: '560001',
        couponCode: 'FLAT100',
      })));

      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe('INVALID_COUPON');
    });

    it('rejects a code past its per-customer limit (counted from orders)', async () => {
      couponDocs = [{ ...flatCoupon, usageLimitPerCustomer: 1 }];
      orderCount = 1; // this customer already placed one order with it
      const res = await POST(asReq(authedReq({
        items: [{ productId: 'p1', quantity: 1 }],
        pincode: '560001',
        couponCode: 'FLAT100',
      })));

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_COUPON');
      expect(body.error.message).toContain('already used');
    });

    it('judges the discount BEFORE the free-delivery threshold at the route level', async () => {
      // ₹1,840 fresh-tier cart with ₹1,000 off: payable ₹840 < ₹999, so
      // the coupon RESTORES the delivery fee the pre-discount cart had
      // waived. Pinned end-to-end (pricing unit test pins the primitive).
      pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
      couponDocs = [{ ...flatCoupon, code: 'FLAT1000', value: 100000 }];
      const res = await POST(asReq(authedReq({
        items: [{ productId: 'p1', quantity: 2 }],
        pincode: '110001',
        couponCode: 'FLAT1000',
      })));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.totals).toEqual({
        itemsTotalInPaise: 184000,
        deliveryFeeInPaise: 4900,
        taxesInPaise: 0,
        discountInPaise: 100000,
        totalInPaise: 88900,
      });
    });
  });
});
