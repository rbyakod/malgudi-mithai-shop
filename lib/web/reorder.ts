// lib/web/reorder.ts
// One-tap reorder mapping — order line items → cart items. Pure so the
// composite-id rule is unit-testable apart from the OrderDetail island.
//
// Cart identity must match the PDP exactly or a reordered line won't merge
// with an add-to-cart of the same pack: derived packs live under
// `${productId}:${packLabel}` (BuyModule), the base pack under the bare
// productId. `packLabel` only exists on orders minted after Batch A —
// legacy items fall back to the base pack (acceptable; only test orders
// predate it).
//
// The cart's priceLabel is display-shaped ("₹920 / 250g") so the estimate
// block's parser prices the line; order items carry machine paise + a unit
// string, so the label is recomposed as `${formatPaise(paise)} / ${unit}`.

import type {CartItem} from "@/context/CartContext";
import {formatPaise} from "@/lib/web/format";

export type ReorderItem = {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  priceInPaise: number;
  image?: string;
  /** Present on orders minted after Batch A; absent on legacy orders. */
  packLabel?: string;
};

export function reorderCartId(item: ReorderItem): string {
  return item.packLabel
    ? `${item.productId}:${item.packLabel}`
    : item.productId;
}

export function reorderPriceLabel(item: ReorderItem): string {
  return item.unit
    ? `${formatPaise(item.priceInPaise)} / ${item.unit}`
    : formatPaise(item.priceInPaise);
}

export function toReorderCartItems(orderItems: ReorderItem[]): CartItem[] {
  return orderItems.map((item) => ({
    id: reorderCartId(item),
    name: item.name,
    priceLabel: reorderPriceLabel(item),
    quantity: item.quantity,
    image: item.image ?? "",
  }));
}
