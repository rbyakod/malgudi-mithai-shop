"use client";

// components/mithai/BuyModule.tsx
// The mithai PDP's buy module — one client island owning everything that has
// to react to the customer's choices: the price line (swaps with the selected
// pack size), the delivery-pincode check, the pack-size selector, the
// quantity stepper, and the Add / Buy-now CTAs.
//
// Styled to keep the editorial voice: hairline `border-border-card` section
// rules instead of boxed cards, quiet uppercase tracked labels, controls in
// the same `border-gold/60` idiom as the original add-to-cart button.
//
// Cart identity: the base pack uses the bare product id (so existing carts
// keep merging); derived pack sizes get `${productId}:${label}`.

import {useTransition, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import type {PackSize} from "@/lib/mithai/packSizes";
import {PincodeCheck} from "@/components/mithai/PincodeCheck";

type Props = {
  productId: string;
  name: string;
  image: string;
  displayPrice: string;
  packSizes: PackSize[];
};

export function BuyModule({
  productId,
  name,
  image,
  displayPrice,
  packSizes,
}: Props) {
  const t = useTranslations("Pdp.mithai");
  const {addItem} = useCart();
  const router = useRouter();
  // The base option carries the verbatim displayPrice — select it by default
  // so the page opens on the product's real price (ladder chips stay
  // size-ascending). Falls back to the first option.
  const baseLabel =
    packSizes.find((p) => p.priceLabel === displayPrice)?.label ??
    packSizes[0]?.label ??
    null;
  const [selectedLabel, setSelectedLabel] = useState<string | null>(baseLabel);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected =
    packSizes.find((p) => p.label === selectedLabel) ?? packSizes[0] ?? null;
  const priceLabel = selected?.priceLabel ?? displayPrice;
  const cartId =
    selected && selected.label !== baseLabel
      ? `${productId}:${selected.label}`
      : productId;

  function addToCart() {
    startTransition(() => {
      addItem({id: cartId, name, priceLabel, image}, qty);
      setAdded(true);
      track("add_to_cart", {id: cartId, name, quantity: qty});
    });
  }

  function buyNow() {
    startTransition(() => {
      addItem({id: cartId, name, priceLabel, image}, qty);
      track("buy_now", {id: cartId, name, quantity: qty});
      router.push("/cart");
    });
  }

  return (
    <div className="mt-8">
      {/* Price */}
      <p className="font-display text-2xl font-medium text-text-heading">
        <span data-testid="display-price">{priceLabel}</span>
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
        {t("taxNote")}
      </p>

      {/* Delivery pincode */}
      <div className="mt-6 border-t border-border-card pt-6">
        <PincodeCheck />
      </div>

      {/* Pack size */}
      {packSizes.length > 0 ? (
        <div className="mt-6 border-t border-border-card pt-6">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80"
            id="pack-size-label"
          >
            {t("packSize.label")}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="pack-size-label"
            className="mt-3 flex flex-wrap gap-2"
          >
            {packSizes.map((p) => {
              const isSelected = p.label === selected?.label;
              return (
                <button
                  key={p.label}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid="pack-size"
                  onClick={() => setSelectedLabel(p.label)}
                  className={`border px-4 py-2 font-display text-sm transition-colors ${
                    isSelected
                      ? "border-gold bg-bg-accent text-primary"
                      : "border-border-card text-text-muted hover:border-gold/60 hover:text-text-heading"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Quantity + CTAs */}
      <div className="mt-6 border-t border-border-card pt-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center border border-border-card">
            <button
              type="button"
              data-testid="qty-decrement"
              aria-label={t("qty.decrease")}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="px-3 py-2 font-display text-base text-primary disabled:opacity-40"
            >
              −
            </button>
            <span
              data-testid="qty-value"
              aria-live="polite"
              className="min-w-8 text-center font-display text-base text-text-heading"
            >
              {qty}
            </span>
            <button
              type="button"
              data-testid="qty-increment"
              aria-label={t("qty.increase")}
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              className="px-3 py-2 font-display text-base text-primary"
            >
              +
            </button>
          </div>

          <button
            type="button"
            data-testid="add-to-cart"
            onClick={addToCart}
            disabled={pending}
            aria-live="polite"
            className="inline-flex items-center gap-3 border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent disabled:opacity-70"
          >
            <span aria-hidden="true" className="text-gold">
              {added ? "✓" : "+"}
            </span>
            <span>{added ? t("added") : t("addToCart")}</span>
          </button>

          <button
            type="button"
            data-testid="buy-now"
            onClick={buyNow}
            disabled={pending}
            className="border-y border-gold/60 bg-bg-accent px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary-hover transition-colors hover:bg-bg-control disabled:opacity-70"
          >
            {t("buyNow")}
            <span className="ml-2 normal-case tracking-normal text-text-muted">
              {priceLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuyModule;
