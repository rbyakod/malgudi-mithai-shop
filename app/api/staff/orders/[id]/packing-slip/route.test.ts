import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/staff/orders/[id]/packing-slip/ = 6 dirs -> 6 `../`.

// Packing slip (#126): staff-gated single-order projection for print.
// 401 without a staff session; 404 unknown order; 200 with the mapped DTO
// (customer + address populated by the route's depth-1 fetch).

const { adminUser, findByID } = vi.hoisted(() => ({
  adminUser: vi.fn(),
  findByID: vi.fn(),
}));

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ findByID })),
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));

// lib/api/response -> Logger -> lib/config parses env at import; stub it.
vi.mock('../../../../../../lib/config', () => ({ config: {} }));

vi.mock('../../../../../../lib/api/adminAuth', () => ({
  getPayloadAdminUser: adminUser,
}));

import { GET } from './route';

type NextRequestCompat = Parameters<typeof GET>[0];

function call(id: string) {
  return GET(req(id) as NextRequestCompat, { params: Promise.resolve({ id }) });
}

function req(id: string): Request {
  return new Request(`http://localhost/api/staff/orders/${id}/packing-slip`);
}

const DOC = {
  id: 'order-1',
  createdAt: '2026-08-19T04:30:00.000Z',
  status: 'confirmed',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  totals: { totalInPaise: 98050 },
  customerId: { id: 'cust-1', name: 'Ravi', phone: '+918088983014' },
  deliveryAddressId: {
    id: 'addr-1',
    line1: '12 Brigade Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  },
  items: [{ name: 'Kaju Katli', quantity: 2, unit: 'box', priceInPaise: 45000 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  adminUser.mockResolvedValue({ id: 'user-1', role: 'admin' });
});

describe('GET /api/staff/orders/:id/packing-slip', () => {
  it('401s without a staff session', async () => {
    adminUser.mockResolvedValue(null);
    const res = await call('order-1');
    expect(res.status).toBe(401);
    expect(findByID).not.toHaveBeenCalled();
  });

  it('404s an unknown order id', async () => {
    findByID.mockRejectedValue(new Error('Not Found'));
    const res = await call('nope');
    expect(res.status).toBe(404);
  });

  it('returns the projected slip for a real order', async () => {
    findByID.mockResolvedValue(DOC);
    const res = await call('order-1');
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.shortId).toBe('rder-1');
    expect(body.customerName).toBe('Ravi');
    expect(body.phone).toBe('+918088983014');
    expect(body.address.city).toBe('Bengaluru');
    expect(body.lines[0].lineTotalInPaise).toBe(90000);
    expect(body.paymentMethod).toBe('cod');
    // The route fetches depth 1 so relations arrive populated for print.
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'orders', depth: 1, overrideAccess: true }),
    );
  });
});
