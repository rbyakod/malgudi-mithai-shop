import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/cart/estimate/ = 6 dirs -> 6 ../ to root.

// The estimate route is UNauthenticated — no jwtService to mock — but it
// rate-limits via the DI container, so mock that facade. `checkCalls`
// captures the keys so the per-IP bucket naming is asserted too.
const { checkCalls, rateLimiterCheck } = vi.hoisted(() => ({
  checkCalls: [] as string[],
  rateLimiterCheck: vi.fn(),
}));

vi.mock('../../../../../../lib/container', () => ({
  container: {
    rateLimiter: {
      check: rateLimiterCheck,
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

let pincodeDocs: FixturePincode[] = [];
let productById: Record<string, FixtureProduct> = {};

vi.mock('payload', () => {
  const find = vi.fn(async function (args: { collection?: string }) {
    if (args && args.collection === 'serviceablePincodes') {
      return { docs: pincodeDocs };
    }
    return { docs: [] };
  });
  const findByID = vi.fn(async function (args: { id?: string }) {
    const id = args && args.id;
    return (id && productById[id]) || null;
  });
  const create = vi.fn(async function () {
    throw new Error('estimate must never persist anything');
  });
  const payloadStub = { find, findByID, create };
  const getPayload = vi.fn(async function () {
    return payloadStub;
  });
  return { getPayload };
});

// Stub payload.config so its heavy import graph is not evaluated in unit test.
vi.mock('../../../../../../payload.config', () => ({ default: {} }));

import { POST } from './route';
import { ApiError } from '../../../../../../lib/api/errors';

import type { NextRequest } from 'next/server';
function asReq(req: Request): NextRequest {
  return req as unknown as NextRequest;
}

// Deliberately NO authorization header — the whole point of the route.
function guestReq(body: unknown, ip = '203.0.113.7'): Request {
  return new Request('http://localhost/api/mobile/v1/cart/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /cart/estimate', () => {
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
    checkCalls.length = 0;
    rateLimiterCheck.mockReset();
    rateLimiterCheck.mockImplementation(async (key: string) => {
      checkCalls.push(key);
    });
  });

  it('estimates a fresh-tier cart under the threshold (₹49 fee, not eligible)', async () => {
    pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '110001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      itemsTotalInPaise: 92000,
      deliveryFeeInPaise: 4900,
      discountInPaise: 0,
      totalInPaise: 96900,
      pincodeTier: 'fresh',
      freeDeliveryThresholdInPaise: 99900,
      freeDeliveryEligible: false,
    });
  });

  it('waives the fee and flags eligibility over the fresh threshold', async () => {
    pincodeDocs = [{ pincode: '110001', tier: 'fresh', city: 'New Delhi', active: true }];
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 2 }], // ₹1,840 ≥ ₹999
      pincode: '110001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deliveryFeeInPaise).toBe(0);
    expect(body.data.totalInPaise).toBe(184000);
    expect(body.data.freeDeliveryEligible).toBe(true);
  });

  it('estimates a shelf-tier cart with the shelf fee + threshold', async () => {
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pincodeTier).toBe('shelf');
    expect(body.data.deliveryFeeInPaise).toBe(9900);
    expect(body.data.freeDeliveryThresholdInPaise).toBe(199900);
    expect(body.data.freeDeliveryEligible).toBe(false);
  });

  it('returns null tier, zero fee, and null threshold without a pincode', async () => {
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      itemsTotalInPaise: 92000,
      deliveryFeeInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 92000,
      pincodeTier: null,
      freeDeliveryThresholdInPaise: null,
      freeDeliveryEligible: false,
    });
  });

  it('treats an unserviceable pincode as no-pincode (lenient, unlike validate)', async () => {
    pincodeDocs = [];
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '999999',
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pincodeTier).toBeNull();
    expect(body.data.deliveryFeeInPaise).toBe(0);
  });

  it('does NOT enforce the fresh-tier rule — made-daily prices anyway', async () => {
    // Validate 422s this exact cart; the estimate is informational and
    // checkout enforces the rule for real.
    productById.p1.freshnessStatus = 'made-daily';
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001', // shelf tier
    })));

    expect(res.status).toBe(200);
    expect((await res.json()).data.itemsTotalInPaise).toBe(92000);
  });

  it('still rejects a vanished product (404 PRODUCT_NOT_FOUND)', async () => {
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'gone', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('still rejects an unpriceable line (422 VALIDATION)', async () => {
    productById.p1.displayPrice = '₹ on request / pack';
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('rejects an empty body with 422 VALIDATION', async () => {
    const res = await POST(asReq(guestReq({ pincode: '560001' })));

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('rate-limits per client IP before any pricing work', async () => {
    rateLimiterCheck.mockImplementation(async (key: string) => {
      checkCalls.push(key);
      throw new ApiError('RATE_LIMITED', 'Rate limit exceeded');
    });
    const res = await POST(asReq(guestReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '560001',
    })));

    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
    // The bucket is keyed by the forwarded client IP.
    expect(checkCalls[0]).toBe('cart:estimate:203.0.113.7');
  });

  it('buckets by the first x-forwarded-for entry behind the proxy', async () => {
    const res = await POST(asReq(new Request('http://localhost/api/mobile/v1/cart/estimate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.9, 10.0.0.1',
      },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }] }),
    })));

    expect(res.status).toBe(200);
    expect(checkCalls[0]).toBe('cart:estimate:198.51.100.9');
  });
});
