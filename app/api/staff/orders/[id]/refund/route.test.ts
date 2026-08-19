import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/staff/orders/[id]/refund/ = 6 dirs -> 6 `../`.

// Ops refund (#130): guards (auth, COD, no captured payment, amount bounds),
// adapter call, and payment/order bookkeeping.

const { adminUser, findByID, find, update, refund } = vi.hoisted(() => ({
  adminUser: vi.fn(),
  findByID: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  refund: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ findByID, find, update })),
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));

vi.mock('../../../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../../../lib/api/adminAuth', () => ({
  getPayloadAdminUser: adminUser,
}));

// The container pulls in every service impl at import; mock the module so
// only the paymentService surface the route touches exists.
vi.mock('../../../../../../lib/container', () => ({
  container: { paymentService: { refund } },
}));

import { POST } from './route';

function call(id: string, body: unknown = {}) {
  return POST(
    new Request(`http://localhost/api/staff/orders/${id}/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0],
    { params: Promise.resolve({ id }) },
  );
}

const ORDER = {
  id: 'order-1',
  paymentMethod: 'razorpay',
  paymentStatus: 'paid',
  totals: { totalInPaise: 98050 },
};

const PAY = {
  id: 'pay-1',
  providerPaymentId: 'pay_XYZ',
  amountInPaise: 98050,
  refundedInPaise: 0,
  refunds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  adminUser.mockResolvedValue({ id: 'user-1', email: 'ops@mithai.shop' });
  findByID.mockResolvedValue(ORDER);
  find.mockResolvedValue({ docs: [PAY] });
  refund.mockResolvedValue({ providerRefundId: 'rfd_1' });
  update.mockImplementation(async ({ data }) => data);
});

describe('POST /api/staff/orders/:id/refund', () => {
  it('401s without a staff session', async () => {
    adminUser.mockResolvedValue(null);
    const res = await call('order-1');
    expect(res.status).toBe(401);
    expect(refund).not.toHaveBeenCalled();
  });

  it('404s an unknown order and 409s COD orders', async () => {
    findByID.mockRejectedValue(new Error('Not Found'));
    expect((await call('nope')).status).toBe(404);

    findByID.mockResolvedValue({ ...ORDER, paymentMethod: 'cod' });
    const res = await call('order-1');
    expect(res.status).toBe(409);
    expect(refund).not.toHaveBeenCalled();
  });

  it('409s when no captured online payment exists', async () => {
    find.mockResolvedValue({ docs: [] });
    const res = await call('order-1');
    expect(res.status).toBe(409);
    expect(refund).not.toHaveBeenCalled();
  });

  it('refunds the full remainder by default and books both docs', async () => {
    const res = await call('order-1', { reason: 'damaged in transit' });
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body).toMatchObject({
      paymentId: 'pay-1',
      providerRefundId: 'rfd_1',
      refundedInPaise: 98050,
      totalRefundedInPaise: 98050,
      status: 'refunded',
    });
    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({ providerPaymentId: 'pay_XYZ', amountInPaise: 98050 }),
    );
    // Payment doc: accumulated total + audit row; order: paymentStatus.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'pay-1',
        data: expect.objectContaining({ status: 'refunded', refundedInPaise: 98050 }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        id: 'order-1',
        data: { paymentStatus: 'refunded' },
      }),
    );
  });

  it('supports partial refunds and marks partially_refunded', async () => {
    const res = await call('order-1', { amountInPaise: 40000 });
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.status).toBe('partially_refunded');
    expect(body.totalRefundedInPaise).toBe(40000);
  });

  it('409s when the amount exceeds the remainder', async () => {
    find.mockResolvedValue({
      docs: [{ ...PAY, refundedInPaise: 90000 }],
    });
    const res = await call('order-1', { amountInPaise: 20000 });
    expect(res.status).toBe(409);
    expect(refund).not.toHaveBeenCalled();
  });

  it('409s when already fully refunded', async () => {
    find.mockResolvedValue({
      docs: [{ ...PAY, refundedInPaise: 98050, status: 'refunded' }],
    });
    const res = await call('order-1');
    expect(res.status).toBe(409);
    expect(refund).not.toHaveBeenCalled();
  });
});
