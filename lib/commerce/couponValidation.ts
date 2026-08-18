// lib/commerce/couponValidation.ts
// Coupon rule evaluation — known-gaps campaign B7 (coupons server).
//
// PURE by design: every fact the evaluator needs (the rule row, the usage
// counters, the clock) is injected. No Payload import here — routes fetch
// the coupon row and count prior orders, then hand the numbers over. That
// keeps the whole eligibility + discount matrix unit-testable, and keeps
// this module client-safe if a surface ever needs to explain a rejection.
//
// Evaluating is NOT burning: /cart/validate reads the counters on every
// call but consumes nothing. usedCount is incremented exactly once per
// order created with the code, by PayloadOrderService.createFromSnapshot
// (the razorpay path today, the COD path in B12).
//
// Rejections carry a human-readable `message` (English; clients localize
// off the INVALID_COUPON error code, not this string).

/** The Coupons-collection rule row, as the evaluator sees it. */
export type CouponRule = {
  code: string;
  discountType: 'percent' | 'flat';
  /** percent: 10 = 10% off. flat: value IS paise (10000 = ₹100 off). */
  value: number;
  minSubtotalInPaise?: number | null;
  maxDiscountInPaise?: number | null;
  activeFrom?: string | null;
  activeTo?: string | null;
  /** 0 (and null/undefined) = unlimited. */
  usageLimitTotal?: number | null;
  usageLimitPerCustomer?: number | null;
  usedCount: number;
  active: boolean;
};

/** Usage counters, fetched by the caller: coupon.usedCount + this
 *  customer's lifetime orders carrying the code. */
export type CouponUsage = {
  usedTotal: number;
  usedByCustomer: number;
};

export type CouponRejection =
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'min_subtotal'
  | 'total_limit'
  | 'customer_limit';

export type CouponEvaluation =
  | { ok: true; code: string; discountInPaise: number }
  | { ok: false; code: string; reason: CouponRejection; message: string };

/**
 * Codes are case-insensitive and whitespace-tolerant: the collection stores
 * them uppercased, so " diwali10 " and "DIWALI10" resolve to the same row.
 */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function evaluateCoupon(
  rule: CouponRule,
  itemsTotalInPaise: number,
  usage: CouponUsage,
  now: Date,
): CouponEvaluation {
  const { code } = rule;

  if (!rule.active) {
    return { ok: false, code, reason: 'inactive', message: `Coupon ${code} is not active` };
  }

  const nowMs = now.getTime();
  if (rule.activeFrom) {
    const from = Date.parse(rule.activeFrom);
    if (Number.isFinite(from) && nowMs < from) {
      return { ok: false, code, reason: 'not_started', message: `Coupon ${code} is not active yet` };
    }
  }
  if (rule.activeTo) {
    const to = Date.parse(rule.activeTo);
    if (Number.isFinite(to) && nowMs > to) {
      return { ok: false, code, reason: 'expired', message: `Coupon ${code} has expired` };
    }
  }

  // The minimum judges the PRE-discount items total — the cart's worth,
  // not what remains after the code takes its bite.
  const min = rule.minSubtotalInPaise ?? 0;
  if (min > 0 && itemsTotalInPaise < min) {
    const gapRupees = Math.ceil((min - itemsTotalInPaise) / 100);
    return {
      ok: false,
      code,
      reason: 'min_subtotal',
      message: `Add ₹${gapRupees} more to use coupon ${code}`,
    };
  }

  const totalLimit = rule.usageLimitTotal ?? 0;
  if (totalLimit > 0 && usage.usedTotal >= totalLimit) {
    return { ok: false, code, reason: 'total_limit', message: `Coupon ${code} has been fully redeemed` };
  }
  const customerLimit = rule.usageLimitPerCustomer ?? 0;
  if (customerLimit > 0 && usage.usedByCustomer >= customerLimit) {
    return {
      ok: false,
      code,
      reason: 'customer_limit',
      message: `You have already used coupon ${code}`,
    };
  }

  let discount: number;
  if (rule.discountType === 'percent') {
    // Floor so a percent never rounds UP into over-discounting.
    discount = Math.floor((itemsTotalInPaise * rule.value) / 100);
    const cap = rule.maxDiscountInPaise ?? 0;
    if (cap > 0) discount = Math.min(discount, cap);
  } else {
    discount = rule.value;
  }
  // A code can never discount more than the goods themselves (flat ₹100
  // off a ₹80 cart → ₹80 off; delivery is still charged on top).
  discount = Math.max(0, Math.min(discount, itemsTotalInPaise));

  return { ok: true, code, discountInPaise: discount };
}
