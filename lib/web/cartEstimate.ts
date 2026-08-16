// lib/web/cartEstimate.ts
// Client-side cart math for the /cart estimate block. Pure and testable —
// the component only renders what this computes.
//
// The estimate is explicitly labeled as an estimate: the authoritative
// totals are the server's (POST /cart/validate at checkout), so this module
// reuses the shared parser (lib/commerce/pricing.parsePricePaise) rather
// than carrying its own price regex. Lines whose priceLabel cannot be
// parsed ("on request") price as null and the total becomes an on-request
// badge instead of a number — never a silent ₹0.
//
// Cart id split: the web PDP sells derived pack sizes under ids
// `${productId}:${packLabel}` (BuyModule), while base packs use the bare
// productId. /cart/validate wants the base id + packLabel separately.

import type {CartItem} from "@/context/CartContext";
import {parsePricePaise} from "@/lib/commerce/pricing";
import type {ServiceabilityTier} from "@/lib/web/serviceability";

/** `abc123` → {productId}; `abc123:500g` → {productId, packLabel}. */
export function splitCartId(id: string): {productId: string; packLabel?: string} {
  const idx = id.indexOf(":");
  if (idx === -1) return {productId: id};
  return {productId: id.slice(0, idx), packLabel: id.slice(idx + 1)};
}

/** Delivery fees by tier — the page reads them from lib/config and passes
 * them down (lib/config itself parses server env and must never reach a
 * client bundle). */
export type CartFees = {freshPaise: number; shelfStablePaise: number};

/**
 * Free-delivery thresholds by tier (0 = disabled for that tier). Same
 * server-provenance as CartFees; the fee rule mirrors computeTotals in
 * lib/commerce/pricing exactly: when the tier is known, its threshold is
 * > 0, and the priced subtotal has reached it, the delivery fee is 0.
 */
export type CartFreeThresholds = {freshPaise: number; shelfStablePaise: number};

export type LineEstimate = {
  item: CartItem;
  /** Unit price in paise, or null when the line is priced "on request". */
  unitPriceInPaise: number | null;
  /** unit × quantity, or null for on-request lines. */
  lineTotalInPaise: number | null;
};

export type CartEstimate = {
  lines: LineEstimate[];
  /** Sum over priced lines only (on-request lines contribute nothing). */
  itemsTotalInPaise: number;
  /** False when any line is priced on request. */
  allPriced: boolean;
  /** Flat fee by saved serviceability tier; null when no tier is saved. */
  deliveryFeeInPaise: number | null;
  /**
   * Subtotal + fee. Null when any line is on request (no honest number
   * exists); equals the subtotal alone when the tier is unknown (fee is
   * confirmed at checkout).
   */
  estimatedTotalInPaise: number | null;
  /**
   * The free-delivery threshold that applies to the saved tier, or null
   * when the tier is unknown or its threshold is disabled (0). Purely
   * informational for the progress UI — the fee above already carries the
   * rule.
   */
  freeDeliveryThresholdInPaise: number | null;
  /** True when the priced subtotal met the tier's threshold (fee is 0). */
  freeDeliveryEarned: boolean;
};

export function estimateCart(
  items: CartItem[],
  tier: ServiceabilityTier | null,
  fees: CartFees,
  freeThresholds?: CartFreeThresholds,
): CartEstimate {
  const lines: LineEstimate[] = items.map((item) => {
    const unitPriceInPaise = item.priceLabel
      ? parsePricePaise(item.priceLabel)
      : null;
    return {
      item,
      unitPriceInPaise,
      lineTotalInPaise:
        unitPriceInPaise === null ? null : unitPriceInPaise * item.quantity,
    };
  });

  const itemsTotalInPaise = lines.reduce(
    (sum, line) => sum + (line.lineTotalInPaise ?? 0),
    0,
  );
  const allPriced = lines.every((line) => line.lineTotalInPaise !== null);
  const tierThresholdInPaise =
    tier && freeThresholds
      ? tier === "fresh"
        ? freeThresholds.freshPaise
        : freeThresholds.shelfStablePaise
      : null;
  // Mirror of computeTotals' threshold rule: threshold > 0 and priced
  // subtotal >= threshold → fee 0. A 0 threshold disables free delivery.
  const freeDeliveryEarned =
    tierThresholdInPaise !== null &&
    tierThresholdInPaise > 0 &&
    itemsTotalInPaise >= tierThresholdInPaise;
  const deliveryFeeInPaise = tier
    ? freeDeliveryEarned
      ? 0
      : tier === "fresh"
        ? fees.freshPaise
        : fees.shelfStablePaise
    : null;

  return {
    lines,
    itemsTotalInPaise,
    allPriced,
    deliveryFeeInPaise,
    estimatedTotalInPaise: allPriced
      ? itemsTotalInPaise + (deliveryFeeInPaise ?? 0)
      : null,
    freeDeliveryThresholdInPaise:
      tierThresholdInPaise !== null && tierThresholdInPaise > 0
        ? tierThresholdInPaise
        : null,
    freeDeliveryEarned,
  };
}
