// lib/commerce/pricing.ts
// Server-side pricing truth for /cart/validate (and any surface that needs
// the same math, e.g. the web checkout's pre-validate estimate). Pure and
// client-safe: no server-only imports — just the shared pack-size ladder
// from lib/mithai/packSizes.ts.
//
// Taxes: always 0. Catalog prices are MRP INCLUSIVE of GST (standard for
// Indian mithai retail), so no exclusive tax line is computed — the
// itemsTotal already carries the tax the customer pays.
//
// Rounding: pack-derived prices reuse derivePackSizes' round-to-nearest-₹10
// scale of the single real displayPrice, so a server-priced line is
// byte-identical to the price the web PDP showed for that pack size.

import { derivePackSizes, parsePrice } from '../mithai/packSizes';
import type { OrderTotals } from './types';

/** The two fields a product needs to be priceable online. */
export type PricedProduct = {
  displayPrice?: string | null;
  weight?: string | null;
};

export type LinePrice = {
  priceInPaise: number;
  /** Pack identity of the priced line, e.g. "500g" / "1 kg" / "250 g". */
  unit: string;
};

/** "₹920 / 250g" → 92000; "₹1,109 / 1 kg" → 110900; "₹ on request / pack" → null. */
export function parsePricePaise(displayPrice: string): number | null {
  const rupees = parsePrice(displayPrice);
  return rupees === null ? null : Math.round(rupees * 100);
}

/**
 * Resolve one cart line's real price from the product's single display
 * price string.
 *
 * With `packLabel` (web PDP carts sell derived pack sizes under ids
 * `${productId}:${label}`), the server re-derives the pack ladder and
 * prices the matching option — rounding identical to the PDP. A label
 * that no longer derives (stale cart after a catalog edit) returns null
 * rather than silently charging the base price.
 *
 * Without `packLabel`, the base display price is used; the unit falls
 * back to the price's own size suffix, then the `weight` field.
 *
 * Returns null whenever the line cannot be priced honestly ("on request",
 * unparseable price, no displayPrice) — the caller rejects those lines.
 */
export function resolveLinePrice(
  product: PricedProduct,
  packLabel?: string | null,
): LinePrice | null {
  const displayPrice = product.displayPrice ?? '';
  if (!displayPrice) return null;

  const wanted = packLabel?.trim();
  if (wanted) {
    const option = derivePackSizes(displayPrice, product.weight).find(
      (o) => o.label === wanted || o.label.toLowerCase() === wanted.toLowerCase(),
    );
    if (!option) return null;
    const priceInPaise = parsePricePaise(option.priceLabel);
    if (priceInPaise === null) return null;
    return { priceInPaise, unit: option.label };
  }

  const priceInPaise = parsePricePaise(displayPrice);
  if (priceInPaise === null) return null;
  const unitMatch = displayPrice.match(/\/\s*(.+)$/);
  const unit = unitMatch ? unitMatch[1]!.trim() : product.weight?.trim() || '';
  return { priceInPaise, unit };
}

export type TotalsLine = { priceInPaise: number; quantity: number };

export type DeliveryFees = { freshPaise: number; shelfStablePaise: number };

/**
 * Per-tier free-delivery thresholds (conversion batch). A subtotal at or
 * above the tier's threshold waives the delivery fee. A threshold of 0
 * (or unset) disables the waiver for that tier — the fee always applies.
 */
export type FreeDeliveryThresholds = {
  freshPaise: number;
  shelfStablePaise: number;
};

/**
 * Subtotal + flat delivery fee by serviceability tier (user decision:
 * ₹49 fresh / ₹99 shelf-stable by default, env-tunable via lib/config).
 * Fresh-tier service is same-city and cheaper; any other tier value
 * (shelf, unknown) prices at the shelf-stable rate. Taxes/discount are 0
 * (see file header).
 *
 * With `freeThresholds`, a subtotal at or above the tier's threshold
 * (and a threshold > 0) zeroes the delivery fee. A null/undefined tier
 * never qualifies (mirrors the UI rule "tier known"). No new totals
 * field — callers infer the waiver from subtotal + threshold.
 */
export function computeTotals(
  lines: TotalsLine[],
  tier: string | null | undefined,
  fees: DeliveryFees,
  freeThresholds?: FreeDeliveryThresholds,
): OrderTotals {
  const itemsTotalInPaise = lines.reduce(
    (sum, line) => sum + line.priceInPaise * line.quantity,
    0,
  );
  let deliveryFeeInPaise = tier === 'fresh' ? fees.freshPaise : fees.shelfStablePaise;
  const threshold =
    tier === 'fresh'
      ? freeThresholds?.freshPaise
      : tier != null
        ? freeThresholds?.shelfStablePaise
        : undefined;
  if (threshold != null && threshold > 0 && itemsTotalInPaise >= threshold) {
    deliveryFeeInPaise = 0;
  }
  return {
    itemsTotalInPaise,
    deliveryFeeInPaise,
    taxesInPaise: 0,
    discountInPaise: 0,
    totalInPaise: itemsTotalInPaise + deliveryFeeInPaise,
  };
}

export type DeliverySlot = { date: string; window: string };

// en-CA yields ISO-style YYYY-MM-DD. IST has no DST, so a fixed 24h offset
// from "now" always lands on the right calendar day (month/year rollovers
// included).
const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function istDate(offsetDays: number): string {
  return istDateFormatter.format(new Date(Date.now() + offsetDays * 86_400_000));
}

/**
 * Normalize a delivery slot at the API boundary. iOS sends relative tokens
 * ("today"/"tomorrow" dates, "morning"/"evening" windows) that the
 * Orders.slot.date Payload date field would reject; Android already sends
 * ISO dates + time-range windows, which pass through untouched.
 */
export function normalizeSlot(slot?: DeliverySlot | null): DeliverySlot | undefined {
  if (!slot) return undefined;
  let { date, window } = slot;
  if (date === 'today') date = istDate(0);
  else if (date === 'tomorrow') date = istDate(1);
  if (window === 'morning') window = '10:00-14:00';
  else if (window === 'evening') window = '16:00-20:00';
  return { date, window };
}
