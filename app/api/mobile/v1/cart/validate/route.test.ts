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

// Mutable fixture holders so each test can shape Payload responses.
let pincodeDocs: any[] = [];
let productById: Record<string, any> = {};

vi.mock('payload', () => {
  const find = vi.fn(async function (args: any) {
    // Only the serviceablePincodes lookup is expected today.
    if (args && args.collection === 'serviceablePincodes') {
      return { docs: pincodeDocs };
    }
    return { docs: [] };
  });
  const findByID = vi.fn(async function (args: any) {
    const id = args && args.id;
    return productById[id] ?? null;
  });
  const payloadStub = { find: find, findByID: findByID };
  const getPayload = vi.fn(async function () {
    return payloadStub;
  });
  return { getPayload: getPayload };
});

// Stub payload.config so its heavy import graph is not evaluated in unit test.
vi.mock('../../../../../../payload.config', () => ({ default: {} }));

import { POST } from './route';

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
        freshnessStatus: 'made-daily',
      },
    };
  });

  it('returns 200 with a cart snapshot for a valid body', async () => {
    const res = await POST(authedReq({
      items: [{ productId: 'p1', quantity: 2 }],
      pincode: '560001',
    }) as any);

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
      freshnessStatus: 'made-daily',
    });
    // NOTE: totals are zero today; real pricing lands in Phase 8.
    expect(body.data.totals.totalInPaise).toBe(0);
    expect(body.data.totals.itemsTotalInPaise).toBe(0);
  });

  it('returns 404 PRODUCT_NOT_FOUND when a product no longer exists', async () => {
    const res = await POST(authedReq({
      items: [{ productId: 'gone', quantity: 1 }],
      pincode: '560001',
    }) as any);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 422 PINCODE_NOT_SERVICEABLE when pincode is not served', async () => {
    pincodeDocs = []; // unserviceable
    const res = await POST(authedReq({
      items: [{ productId: 'p1', quantity: 1 }],
      pincode: '999999',
    }) as any);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('PINCODE_NOT_SERVICEABLE');
  });

  it('returns 422 VALIDATION when body is missing items', async () => {
    const res = await POST(authedReq({
      pincode: '560001',
    }) as any);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });
});
