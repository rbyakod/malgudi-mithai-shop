import { describe, it, expect } from 'vitest';

// Orders CSV export (#128): RFC 4180 mapping from feed rows.

import { exportFileName, ordersToCsv } from './ordersCsv';

const ROW = {
  id: '6a7fa4b40bf2f1a8854e3d99',
  createdAt: '2026-08-19T04:30:00.000Z',
  status: 'confirmed',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  source: 'web',
  couponCode: 'DIWALI100',
  totalInPaise: 98050,
  customerName: 'Ravi',
  phone: '+918088983014',
};

describe('ordersToCsv', () => {
  it('emits the header plus one row per order', () => {
    const csv = ordersToCsv([ROW]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'Order ID,Short ID,Placed at (UTC),Customer,Phone,Source,Payment method,Payment status,Coupon,Status,Total (INR)',
    );
    expect(lines[1]).toBe(
      '6a7fa4b40bf2f1a8854e3d99,4e3d99,2026-08-19T04:30:00.000Z,Ravi,+918088983014,web,COD,pending,DIWALI100,confirmed,980.50',
    );
    // header + row + the trailing empty element from the final CRLF
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("");
  });

  it('quotes cells with commas or quotes and doubles embedded quotes', () => {
    const csv = ordersToCsv([
      { ...ROW, customerName: 'Byakod, Ravi "RK"', couponCode: null },
    ]);
    expect(csv).toContain('"Byakod, Ravi ""RK"""');
    // Null coupon renders as an empty cell, not the string "null".
    expect(csv).toContain('COD,pending,,confirmed');
  });

  it('renders missing money/dates as empty cells and labels online payments', () => {
    const csv = ordersToCsv([
      { id: 'x1', paymentMethod: 'razorpay' },
    ]);
    expect(csv.split('\r\n')[1]).toBe('x1,x1,,,,,Online,,,,');
  });

  it('returns just the header for no rows', () => {
    expect(ordersToCsv([])).toBe(
      'Order ID,Short ID,Placed at (UTC),Customer,Phone,Source,Payment method,Payment status,Coupon,Status,Total (INR)\r\n',
    );
  });
});

describe('exportFileName', () => {
  it('names bounded, half-bounded, and unbounded exports', () => {
    expect(exportFileName('2026-08-01T00:00:00.000Z', '2026-08-19T23:59:59.000Z')).toBe(
      'mishran-orders-20260801000000-to-20260819235959.csv',
    );
    expect(exportFileName('2026-08-01', undefined)).toBe('mishran-orders-from-20260801.csv');
    expect(exportFileName(undefined, '2026-08-19')).toBe('mishran-orders-to-20260819.csv');
    expect(exportFileName()).toBe('mishran-orders-all.csv');
  });
});
