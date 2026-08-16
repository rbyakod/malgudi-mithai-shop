// tests/unit/cart-estimate.test.ts
// Cart math for the /cart estimate block (lib/web/cartEstimate) — pricing
// via the shared parser, the mixed on-request line (must never fake a ₹0),
// tier-based delivery fees, and the `${productId}:${packLabel}` id split
// the checkout uses before POST /cart/validate.

import {describe, it, expect} from "vitest";
import {estimateCart, splitCartId} from "@/lib/web/cartEstimate";
import type {CartItem} from "@/context/CartContext";

const FEES = {freshPaise: 4900, shelfStablePaise: 9900};

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
