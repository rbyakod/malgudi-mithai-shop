import { describe, it, expect } from 'vitest';
import {
  evaluateCoupon,
  normalizeCouponCode,
  type CouponRule,
} from '../../lib/commerce/couponValidation';

// evaluateCoupon is the coupons eligibility + discount matrix (B7). Every
// fact is injected — rule row, usage counters, clock — so the whole matrix
// is pure table-driven coverage here; the route test then only needs to
// prove wiring (fetch, count, stamp).

const NOW = new Date('2026-08-18T10:00:00.000Z');

function baseRule(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    code: 'DIWALI10',
    discountType: 'percent',
    value: 10,
    minSubtotalInPaise: null,
    maxDiscountInPaise: null,
    activeFrom: null,
    activeTo: null,
    usageLimitTotal: null,
    usageLimitPerCustomer: null,
    usedCount: 0,
    active: true,
    ...overrides,
  };
}

const NO_USAGE = { usedTotal: 0, usedByCustomer: 0 };

describe('normalizeCouponCode', () => {
  it('trims and uppercases — codes are case-insensitive', () => {
    expect(normalizeCouponCode(' diwali10 ')).toBe('DIWALI10');
    expect(normalizeCouponCode('FirstOrder')).toBe('FIRSTORDER');
  });
});

describe('evaluateCoupon (B7 matrix)', () => {
  it('applies a percent code, floored to whole paise', () => {
    // 10% of ₹925 = ₹92.50 → floor to 9250 → ₹92.50 exactly; use a value
    // that floors: 10% of ₹929 = 92900 → 9290 exactly. Use 15% of ₹999:
    // 99900 * 15 / 100 = 14985 → exact. Force a floor with 33% of ₹1:
    // 100 * 33 / 100 = 33 exact... pick 7% of ₹999 = 6993 exact. The real
    // floor case: 10% of ₹925.50 → below paise precision can't happen, so
    // floor on percent-of-paise is a guard, proven with 3 coupons at 10%
    // of 92501 paise → 9250.1 → 9250.
    const rule = baseRule({ discountType: 'percent', value: 10 });
    const result = evaluateCoupon(rule, 92501, NO_USAGE, NOW);
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 9250 });
  });

  it('caps a percent code at maxDiscountInPaise', () => {
    // 10% of ₹5,000 = ₹500, capped at ₹200.
    const rule = baseRule({ discountType: 'percent', value: 10, maxDiscountInPaise: 20000 });
    const result = evaluateCoupon(rule, 500000, NO_USAGE, NOW);
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 20000 });
  });

  it('applies a flat code in paise and floors it at the items total', () => {
    // Flat ₹100 off a ₹80 cart → ₹80 off (delivery still charged on top;
    // a code can never earn the customer money).
    const rule = baseRule({ discountType: 'flat', value: 10000 });
    const result = evaluateCoupon(rule, 8000, NO_USAGE, NOW);
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 8000 });
  });

  it('rejects an inactive code', () => {
    const result = evaluateCoupon(baseRule({ active: false }), 100000, NO_USAGE, NOW);
    expect(result).toMatchObject({ ok: false, reason: 'inactive' });
  });

  it('rejects before the window opens and after it closes', () => {
    const early = evaluateCoupon(
      baseRule({ activeFrom: '2026-10-01T00:00:00.000Z' }),
      100000,
      NO_USAGE,
      NOW,
    );
    expect(early).toMatchObject({ ok: false, reason: 'not_started' });

    const late = evaluateCoupon(
      baseRule({ activeTo: '2026-08-01T00:00:00.000Z' }),
      100000,
      NO_USAGE,
      NOW,
    );
    expect(late).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('accepts inside the window', () => {
    const rule = baseRule({
      activeFrom: '2026-08-01T00:00:00.000Z',
      activeTo: '2026-10-01T00:00:00.000Z',
    });
    const result = evaluateCoupon(rule, 100000, NO_USAGE, NOW);
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 10000 });
  });

  it('judges minSubtotal against the PRE-discount items total', () => {
    // Cart ₹1,000 with a min of ₹1,000: eligible even though 10% off would
    // drop the payable below the min — the min describes the cart's worth.
    const rule = baseRule({ minSubtotalInPaise: 100000 });
    const result = evaluateCoupon(rule, 100000, NO_USAGE, NOW);
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 10000 });

    const short = evaluateCoupon(rule, 99900, NO_USAGE, NOW);
    expect(short).toMatchObject({ ok: false, reason: 'min_subtotal' });
    expect(short.ok === false && short.message).toContain('₹1 more');
  });

  it('rejects when the total usage limit is exhausted', () => {
    const rule = baseRule({ usageLimitTotal: 100, usedCount: 100 });
    const result = evaluateCoupon(rule, 100000, { usedTotal: 100, usedByCustomer: 0 }, NOW);
    expect(result).toMatchObject({ ok: false, reason: 'total_limit' });
  });

  it('rejects when the per-customer limit is exhausted', () => {
    const rule = baseRule({ usageLimitPerCustomer: 1 });
    const result = evaluateCoupon(rule, 100000, { usedTotal: 500, usedByCustomer: 1 }, NOW);
    expect(result).toMatchObject({ ok: false, reason: 'customer_limit' });
  });

  it('treats 0 usage limits as unlimited', () => {
    const rule = baseRule({ usageLimitTotal: 0, usageLimitPerCustomer: 0, usedCount: 9999 });
    const result = evaluateCoupon(
      rule,
      100000,
      { usedTotal: 9999, usedByCustomer: 42 },
      NOW,
    );
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 10000 });
  });

  it('never discounts a zero-paise cart into the negative', () => {
    const rule = baseRule({ discountType: 'flat', value: 10000 });
    const result = evaluateCoupon(rule, 0, NO_USAGE, NOW);
    expect(result).toEqual({ ok: true, code: 'DIWALI10', discountInPaise: 0 });
  });
});
