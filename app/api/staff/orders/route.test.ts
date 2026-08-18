import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/staff/orders/ = 4 dirs under app/, so 4 `../` to root.

// Staff orders feed (known-gaps B13): staff-gated list with console
// filters, phone->customer resolution, and a minimal row projection.

const { ordersFind, customersFind, adminUser } = vi.hoisted(() => ({
  ordersFind: vi.fn(),
  customersFind: vi.fn(),
  adminUser: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    // Dispatch to the per-collection spy, forwarding the route's args so
    // the where/sort/page assertions below can read them.
    find: async (args: { collection: string }) =>
      args.collection === 'customers' ? customersFind(args) : ordersFind(args),
  })),
}));

vi.mock('../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it.
vi.mock('../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../lib/api/adminAuth', () => ({
  getPayloadAdminUser: adminUser,
}));

import { GET } from './route';

type NextRequestCompat = Parameters<typeof GET>[0];

function req(url = 'http://localhost/api/staff/orders'): Request {
  return new Request(url);
}

function seedOrdersFind(docs: Record<string, unknown>[] = []) {
  ordersFind.mockResolvedValue({
    docs,
    page: 1,
    limit: 50,
    totalDocs: docs.length,
    totalPages: 1,
    hasNextPage: false,
  });
}

const DOC = {
  id: 'order-1',
  createdAt: '2026-08-17T10:00:00.000Z',
  status: 'confirmed',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  source: 'web',
  couponCode: null,
  totals: { totalInPaise: 38900 },
  customerId: { id: 'cust-1', name: 'Ravi', phone: '+918088983014' },
};

beforeEach(() => {
  ordersFind.mockReset();
  customersFind.mockReset();
  adminUser.mockReset();
  adminUser.mockResolvedValue({ id: 'admin-1', role: 'ops' });
});

describe('GET /api/staff/orders', () => {
  it('401 when no staff session resolves', async () => {
    adminUser.mockResolvedValue(undefined);
    const res = await GET(req() as NextRequestCompat);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('TOKEN_EXPIRED');
    expect(ordersFind).not.toHaveBeenCalled();
  });

  it('maps rows minimally: phone/name from the populated customer, no address or items', async () => {
    seedOrdersFind([DOC, { ...DOC, id: 'order-2', paymentMethod: undefined }]);
    const res = await GET(req() as NextRequestCompat);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.totalDocs).toBe(2);
    expect(data.items[0]).toEqual({
      id: 'order-1',
      createdAt: DOC.createdAt,
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      source: 'web',
      couponCode: null,
      totalInPaise: 38900,
      customerName: 'Ravi',
      phone: '+918088983014',
    });
    // Legacy rows without paymentMethod default to razorpay.
    expect(data.items[1].paymentMethod).toBe('razorpay');
    const row = JSON.stringify(data.items[0]);
    expect(row).not.toContain('deliveryAddressId');
    expect(row).not.toContain('items');
  });

  it('queries newest-first with overrideAccess and pagination from the query string', async () => {
    seedOrdersFind([]);
    const res = await GET(
      req('http://localhost/api/staff/orders?page=2&pageSize=25') as NextRequestCompat,
    );
    expect(res.status).toBe(200);
    expect(ordersFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        sort: '-createdAt',
        page: 2,
        limit: 25,
        depth: 1,
        overrideAccess: true,
      }),
    );
  });

  it('builds where clauses for every console filter', async () => {
    seedOrdersFind([]);
    const res = await GET(
      req(
        'http://localhost/api/staff/orders?status=confirmed&paymentMethod=cod' +
          '&paymentStatus=pending&source=web&from=2026-08-01T00:00:00.000Z&to=2026-08-17T23:59:59.000Z',
      ) as NextRequestCompat,
    );
    expect(res.status).toBe(200);
    expect(ordersFind.mock.calls[0][0].where).toEqual({
      and: [
        { status: { equals: 'confirmed' } },
        { paymentMethod: { equals: 'cod' } },
        { paymentStatus: { equals: 'pending' } },
        { source: { equals: 'web' } },
        { createdAt: { greater_than_equal: '2026-08-01T00:00:00.000Z' } },
        { createdAt: { less_than_equal: '2026-08-17T23:59:59.000Z' } },
      ],
    });
  });

  it('resolves phone q to a customerId in-clause (digits only sent to customers)', async () => {
    seedOrdersFind([]);
    customersFind.mockResolvedValue({
      docs: [{ id: 'cust-1' }, { id: 'cust-2' }],
    });
    const res = await GET(
      req('http://localhost/api/staff/orders?q=%2B91%2080889%2083014') as NextRequestCompat,
    );
    expect(res.status).toBe(200);
    expect(customersFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'customers',
        where: { phone: { like: '918088983014' } },
      }),
    );
    expect(ordersFind.mock.calls[0][0].where).toEqual({
      and: [{ customerId: { in: ['cust-1', 'cust-2'] } }],
    });
  });

  it('returns an empty page without querying orders when a phone matches no customer', async () => {
    customersFind.mockResolvedValue({ docs: [] });
    const res = await GET(
      req('http://localhost/api/staff/orders?q=9999999999') as NextRequestCompat,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.items).toEqual([]);
    expect(data.totalDocs).toBe(0);
    expect(ordersFind).not.toHaveBeenCalled();
  });

  it('treats non-phone q as an order id equality', async () => {
    seedOrdersFind([]);
    const res = await GET(
      req('http://localhost/api/staff/orders?q=6a83ff95e2c8379b4140530c') as NextRequestCompat,
    );
    expect(res.status).toBe(200);
    expect(ordersFind.mock.calls[0][0].where).toEqual({
      and: [{ id: { equals: '6a83ff95e2c8379b4140530c' } }],
    });
  });

  it('422 when pageSize exceeds the cap', async () => {
    const res = await GET(
      req('http://localhost/api/staff/orders?pageSize=500') as NextRequestCompat,
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });
});
