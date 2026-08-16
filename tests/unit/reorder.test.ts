// tests/unit/reorder.test.ts
// One-tap reorder mapping (lib/web/reorder) — the cart-id rule must match
// BuyModule exactly: derived packs under `${productId}:${packLabel}`, base
// packs under the bare productId, or a reordered line won't merge with an
// add-to-cart of the same pack. Also the display-shaped priceLabel
// composition (must stay parseable by parsePricePaise) and the image
// fallback for legacy order items without one.

import {describe, it, expect} from "vitest";
import {
  reorderCartId,
  reorderPriceLabel,
  toReorderCartItems,
} from "@/lib/web/reorder";
import {parsePricePaise} from "@/lib/commerce/pricing";

describe("reorderCartId", () => {
  it("uses the composite id when the order kept the pack label", () => {
    expect(
      reorderCartId({
        productId: "66b1f0c9a1d2e3f4a5b6c7d8",
        name: "Kaju Katli",
        quantity: 1,
        unit: "500g",
        priceInPaise: 78000,
        packLabel: "500g",
      }),
    ).toBe("66b1f0c9a1d2e3f4a5b6c7d8:500g");
  });

  it("falls back to the bare productId for legacy items", () => {
    expect(
      reorderCartId({
        productId: "66b1f0c9a1d2e3f4a5b6c7d8",
        name: "Kaju Katli",
        quantity: 2,
        unit: "1 kg",
        priceInPaise: 156200,
      }),
    ).toBe("66b1f0c9a1d2e3f4a5b6c7d8");
  });

  it("survives labels that themselves contain colons (split on first only)", () => {
    expect(
      reorderCartId({
        productId: "p1",
        name: "Gift box",
        quantity: 1,
        unit: "Custom: Box",
        priceInPaise: 100000,
        packLabel: "Custom: Box",
      }),
    ).toBe("p1:Custom: Box");
  });
});

describe("reorderPriceLabel", () => {
  it("composes a display-shaped, parseable label from paise + unit", () => {
    const label = reorderPriceLabel({
      productId: "p1",
      name: "Kaju Katli",
      quantity: 1,
      unit: "250g",
      priceInPaise: 92000,
    });
    expect(label).toBe("₹920 / 250g");
    // The estimate block must be able to re-price the reordered line.
    expect(parsePricePaise(label)).toBe(92000);
  });

  it("drops the unit suffix when the item has none", () => {
    expect(
      reorderPriceLabel({
        productId: "p1",
        name: "Box",
        quantity: 1,
        unit: "",
        priceInPaise: 110950,
      }),
    ).toBe("₹1,109.50");
  });
});

describe("toReorderCartItems", () => {
  it("maps a mixed order (composite + legacy + no image) onto cart items", () => {
    const items = toReorderCartItems([
      {
        productId: "p1",
        name: "Kaju Katli",
        quantity: 1,
        unit: "500g",
        priceInPaise: 78000,
        packLabel: "500g",
        image: "/images/kaju-katli.jpg",
      },
      {
        productId: "p2",
        name: "Motichoor Laddoo",
        quantity: 2,
        unit: "1 kg",
        priceInPaise: 81400,
      },
    ]);
    expect(items).toEqual([
      {
        id: "p1:500g",
        name: "Kaju Katli",
        priceLabel: "₹780 / 500g",
        quantity: 1,
        image: "/images/kaju-katli.jpg",
      },
      {
        id: "p2",
        name: "Motichoor Laddoo",
        priceLabel: "₹814 / 1 kg",
        quantity: 2,
        image: "",
      },
    ]);
    // Every mapped line re-prices exactly to its order price.
    expect(parsePricePaise(items[1]!.priceLabel)).toBe(81400);
  });
});
