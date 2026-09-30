// lib/commerce/deliveryRules.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeTotals } from "./pricing";
import { MAX_FEE_RUPEES, MAX_THRESHOLD_RUPEES, validateRupees } from "./deliveryLimits";

const { findGlobal } = vi.hoisted(() => ({ findGlobal: vi.fn() }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ findGlobal })) }));
vi.mock("../../payload.config", () => ({ default: {} }));
vi.mock("../config", () => ({
  config: {
    deliveryFeeFreshPaise: 4900,
    deliveryFeeShelfStablePaise: 9900,
    freeDeliveryThresholdFreshPaise: 99900,
    freeDeliveryThresholdShelfStablePaise: 199900,
  },
}));

import { CACHE_MS, clearDeliveryRulesCache, getDeliveryRules, resolveDeliveryRules } from "./deliveryRules";

const ENV = {
  deliveryFeeFreshPaise: 4900,
  deliveryFeeShelfStablePaise: 9900,
  freeDeliveryThresholdFreshPaise: 99900,
  freeDeliveryThresholdShelfStablePaise: 199900,
};

describe("resolveDeliveryRules", () => {
  it("uses the server values when nothing is set in the admin", () => {
    for (const g of [null, undefined, {}, { freshFee: null, shelfStableFee: null }]) {
      expect(resolveDeliveryRules(g, ENV)).toEqual({
        fees: { freshPaise: 4900, shelfStablePaise: 9900 },
        freeThresholds: { freshPaise: 99900, shelfStablePaise: 199900 },
      });
    }
  });

  it("converts admin rupees to paise, field by field, over the server values", () => {
    const r = resolveDeliveryRules({ freshFee: 30, freshFreeThreshold: 500 }, ENV);
    expect(r.fees).toEqual({ freshPaise: 3000, shelfStablePaise: 9900 });
    expect(r.freeThresholds).toEqual({ freshPaise: 50000, shelfStablePaise: 199900 });
  });

  it("treats 0 as a real value: a free delivery fee, or free delivery switched off", () => {
    const r = resolveDeliveryRules({ freshFee: 0, shelfStableFreeThreshold: 0 }, ENV);
    expect(r.fees.freshPaise).toBe(0);
    expect(r.freeThresholds.shelfStablePaise).toBe(0);
  });

  it("ignores an amount outside the allowed range instead of charging it", () => {
    const r = resolveDeliveryRules({ freshFee: 9999, shelfStableFee: 501, freshFreeThreshold: 100001, shelfStableFreeThreshold: 12.5 }, ENV);
    expect(r.fees).toEqual({ freshPaise: 4900, shelfStablePaise: 9900 });
    expect(r.freeThresholds).toEqual({ freshPaise: 99900, shelfStablePaise: 199900 });
    expect(resolveDeliveryRules({ freshFee: 500, freshFreeThreshold: 100000 }, ENV).fees.freshPaise).toBe(50000);
  });

  it("ignores values that are not a valid amount", () => {
    const r = resolveDeliveryRules({ freshFee: -5, shelfStableFee: "12", freshFreeThreshold: Number.NaN, shelfStableFreeThreshold: Infinity }, ENV);
    expect(r.fees).toEqual({ freshPaise: 4900, shelfStablePaise: 9900 });
    expect(r.freeThresholds).toEqual({ freshPaise: 99900, shelfStablePaise: 199900 });
  });

  it("changes what a cart is charged: a lower threshold makes delivery free", () => {
    const items = [{ productId: "p", name: "Box", quantity: 1, priceInPaise: 60000, unit: "500g" }] as never;
    const before = computeTotals(items, "fresh", ...(Object.values(resolveDeliveryRules(null, ENV)) as [never, never]));
    expect(before.deliveryFeeInPaise).toBe(4900);
    const rules = resolveDeliveryRules({ freshFreeThreshold: 500 }, ENV);
    const after = computeTotals(items, "fresh", rules.fees, rules.freeThresholds);
    expect(after.deliveryFeeInPaise).toBe(0);
    expect(after.totalInPaise).toBe(60000);
  });
});

describe("getDeliveryRules (cached read)", () => {
  beforeEach(() => {
    findGlobal.mockReset();
    clearDeliveryRulesCache();
  });

  it("reads the admin settings and caches them for a short time", async () => {
    findGlobal.mockResolvedValue({ freshFee: 25 });
    const t0 = 1_000_000;
    expect((await getDeliveryRules(t0)).fees.freshPaise).toBe(2500);
    findGlobal.mockResolvedValue({ freshFee: 60 });
    expect((await getDeliveryRules(t0 + CACHE_MS - 1)).fees.freshPaise).toBe(2500);
    expect(findGlobal).toHaveBeenCalledTimes(1);
    expect((await getDeliveryRules(t0 + CACHE_MS + 1)).fees.freshPaise).toBe(6000);
    expect(findGlobal).toHaveBeenCalledTimes(2);
  });

  it("falls back to the server values instead of failing when the database read fails", async () => {
    findGlobal.mockRejectedValue(new Error("db down"));
    const r = await getDeliveryRules(5_000_000);
    expect(r.fees.freshPaise).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.freeThresholds.shelfStablePaise)).toBe(true);
  });
});

describe("admin field validation (validateRupees)", () => {
  const fee = validateRupees(MAX_FEE_RUPEES);
  it("allows empty (use the server value) and amounts in range, including 0", () => {
    expect(fee(undefined)).toBe(true);
    expect(fee(null)).toBe(true);
    expect(fee(0)).toBe(true);
    expect(fee(49)).toBe(true);
    expect(fee(MAX_FEE_RUPEES)).toBe(true);
    expect(validateRupees(MAX_THRESHOLD_RUPEES)(MAX_THRESHOLD_RUPEES)).toBe(true);
  });
  it("refuses negatives, amounts over the limit, and fractions", () => {
    expect(fee(-5)).toMatch(/between ₹0 and ₹500/);
    expect(fee(9999)).toMatch(/between ₹0 and ₹500/);
    expect(fee(501)).toMatch(/between/);
    expect(fee(12.5)).toMatch(/whole number/);
    expect(validateRupees(MAX_THRESHOLD_RUPEES)(100001)).toMatch(/between ₹0 and ₹1,00,000/);
  });
});
