"use client";

// components/cart/CartUpsellRail.tsx
// "Ships pan-India" rail under the cart — pan-India-shippable (shelf-stable)
// candidates fetched server-side by the cart page, filtered client-side
// against what's already in the cart. Dedupe is by base productId via
// splitCartId, so a derived-pack line (`id:label`) hides its product too.
// Adding is the quiet one-tap variant of BuyModule's add: bare productId,
// displayPrice as priceLabel, quantity 1, tagged source=cart_upsell.
//
// Hidden entirely when every candidate is already in the cart (or the fetch
// came back empty). Cards reuse <MediaCard> so the rail reads exactly like
// the PDP cross-sell.

import {useMemo} from "react";
import {useTranslations} from "next-intl";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {splitCartId} from "@/lib/web/cartEstimate";
import {MediaCard} from "@/components/ui/MediaCard";

/** Serialized candidate — built server-side by the cart page (locale-aware
 *  name/href), no Payload types leak into the client bundle. */
export type CartUpsellCard = {
  productId: string;
  name: string;
  href: string;
  image: string | null;
  priceLabel: string | null;
};

type Props = {
  cards: CartUpsellCard[];
};

const MAX_SHOWN = 4;

export function CartUpsellRail({cards}: Props) {
  const t = useTranslations("Cart");
  const {items, addItem} = useCart();

  // Recomputed on every cart change — adding from the rail immediately
  // hides the card that was just added.
  const inCartProductIds = useMemo(
    () => new Set(items.map((item) => splitCartId(item.id).productId)),
    [items],
  );
  const visible = useMemo(
    () => cards.filter((card) => !inCartProductIds.has(card.productId)).slice(0, MAX_SHOWN),
    [cards, inCartProductIds],
  );

  if (visible.length === 0) return null;

  function add(card: CartUpsellCard) {
    addItem(
      {
        id: card.productId,
        name: card.name,
        priceLabel: card.priceLabel ?? "",
        image: card.image ?? "",
      },
      1,
    );
    track("add_to_cart", {
      source: "cart_upsell",
      product_id: card.productId,
      quantity: 1,
    });
  }

  return (
    <section
      data-testid="cart-upsell-rail"
      aria-labelledby="cart-upsell-heading"
      className="border-t border-border-card pt-8"
    >
      <h2
        id="cart-upsell-heading"
        className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
      >
        {t("upsellTitle")}
      </h2>
      <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((card) => (
          <li key={card.productId} className="flex flex-col">
            <MediaCard
              title={card.name}
              href={card.href}
              image={card.image}
              priceLabel={card.priceLabel}
            />
            <button
              type="button"
              data-testid="cart-upsell-add"
              aria-label={t("upsellAddLabel", {name: card.name})}
              onClick={() => add(card)}
              className="mt-4 self-start border border-border-input bg-bg-control px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-primary hover:text-primary"
            >
              {t("upsellAdd")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CartUpsellRail;
