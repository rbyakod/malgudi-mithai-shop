import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/staff/orders/[id]/collect-cash/ = 6 dirs -> 6 `../`.

// COD cash-collected (known-gaps B13): the only writer of paymentStatus for
// COD orders. cod+pending -> paid; everything else is a 409; no staff
// session is a 401.

const { stores, adminUser, findByID, update } = vi.hoisted(() => ({
  stores: { orders: new Map<string, Record<string, unknown>>() },
  adminUser: vi.fn(),
  findByID: vi.fn(),
  update: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    findByID,
    update,
  })),
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it.
vi.mock('../../../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../../../lib/api/adminAuth', () => ({
  getPayloadAdminUser: adminUser,
}));

import { POST } from './route';

type NextRequestCompat = Parameters<typeof POST>[0];

function req(id = 'order-1'): Request {
  return new Request(`http://localhost/api/staff/orders/${id}/collect-cash`, {
    method: 'POST',
  });
}

function call(id: string) {
  return POST(req(id) as NextRequestCompat, { params: Promise.resolve({ id }) });
}

function seed(over: Partial<Record<string, unknown>> = {}) {
  const doc: Record<string, unknown> = {
    id: 'order-1',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    status: 'delivered',
    ...over,
  };
  stores.orders.set('order-1', doc);
  findByID.mockImplementation(async () => doc);
  update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...doc,
      ...data,
    }),
  );
  return doc;
}

beforeEach(() => {
  stores.orders.clear();
  findByID.mockReset();
  update.mockReset();
  adminUser.mockReset();
  adminUser.mockResolvedValue({ id: 'admin-1', role: 'ops' });
});

describe('POST /api/staff/orders/:id/collect-cash', () => {
  it('marks a delivered cod order paid and returns the minimal row', async () => {
    seed();
    const res = await call('order-1');
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data).toEqual({ id: 'order-1', paymentStatus: 'paid', paymentMethod: 'cod' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        id: 'order-1',
        data: { paymentStatus: 'paid' },
        overrideAccess: true,
      }),
    );
  });

  it('409 for an online (razorpay) order — settlement is Razorpay\'s, not ours', async () => {
    seed({ paymentMethod: 'razorpay', paymentStatus: 'paid' });
    const res = await call('order-1');
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toContain('COD orders only');
    expect(update).not.toHaveBeenCalled();
  });

  it('409 when cash was already collected (no double-collect)', async () => {
    seed({ paymentStatus: 'paid' });
    const res = await call('order-1');
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toContain('already collected');
    expect(update).not.toHaveBeenCalled();
  });

  it('409 for any non-pending payment state', async () => {
    seed({ paymentStatus: 'refunded' });
    const res = await call('order-1');
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toContain('refunded');
  });

  it('404 when the order does not exist', async () => {
    findByID.mockRejectedValue(new Error('not found'));
    const res = await call('missing');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('ORDER_NOT_FOUND');
  });

  it('401 when no staff session resolves', async () => {
    seed();
    adminUser.mockResolvedValue(undefined);
    const res = await call('order-1');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('TOKEN_EXPIRED');
    expect(update).not.toHaveBeenCalled();
  });
});
