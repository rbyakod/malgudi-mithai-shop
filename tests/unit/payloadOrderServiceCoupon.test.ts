import { describe, it, expect, vi, beforeEach } from 'vitest';

// PayloadOrderService.createFromSnapshot is the ONLY writer of
// Coupons.usedCount (B7): validate evaluates, order creation burns. This
// test pins the wiring — couponCode copied onto the order doc, usedCount
// incremented exactly once, and no coupons traffic at all when the
// snapshot carries no code.

const { orderCreates, couponUpdates, couponsFound } = vi.hoisted(() => ({
  orderCreates: [] as Array<Record<string, unknown>>,
  couponUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  couponsFound: { count: 0 },
}));

vi.mock('payload', () => {
  const find = vi.fn(async function (args: { collection?: string }) {
    if (args && args.collection === 'coupons') {
      couponsFound.count += 1;
      return { docs: [{ id: 'cpn1', code: 'FLAT100', usedCount: 41 }] };
    }
    return { docs: [] };
  });
  const create = vi.fn(async function (args: { collection?: string; data?: Record<string, unknown> }) {
    if (args && args.collection === 'orders') {
      orderCreates.push(args.data ?? {});
      return {
        id: 'order-1',
        customerId: (args.data ?? {}).customerId,
        items: (args.data ?? {}).items,
        totals: (args.data ?? {}).totals,
        status: 'pending_payment',
        paymentStatus: 'pending',
        couponCode: (args.data ?? {}).couponCode ?? null,
        deliveryAddressId: (args.data ?? {}).deliveryAddressId,
        slot: (args.data ?? {}).slot,
        source: (args.data ?? {}).source,
        createdAt: '2026-08-18T05:00:00.000Z',
        updatedAt: '2026-08-18T05:00:00.000Z',
      };
    }
    return { id: 'mock' };
  });
  const update = vi.fn(async function (args: { collection?: string; id?: string; data?: Record<string, unknown> }) {
    if (args && args.collection === 'coupons') {
      couponUpdates.push({ id: String(args.id), data: args.data ?? {} });
    }
    return { id: args.id, ...(args.data ?? {}) };
  });
  return { getPayload: vi.fn(async () => ({ find, create, update })) };
});

vi.mock('../../payload.config', () => ({ default: {} }));

import { PayloadOrderService } from '../../lib/commerce/impl/PayloadOrderService';

const SNAPSHOT = {
  snapshotId: 'snap-1',
  items: [
    {
      productId: 'p1',
      slug: 'kaju-katli',
      name: 'Kaju Katli',
      quantity: 1,
      packLabel: null,
      unit: '250g',
      priceInPaise: 92000,
    },
  ],
  totals: {
    itemsTotalInPaise: 92000,
    deliveryFeeInPaise: 9900,
    taxesInPaise: 0,
    discountInPaise: 10000,
    totalInPaise: 91900,
  },
  deliveryAddressId: 'addr-1',
  slot: { date: '2026-08-19', window: '10:00-14:00' },
};

describe('PayloadOrderService.createFromSnapshot coupon burn (B7)', () => {
  beforeEach(() => {
    orderCreates.length = 0;
    couponUpdates.length = 0;
    couponsFound.count = 0;
  });

  it('stamps couponCode on the order and increments usedCount exactly once', async () => {
    const svc = new PayloadOrderService();
    const order = await svc.createFromSnapshot(
      { ...SNAPSHOT, couponCode: 'FLAT100' },
      'cust-1',
      'web',
    );

    expect(orderCreates).toHaveLength(1);
    expect(orderCreates[0]).toMatchObject({ couponCode: 'FLAT100' });
    expect(order.couponCode).toBe('FLAT100');

    expect(couponUpdates).toEqual([
      { id: 'cpn1', data: { usedCount: 42 } }, // 41 + 1, nothing else touched
    ]);
  });

  it('null couponCode on the order; zero coupons traffic without a code', async () => {
    const svc = new PayloadOrderService();
    const order = await svc.createFromSnapshot(SNAPSHOT, 'cust-1', 'mobile-ios');

    expect(orderCreates[0]).toMatchObject({ couponCode: null });
    expect(order.couponCode).toBeNull();
    expect(couponsFound.count).toBe(0);
    expect(couponUpdates).toHaveLength(0);
  });
});
