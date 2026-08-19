import { describe, it, expect } from 'vitest';

// Packing-slip projection (#126): populated order doc -> print DTO, plus
// the ₹ formatter shared with the slip (Indian grouping, paise-aware).

import { toPackingSlip, slipRupees } from './packingSlip';

const DOC = {
  id: '6a7fa4b40bf2f1a8854e3d99',
  createdAt: '2026-08-19T04:30:00.000Z',
  status: 'confirmed',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  couponCode: 'TEST100',
  customerId: { id: 'cust-1', name: 'Ravi', phone: '+918088983014' },
  deliveryAddressId: {
    id: 'addr-1',
    line1: '12 Brigade Road',
    line2: 'Apt 3',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  },
  slot: { date: '2026-08-20T00:00:00.000Z', window: '10:00–13:00' },
  items: [
    {
      name: 'Kaju Katli',
      packLabel: '500 g box',
      quantity: 2,
      unit: 'box',
      priceInPaise: 45000,
    },
    { name: 'Mysore Pak', quantity: 1, unit: 'pack', priceInPaise: 18050 },
  ],
  totals: {
    itemsTotalInPaise: 108050,
    deliveryFeeInPaise: 0,
    taxesInPaise: 0,
    discountInPaise: 10000,
    totalInPaise: 98050,
  },
};

describe('toPackingSlip', () => {
  it('projects a populated order into the print DTO', () => {
    const slip = toPackingSlip(DOC);
    expect(slip.shortId).toBe('4e3d99');
    expect(slip.customerName).toBe('Ravi');
    expect(slip.phone).toBe('+918088983014');
    expect(slip.address).toEqual({
      line1: '12 Brigade Road',
      line2: 'Apt 3',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    });
    expect(slip.lines).toEqual([
      { name: 'Kaju Katli', packLabel: '500 g box', quantity: 2, unit: 'box', lineTotalInPaise: 90000 },
      { name: 'Mysore Pak', packLabel: null, quantity: 1, unit: 'pack', lineTotalInPaise: 18050 },
    ]);
    expect(slip.totalInPaise).toBe(98050);
    expect(slip.discountInPaise).toBe(10000);
    expect(slip.slotWindow).toBe('10:00–13:00');
    expect(slip.paymentMethod).toBe('cod');
    expect(slip.couponCode).toBe('TEST100');
  });

  it('degrades to nulls when customer/address arrive as bare ids', () => {
    const slip = toPackingSlip({
      ...DOC,
      customerId: 'cust-1',
      deliveryAddressId: 'addr-1',
      slot: {},
      couponCode: null,
    });
    expect(slip.customerName).toBeNull();
    expect(slip.phone).toBeNull();
    expect(slip.address).toBeNull();
    expect(slip.slotWindow).toBeNull();
    expect(slip.couponCode).toBeNull();
  });

  it('defaults razorpay when paymentMethod is missing and skips empty items', () => {
    const slip = toPackingSlip({ id: 'x1', items: [] });
    expect(slip.paymentMethod).toBe('razorpay');
    expect(slip.lines).toEqual([]);
    // Missing quantity/price default so a malformed row still renders.
    const one = toPackingSlip({ id: 'x2', items: [{ name: 'Laddu' }] });
    expect(one.lines[0]).toEqual({
      name: 'Laddu',
      packLabel: null,
      quantity: 1,
      unit: '',
      lineTotalInPaise: 0,
    });
  });
});

describe('slipRupees', () => {
  it('formats with Indian digit grouping and paise-aware decimals', () => {
    expect(slipRupees(225800)).toBe('₹2,258');
    expect(slipRupees(98050)).toBe('₹980.50');
    expect(slipRupees(123450)).toBe('₹1,234.50');
    expect(slipRupees(0)).toBe('₹0');
  });

  it('renders a dash for missing values', () => {
    expect(slipRupees(null)).toBe('—');
    expect(slipRupees(undefined)).toBe('—');
  });
});
