import { describe, it, expect, beforeEach, vi } from 'vitest';

// Path depth: app/api/mobile/v1/account/loyalty/ = 6 dirs -> 6 ../ to root.

// Loyalty state read (A3): mirrors the loyalty-pass count query, but never
// 404s below Silver and never writes WalletPasses.

const { stores, jwtVerify, walletCreate, walletUpdate } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
    walletPasses: new Map<string, Record<string, unknown>>(),
  },
  jwtVerify: vi.fn(async () => ({ customerId: 'cust-1', jti: 'jti-1' })),
  walletCreate: vi.fn(),
  walletUpdate: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: Record<string, unknown>;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const all = col ? Array.from(col.values()) : [];
        const clauses =
          (where as { and?: Array<Record<string, unknown>> })?.and ?? (where ? [where] : []);
        const docs = all.filter((d) =>
          clauses.every((clause) =>
            Object.entries(clause).every(([field, cond]) => {
              const eq = (cond as { equals?: unknown }).equals;
              return eq !== undefined ? d[field] === eq : true;
            }),
          ),
        );
        return { docs, totalDocs: docs.length };
      },
    ),
  })),
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it
// (this route reads no config fields).
vi.mock('../../../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../../../lib/container', () => ({
  container: {
    jwtService: { verify: jwtVerify },
    walletPassService: { createSignedPassUrl: vi.fn() },
  },
}));

import type { NextRequest } from 'next/server';
import { GET } from './route';

// The route types its arg as NextRequest; tests build plain Requests.
function asReq(req: Request): NextRequest {
  return req as unknown as NextRequest;
}

function seedOrders(statuses: string[]) {
  stores.orders.clear();
  statuses.forEach((status, i) => {
    stores.orders.set(`o-${i}`, { id: `o-${i}`, customerId: 'cust-1', status });
  });
}

function authedReq(): Request {
  return new Request('http://localhost/api/mobile/v1/account/loyalty', {
    headers: { authorization: 'Bearer fake-access-token' },
  });
}

describe('GET /account/loyalty', () => {
  beforeEach(() => {
    stores.orders.clear();
    stores.walletPasses.clear();
    walletCreate.mockClear();
    walletUpdate.mockClear();
    jwtVerify.mockClear();
  });

  it('returns tier null + zero count with no delivered orders (never 404s)', async () => {
    const res = await GET(asReq(authedReq()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      deliveredCount: 0,
      tier: null,
      silverAtDelivered: 2,
      goldAtDelivered: 5,
    });
  });

  it('counts only delivered orders (non-delivered statuses excluded)', async () => {
    seedOrders(['delivered', 'confirmed', 'dispatched', 'cancelled']);
    const res = await GET(asReq(authedReq()));
    const body = await res.json();
    expect(body.data.deliveredCount).toBe(1);
    expect(body.data.tier).toBeNull();
  });

  it('reaches Silver at exactly 2 delivered', async () => {
    seedOrders(['delivered', 'delivered']);
    const res = await GET(asReq(authedReq()));
    const body = await res.json();
    expect(body.data.deliveredCount).toBe(2);
    expect(body.data.tier).toBe('silver');
  });

  it('reaches Gold at 5 delivered (and would at 4-still-silver)', async () => {
    seedOrders(['delivered', 'delivered', 'delivered', 'delivered']);
    const four = await (await GET(asReq(authedReq()))).json();
    expect(four.data.tier).toBe('silver');

    seedOrders(Array(5).fill('delivered'));
    const five = await (await GET(asReq(authedReq()))).json();
    expect(five.data.deliveredCount).toBe(5);
    expect(five.data.tier).toBe('gold');
  });

  it('performs no wallet-pass writes', async () => {
    seedOrders(Array(5).fill('delivered'));
    await GET(asReq(authedReq()));
    expect(stores.walletPasses.size).toBe(0);
    expect(walletCreate).not.toHaveBeenCalled();
    expect(walletUpdate).not.toHaveBeenCalled();
  });

  it('returns 401 when auth is missing', async () => {
    const req = new Request('http://localhost/api/mobile/v1/account/loyalty');
    const res = await GET(asReq(req));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });
});
