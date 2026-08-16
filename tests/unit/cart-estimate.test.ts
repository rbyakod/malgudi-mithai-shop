// tests/unit/cart-estimate.test.ts
// Cart math for the /cart estimate block (lib/web/cartEstimate) — pricing
// via the shared parser, the mixed on-request line (must never fake a ₹0),
// tier-based delivery fees, the free-delivery threshold mirror (exactly the
// rule computeTotals applies server-side), and the
// `${productId}:${packLabel}` id split the checkout uses before POST
// /cart/validate.

import {describe, it, expect} from "vitest";
import {estimateCart, splitCartId} from "@/lib/web/cartEstimate";
import type {CartItem} from "@/context/CartContext";

const FEES = {freshPaise: 4900, shelfStablePaise: 9900};
const THRESHOLDS = {freshPaise: 99900, shelfStablePaise: 199900};

function item(overrides: Partial<CartItem>): CartItem {
  return {
    id: "p1",
    name: "Kaju Katli",
    priceLabel: "₹920 / 250g",
    quantity: 1,
    image: "/images/kaju-katli.jpg",
    ...overrides,
  };
}

describe("splitCartId", () => {
  it("returns the bare id unchanged as productId", () => {
    expect(splitCartId("66b1f0c9a1d2e3f4a5b6c7d8")).toEqual({
      productId: "66b1f0c9a1d2e3f4a5b6c7d8",
    });
  });

  it("splits derived pack ids on the first colon", () => {
    expect(splitCartId("66b1f0c9a1d2e3f4a5b6c7d8:500g")).toEqual({
      productId: "66b1f0c9a1d2e3f4a5b6c7d8",
      packLabel: "500g",
    });
  });

  it("keeps colons inside the pack label", () => {
    expect(splitCartId("abc:Custom: Box")).toEqual({
      productId: "abc",
      packLabel: "Custom: Box",
    });
  });
});

describe("estimateCart", () => {
  it("prices lines through the shared parser and sums the subtotal", () => {
    const estimate = estimateCart(
      [
        item({priceLabel: "₹920 / 250g", quantity: 2}),
        item({id: "p2", priceLabel: "₹1,109 / 1 kg", quantity: 1}),
      ],
      "fresh",
      FEES,
    );
    expect(estimate.lines[0]!.unitPriceInPaise).toBe(92000);
    expect(estimate.lines[0]!.lineTotalInPaise).toBe(184000);
    expect(estimate.lines[1]!.unitPriceInPaise).toBe(110900);
    expect(estimate.itemsTotalInPaise).toBe(294900);
    expect(estimate.deliveryFeeInPaise).toBe(FEES.freshPaise);
    expect(estimate.estimatedTotalInPaise).toBe(294900 + 4900);
    expect(estimate.allPriced).toBe(true);
  });

  it("uses the shelf-stable fee for shelf tier", () => {
    const estimate = estimateCart([item({quantity: 1})], "shelf", FEES);
    expect(estimate.deliveryFeeInPaise).toBe(FEES.shelfStablePaise);
    expect(estimate.estimatedTotalInPaise).toBe(92000 + 9900);
  });

  it("mixed on-request line: subtotal over priced lines, total null, allPriced false", () => {
    const estimate = estimateCart(
      [
        item({id: "a", priceLabel: "₹920 / 250g", quantity: 1}),
        item({id: "b", priceLabel: "₹ on request / pack", quantity: 3}),
      ],
      "fresh",
      FEES,
    );
    // The on-request line contributes nothing to any number.
    expect(estimate.lines[1]!.unitPriceInPaise).toBeNull();
    expect(estimate.lines[1]!.lineTotalInPaise).toBeNull();
    expect(estimate.itemsTotalInPaise).toBe(92000);
    expect(estimate.allPriced).toBe(false);
    expect(estimate.estimatedTotalInPaise).toBeNull();
  });

  it("unknown tier: fee null, estimate falls back to the subtotal", () => {
    const estimate = estimateCart([item({quantity: 2})], null, FEES);
    expect(estimate.deliveryFeeInPaise).toBeNull();
    expect(estimate.estimatedTotalInPaise).toBe(184000);
  });

  it("an all-on-request cart has a zero subtotal but no total", () => {
    const estimate = estimateCart(
      [item({priceLabel: "₹ on request / pack", quantity: 2})],
      "fresh",
      FEES,
    );
    expect(estimate.itemsTotalInPaise).toBe(0);
    expect(estimate.allPriced).toBe(false);
    expect(estimate.estimatedTotalInPaise).toBeNull();
  });
});

describe("estimateCart free-delivery thresholds (computeTotals mirror)", () => {
  it("below the fresh threshold: full fee, threshold exposed, not earned", () => {
    const estimate = estimateCart([item({quantity: 1})], "fresh", FEES, THRESHOLDS);
    expect(estimate.itemsTotalInPaise).toBe(92000);
    expect(estimate.deliveryFeeInPaise).toBe(FEES.freshPaise);
    expect(estimate.freeDeliveryThresholdInPaise).toBe(99900);
    expect(estimate.freeDeliveryEarned).toBe(false);
    expect(estimate.estimatedTotalInPaise).toBe(92000 + 4900);
  });

  it("exactly at the fresh threshold: fee 0, earned", () => {
    // ₹920 + ₹79 = ₹999 — the boundary is inclusive (>= threshold).
    const estimate = estimateCart(
      [item({id: "a", quantity: 1}), item({id: "b", priceLabel: "₹79 / pc", quantity: 1})],
      "fresh",
      FEES,
      THRESHOLDS,
    );
    expect(estimate.itemsTotalInPaise).toBe(99900);
    expect(estimate.deliveryFeeInPaise).toBe(0);
    expect(estimate.freeDeliveryEarned).toBe(true);
    expect(estimate.estimatedTotalInPaise).toBe(99900);
  });

  it("above the shelf threshold: fee 0 on the shelf tier fee", () => {
    const estimate = estimateCart(
      [item({id: "a", quantity: 2}), item({id: "b", priceLabel: "₹160 / pc", quantity: 1})],
      "shelf",
      FEES,
      THRESHOLDS,
    );
    expect(estimate.itemsTotalInPaise).toBe(200000);
    expect(estimate.freeDeliveryThresholdInPaise).toBe(199900);
    expect(estimate.deliveryFeeInPaise).toBe(0);
    expect(estimate.freeDeliveryEarned).toBe(true);
  });

  it("below the shelf threshold keeps the shelf fee", () => {
    const estimate = estimateCart([item({quantity: 2})], "shelf", FEES, THRESHOLDS);
    expect(estimate.itemsTotalInPaise).toBe(184000);
    expect(estimate.deliveryFeeInPaise).toBe(FEES.shelfStablePaise);
    expect(estimate.freeDeliveryEarned).toBe(false);
  });

  it("a 0 threshold disables free delivery for that tier only", () => {
    const disabled = {...THRESHOLDS, freshPaise: 0};
    const fresh = estimateCart([item({quantity: 2})], "fresh", FEES, disabled);
    expect(fresh.freeDeliveryThresholdInPaise).toBeNull();
    expect(fresh.deliveryFeeInPaise).toBe(FEES.freshPaise);
    expect(fresh.freeDeliveryEarned).toBe(false);
    // The shelf threshold still applies in the same config.
    const shelf = estimateCart([item({quantity: 2})], "shelf", FEES, disabled);
    expect(shelf.freeDeliveryThresholdInPaise).toBe(199900);
    expect(shelf.deliveryFeeInPaise).toBe(FEES.shelfStablePaise);
  });

  it("no thresholds passed: plain fee behavior, threshold null", () => {
    const estimate = estimateCart([item({quantity: 2})], "fresh", FEES);
    expect(estimate.freeDeliveryThresholdInPaise).toBeNull();
    expect(estimate.freeDeliveryEarned).toBe(false);
    expect(estimate.deliveryFeeInPaise).toBe(FEES.freshPaise);
  });

  it("unknown tier: no threshold surfaced even with thresholds configured", () => {
    const estimate = estimateCart([item({quantity: 2})], null, FEES, THRESHOLDS);
    expect(estimate.freeDeliveryThresholdInPaise).toBeNull();
    expect(estimate.freeDeliveryEarned).toBe(false);
  });

  it("mixed on-request cart above the threshold still earns the fee drop", () => {
    // Mirrors the server rule exactly: the priced subtotal alone decides
    // the fee; the honest-total rule stays separate (total is still null).
    const estimate = estimateCart(
      [
        item({id: "a", quantity: 2}),
        item({id: "b", priceLabel: "₹160 / pc", quantity: 1}),
        item({id: "c", priceLabel: "₹ on request / pack", quantity: 1}),
      ],
      "shelf",
      FEES,
      THRESHOLDS,
    );
    expect(estimate.itemsTotalInPaise).toBe(200000);
    expect(estimate.allPriced).toBe(false);
    expect(estimate.freeDeliveryEarned).toBe(true);
    expect(estimate.deliveryFeeInPaise).toBe(0);
    expect(estimate.estimatedTotalInPaise).toBeNull();
  });
});
