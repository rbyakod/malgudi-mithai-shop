// tests/unit/pricing.test.ts
// lib/commerce/pricing.ts — the server pricing truth behind /cart/validate.
//
// Path depth: tests/unit/ = 2 dirs under repo root → `../../` to root.
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parsePricePaise,
  resolveLinePrice,
  computeTotals,
  normalizeSlot,
} from '../../lib/commerce/pricing';
import { derivePackSizes } from '../../lib/mithai/packSizes';

describe('parsePricePaise', () => {
  it('parses plain per-gram display prices', () => {
    expect(parsePricePaise('₹920 / 250g')).toBe(92000);
  });

  it('parses en-IN grouped prices', () => {
    expect(parsePricePaise('₹1,109 / 1 kg')).toBe(110900);
  });

  it('parses bare prices without a unit suffix', () => {
    expect(parsePricePaise('₹455')).toBe(45500);
  });

  it('rounds sub-paise decimals', () => {
    expect(parsePricePaise('₹0.333')).toBe(33);
    expect(parsePricePaise('₹92.50 / 250g')).toBe(9250);
  });

  it('returns null for on-request, unparseable, and empty prices', () => {
    expect(parsePricePaise('₹ on request / pack')).toBeNull();
    expect(parsePricePaise('call for price')).toBeNull();
    expect(parsePricePaise('')).toBeNull();
  });
});

describe('resolveLinePrice', () => {
  const ladderProduct = { displayPrice: '₹555 / 250g', weight: '250 g' };

  it('prices every derived pack option identically to the PDP ladder', () => {
    // Parity contract: for each option the web PDP derives, the server
    // must resolve exactly the price label that option renders.
    for (const option of derivePackSizes(ladderProduct.displayPrice, ladderProduct.weight)) {
      const resolved = resolveLinePrice(ladderProduct, option.label);
      expect(resolved).toEqual({
        priceInPaise: parsePricePaise(option.priceLabel),
        unit: option.label,
      });
    }
  });

  it('derives sibling sizes with the PDP round-to-nearest-₹10 scale', () => {
    // Base ₹1,109/1kg → 500g: 1109*0.5 = 554.5 → ₹550 (round10).
    expect(resolveLinePrice({ displayPrice: '₹1,109 / 1 kg' }, '500g')).toEqual({
      priceInPaise: 55000,
      unit: '500g',
    });
    expect(resolveLinePrice({ displayPrice: '₹1,109 / 1 kg' }, '250g')).toEqual({
      priceInPaise: 28000, // 1109/4 = 277.25 → ₹280
      unit: '250g',
    });
  });

  it('keeps the base option verbatim for its own label', () => {
    expect(resolveLinePrice({ displayPrice: '₹1,109 / 1 kg' }, '1 kg')).toEqual({
      priceInPaise: 110900,
      unit: '1 kg',
    });
  });

  it('tolerates case differences in packLabel', () => {
    expect(resolveLinePrice({ displayPrice: '₹1,109 / 1 kg' }, '1 KG')).toEqual({
      priceInPaise: 110900,
      unit: '1 kg',
    });
  });

  it('returns null for a stale packLabel that no longer derives', () => {
    expect(resolveLinePrice({ displayPrice: '₹920 / 250g' }, '2 kg')).toBeNull();
  });

  it('prices the base display price when no packLabel is given', () => {
    expect(resolveLinePrice({ displayPrice: '₹920 / 250g' })).toEqual({
      priceInPaise: 92000,
      unit: '250g',
    });
  });

  it('falls back to the weight field for unit when the price has no suffix', () => {
    expect(resolveLinePrice({ displayPrice: '₹455', weight: '1 pack' })).toEqual({
      priceInPaise: 45500,
      unit: '1 pack',
    });
  });

  it('returns null for on-request / missing prices (not sellable online)', () => {
    expect(resolveLinePrice({ displayPrice: '₹ on request / pack' })).toBeNull();
    expect(resolveLinePrice({ displayPrice: '₹ on request / pack' }, '250g')).toBeNull();
    expect(resolveLinePrice({ weight: '250 g' })).toBeNull();
  });
});

describe('computeTotals', () => {
  const fees = { freshPaise: 4900, shelfStablePaise: 9900 };
  const lines = [
    { priceInPaise: 92000, quantity: 2 },
    { priceInPaise: 55000, quantity: 1 },
  ];

  it('sums lines, applies the fresh fee, keeps taxes/discount at 0', () => {
    expect(computeTotals(lines, 'fresh', fees)).toEqual({
      itemsTotalInPaise: 239000,
      deliveryFeeInPaise: 4900,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 243900,
    });
  });

  it('applies the shelf-stable fee for shelf tier', () => {
    expect(computeTotals(lines, 'shelf', fees)).toEqual({
      itemsTotalInPaise: 239000,
      deliveryFeeInPaise: 9900,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 248900,
    });
  });

  it('prices unknown/missing tiers at the shelf-stable rate', () => {
    expect(computeTotals(lines, 'unknown', fees).deliveryFeeInPaise).toBe(9900);
    expect(computeTotals(lines, undefined, fees).deliveryFeeInPaise).toBe(9900);
  });

  it('totals a fee-only cart to the fee itself', () => {
    expect(computeTotals([], 'fresh', fees)).toEqual({
      itemsTotalInPaise: 0,
      deliveryFeeInPaise: 4900,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 4900,
    });
  });
});

describe('computeTotals discountInPaise (coupon seam, B6)', () => {
  const fees = { freshPaise: 4900, shelfStablePaise: 9900 };
  const lines = [{ priceInPaise: 100000, quantity: 1 }]; // ₹1,000

  it('defaults to 0 — existing callers are unchanged', () => {
    expect(computeTotals(lines, 'fresh', fees).discountInPaise).toBe(0);
    expect(computeTotals(lines, 'fresh', fees).totalInPaise).toBe(104900);
  });

  it('subtracts the discount from the total', () => {
    expect(computeTotals(lines, 'fresh', fees, undefined, 10000)).toEqual({
      itemsTotalInPaise: 100000,
      deliveryFeeInPaise: 4900,
      taxesInPaise: 0,
      discountInPaise: 10000,
      totalInPaise: 94900, // 100000 - 10000 + 4900
    });
  });

  it('floors the discount at the subtotal (never below zero)', () => {
    const totals = computeTotals(lines, 'fresh', fees, undefined, 150000);
    expect(totals.discountInPaise).toBe(100000);
    expect(totals.totalInPaise).toBe(4900); // just the fee
  });
});

describe('computeTotals free-delivery thresholds', () => {
  const fees = { freshPaise: 4900, shelfStablePaise: 9900 };
  // User-decided defaults: ₹999 fresh / ₹1,999 shelf-stable.
  const thresholds = { freshPaise: 99900, shelfStablePaise: 199900 };

  it('waives the fresh fee at or above the fresh threshold (>= is inclusive)', () => {
    const at = computeTotals([{ priceInPaise: 99900, quantity: 1 }], 'fresh', fees, thresholds);
    expect(at.deliveryFeeInPaise).toBe(0);
    expect(at.totalInPaise).toBe(99900);

    const above = computeTotals([{ priceInPaise: 100000, quantity: 1 }], 'fresh', fees, thresholds);
    expect(above.deliveryFeeInPaise).toBe(0);
  });

  it('keeps the fresh fee just below the fresh threshold', () => {
    const below = computeTotals([{ priceInPaise: 99899, quantity: 1 }], 'fresh', fees, thresholds);
    expect(below.deliveryFeeInPaise).toBe(4900);
    expect(below.totalInPaise).toBe(99899 + 4900);
  });

  it('waives the shelf fee at or above the shelf threshold', () => {
    const at = computeTotals(
      [{ priceInPaise: 199900, quantity: 1 }],
      'shelf',
      fees,
      thresholds,
    );
    expect(at.deliveryFeeInPaise).toBe(0);
    expect(at.totalInPaise).toBe(199900);
  });

  it('keeps the shelf fee below the shelf threshold even above the fresh one', () => {
    // ₹1,000 clears the fresh threshold but NOT the shelf one — a shelf
    // cart must not inherit the fresh tier's waiver.
    const mixed = computeTotals(
      [{ priceInPaise: 100000, quantity: 1 }],
      'shelf',
      fees,
      thresholds,
    );
    expect(mixed.deliveryFeeInPaise).toBe(9900);
  });

  it('treats threshold 0 as disabled (fee always applies)', () => {
    const disabled = computeTotals(
      [{ priceInPaise: 999999, quantity: 1 }],
      'fresh',
      fees,
      { freshPaise: 0, shelfStablePaise: 0 },
    );
    expect(disabled.deliveryFeeInPaise).toBe(4900);
    const disabledShelf = computeTotals(
      [{ priceInPaise: 999999, quantity: 1 }],
      'shelf',
      fees,
      { freshPaise: 0, shelfStablePaise: 0 },
    );
    expect(disabledShelf.deliveryFeeInPaise).toBe(9900);
  });

  it('never waives for a null/missing tier (tier must be known)', () => {
    // Mirrors the UI rule: thresholds only apply once a pincode resolved a
    // tier (pre-pincode estimates carry tier null/undefined). An 'unknown'
    // tier value prices — and therefore waives — at the shelf-stable rate,
    // exactly like the fee mapping above.
    const unknown = computeTotals(
      [{ priceInPaise: 999999, quantity: 1 }],
      'unknown',
      fees,
      thresholds,
    );
    expect(unknown.deliveryFeeInPaise).toBe(0); // shelf threshold cleared
    const nullTier = computeTotals(
      [{ priceInPaise: 999999, quantity: 1 }],
      null,
      fees,
      thresholds,
    );
    expect(nullTier.deliveryFeeInPaise).toBe(9900);
    const missingTier = computeTotals(
      [{ priceInPaise: 999999, quantity: 1 }],
      undefined,
      fees,
      thresholds,
    );
    expect(missingTier.deliveryFeeInPaise).toBe(9900);
  });

  it('omitting thresholds keeps the historical fee behavior', () => {
    const legacy = computeTotals([{ priceInPaise: 999999, quantity: 1 }], 'fresh', fees);
    expect(legacy.deliveryFeeInPaise).toBe(4900);
  });
});

describe('normalizeSlot', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for absent slots', () => {
    expect(normalizeSlot(undefined)).toBeUndefined();
    expect(normalizeSlot(null)).toBeUndefined();
  });

  it('passes valid Android shapes through untouched', () => {
    const android = { date: '2026-09-05', window: '10:00-14:00' };
    expect(normalizeSlot(android)).toEqual(android);
  });

  it('maps iOS window tokens to time ranges', () => {
    expect(normalizeSlot({ date: '2026-09-05', window: 'morning' })).toEqual({
      date: '2026-09-05',
      window: '10:00-14:00',
    });
    expect(normalizeSlot({ date: '2026-09-05', window: 'evening' })).toEqual({
      date: '2026-09-05',
      window: '16:00-20:00',
    });
  });

  it('resolves iOS date tokens to IST calendar dates', () => {
    // 20:00 UTC is already the next day in IST (UTC+5:30).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T20:00:00Z'));
    expect(normalizeSlot({ date: 'today', window: 'evening' })).toEqual({
      date: '2026-08-16',
      window: '16:00-20:00',
    });
    expect(normalizeSlot({ date: 'tomorrow', window: 'morning' })).toEqual({
      date: '2026-08-17',
      window: '10:00-14:00',
    });
  });

  it('rolls across month boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T18:31:00Z')); // 2026-09-01 00:01 IST
    expect(normalizeSlot({ date: 'today', window: 'morning' })?.date).toBe('2026-09-01');
    expect(normalizeSlot({ date: 'tomorrow', window: 'morning' })?.date).toBe('2026-09-02');
  });

  it('rolls across year boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T18:31:00Z')); // 2027-01-01 00:01 IST
    expect(normalizeSlot({ date: 'today', window: 'evening' })?.date).toBe('2027-01-01');
    expect(normalizeSlot({ date: 'tomorrow', window: 'evening' })?.date).toBe('2027-01-02');
  });
});
