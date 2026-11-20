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
import {useAuth} from "@/context/AuthContext";
import {track} from "@/lib/analytics";
import type {PackSize} from "@/lib/mithai/packSizes";
import {PincodeCheck} from "@/components/mithai/PincodeCheck";
import {toWaDigits} from "@/lib/whatsapp";
import {isFullWidthLayout, type StorefrontLayoutMode} from "@/lib/storefront-layout";

type Props = {
  productId: string;
  name: string;
  image: string;
  displayPrice: string;
  packSizes: PackSize[];
  whatsapp: string;
  layoutMode?: StorefrontLayoutMode;
};

export function BuyModule({
  productId,
  name,
  image,
  displayPrice,
  packSizes,
  whatsapp,
  layoutMode = "fixed",
}: Props) {
  const t = useTranslations("Pdp.mithai");
  const {addItem} = useCart();
  const {session} = useAuth();
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
  const cartImage = image || "/images/kaju-katli-box.jpg";
  const digits = toWaDigits(whatsapp);
  const stickyRailClassName = [
    "mx-auto flex items-center gap-3",
    isFullWidthLayout(layoutMode) ? "max-w-none px-4 sm:px-6 lg:px-10 2xl:px-14" : "max-w-6xl px-4 sm:px-6 lg:px-8",
  ].join(" ");
  const waText = encodeURIComponent(
    [
      "Hi Mishran, I need help placing this order.",
      `Product: ${name}`,
      selected?.label ? `Pack: ${selected.label}` : "",
      priceLabel ? `Price: ${priceLabel}` : "",
      `Qty: ${qty}`,
    ].filter(Boolean).join("\n"),
  );
  const waHref = digits ? `https://wa.me/${digits}?text=${waText}` : "#";

  function addToCart() {
    startTransition(() => {
      addItem({id: cartId, name, priceLabel, image: cartImage}, qty);
      setAdded(true);
      track("add_to_cart", {id: cartId, name, quantity: qty});
    });
  }

  function buyNow() {
    startTransition(() => {
      addItem({id: cartId, name, priceLabel, image: cartImage}, qty);
      track("buy_now", {id: cartId, name, quantity: qty});
      // Checkout needs a signed-in customer (address + orders are
      // customer-scoped). Signed-out buyers are routed through sign-in with
      // a deep link back — the cart survives in localStorage.
      if (session) {
        router.push("/checkout");
      } else {
        router.push({pathname: "/sign-in", query: {next: "/checkout"}});
      }
    });
  }

  return (
    <div className="ms-buy">
      {/* Price: the design system's Price (Mono figures; the ₹ falls back to Tiro). */}
      <div className="ms-stack ms-stack--tight">
        <p className="ms-price ms-price--lg">
          <span data-testid="display-price">{priceLabel}</span>
        </p>
        <p className="ms-weight ms-muted">{t("taxNote")}</p>
      </div>

      {/* Delivery pincode */}
      <div className="ms-buy-row">
        <PincodeCheck />
      </div>

      {/* Pack size */}
      {packSizes.length > 0 ? (
        <div className="ms-buy-row">
          <p className="ms-field-label" id="pack-size-label">
            {t("packSize.label")}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="pack-size-label"
            className="ms-chip-row"
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
                  className={`ms-btn ms-chip ${isSelected ? "ms-btn-primary" : "ms-btn-secondary"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Quantity + CTAs */}
      <div className="ms-buy-row">
        <div className="ms-row">
          <div className="ms-qty">
            <button
              type="button"
              data-testid="qty-decrement"
              aria-label={t("qty.decrease")}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="ms-qty-btn"
            >
              −
            </button>
            <span
              data-testid="qty-value"
              aria-live="polite"
              className="ms-qty-value"
            >
              {qty}
            </span>
            <button
              type="button"
              data-testid="qty-increment"
              aria-label={t("qty.increase")}
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              className="ms-qty-btn"
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
            className="ms-btn ms-btn-primary"
          >
            <span>{added ? t("added") : t("addToCart")}</span>
          </button>

          <button
            type="button"
            data-testid="buy-now"
            onClick={buyNow}
            disabled={pending}
            className="ms-btn ms-btn-secondary"
          >
            {t("buyNow")}
          </button>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_clicked", {source: "pdp", id: cartId})}
            className="ms-more"
          >
            WhatsApp
          </a>
        </div>
      </div>

      {/* Sticky buy bar on phones; data-agent-avoid lifts the AI team's launcher above it. */}
      <div data-agent-avoid="bottom" className="ms-buybar md:hidden">
        <div className={stickyRailClassName}>
          <div className="min-w-0 flex-1">
            <p className="ms-buybar-name">{name}</p>
            <p className="ms-caption ms-muted">{qty} x {priceLabel}</p>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={pending}
            className="ms-btn ms-btn-primary"
          >
            {added ? t("added") : t("addToCart")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuyModule;
