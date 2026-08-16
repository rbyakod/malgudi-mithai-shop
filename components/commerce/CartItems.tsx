"use client";

// components/commerce/CartItems.tsx
// The editable cart for /cart. Fully wired to CartContext's CRUD
// (updateQuantity / removeItem / clear), prices every line client-side via
// the shared parser (parsePricePaise — same one /cart/validate uses), and
// shows a clearly-labeled ESTIMATE: subtotal + flat delivery fee by the
// pincode tier saved by the PDP check (localStorage "mithran-pincode-v1").
// The snapshot the server mints at checkout stays the pricing truth, hence
// the "final amount confirmed at checkout" note; on-request lines never
// fake a number.
//
// Visual language unchanged from the storefront: rounded-2xl card lines,
// hairline border-card rules, quiet uppercase tracked labels, gold
// accents. Quantity stepper follows the BuyModule idiom (border-box
// −/value/+), bounded 1..20 like the PDP.

import {useEffect, useMemo, useState} from "react";
import Image from "next/image";
import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {estimateCart, type CartFees} from "@/lib/web/cartEstimate";
import {formatPaise} from "@/lib/web/format";
import type {ServiceabilityTier} from "@/lib/web/serviceability";
import {toWaDigits} from "@/lib/whatsapp";

type Props = {
  whatsapp: string;
  /** Delivery fees by tier, read from lib/config by the server page. */
  fees: CartFees;
};

// Same key + shape as components/mithai/PincodeCheck.tsx.
const PINCODE_STORAGE_KEY = "mithran-pincode-v1";

type SavedPincode = {
  pincode: string;
  tier: ServiceabilityTier;
  city: string;
  slaDays: number;
};

function cartMessage(
  items: ReturnType<typeof useCart>["items"],
  locale: string,
): string {
  const lines = items.map((item, index) => {
    const price = item.priceLabel ? ` · ${item.priceLabel}` : "";
    return `${index + 1}. ${item.name} x ${item.quantity}${price}`;
  });
  return [
    "Hi Mishran, I would like to place this order:",
    "",
    ...lines,
    "",
    `Locale: ${locale}`,
  ].filter(Boolean).join("\n");
}

export function CartItems({whatsapp, fees}: Props) {
  const {items, updateQuantity, removeItem, clear} = useCart();
  const t = useTranslations("Cart");
  const locale = useLocale();

  // Delivery tier from the last PDP pincode check — restored post-hydration
  // only (CartContext discipline) so SSR and first client render match.
  const [tier, setTier] = useState<ServiceabilityTier | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PINCODE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedPincode;
      if (parsed && (parsed.tier === "fresh" || parsed.tier === "shelf")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore of persisted state, same pattern as CartContext
        setTier(parsed.tier);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const estimate = useMemo(() => estimateCart(items, tier, fees), [items, tier, fees]);

  const digits = toWaDigits(whatsapp);
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(cartMessage(items, locale))}`
    : "#";

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-card bg-bg-card/50 p-8 text-center">
        <p className="text-sm italic leading-relaxed text-text-muted">
          {t("empty")}{" "}
          <Link
            href="/mithai"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("emptyCta")} →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {estimate.lines.map(({item, unitPriceInPaise, lineTotalInPaise}) => (
          <li
            key={item.id}
            data-testid="cart-line"
            className="grid gap-4 rounded-2xl border border-border-card bg-bg-card p-4 sm:grid-cols-[5rem_1fr_auto]"
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-bg-accent">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-2xl text-primary">
                  {(item.name[0] ?? "M").toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-heading">
                {item.name}
              </p>
              {item.priceLabel ? (
                <p className="mt-1 text-[11px] text-text-muted">{item.priceLabel}</p>
              ) : null}
              {lineTotalInPaise !== null ? (
                <p
                  data-testid="cart-line-total"
                  className="mt-1 text-xs text-text-secondary"
                >
                  {t("lineTotal", {
                    quantity: String(item.quantity),
                    price: formatPaise(unitPriceInPaise ?? 0),
                    total: formatPaise(lineTotalInPaise),
                  })}
                </p>
              ) : (
                <span
                  data-testid="cart-line-on-request"
                  className="mt-2 inline-block rounded-full bg-gold px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-on-gold"
                >
                  {t("onRequest")}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-primary"
              >
                {t("remove")}
              </button>
            </div>
            <div className="flex flex-col items-end justify-between gap-3">
              <div className="flex items-center border border-border-card">
                <button
                  type="button"
                  aria-label={t("decrease")}
                  data-testid="cart-qty-decrement"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="px-3 py-2 font-display text-base text-primary disabled:opacity-40"
                >
                  −
                </button>
                <span
                  data-testid="cart-qty-value"
                  aria-live="polite"
                  className="min-w-8 text-center font-display text-base text-text-heading"
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label={t("increase")}
                  data-testid="cart-qty-increment"
                  onClick={() => updateQuantity(item.id, Math.min(20, item.quantity + 1))}
                  className="px-3 py-2 font-display text-base text-primary"
                >
                  +
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Estimate — the server snapshot at checkout is the pricing truth. */}
      <div
        data-testid="cart-estimate"
        className="rounded-2xl border border-border-card bg-bg-card p-5"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("estimateHeading")}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-text-secondary">
            <dt>{t("estimateItems")}</dt>
            <dd data-testid="cart-estimate-subtotal">
              {formatPaise(estimate.itemsTotalInPaise)}
            </dd>
          </div>
          <div className="flex justify-between text-text-secondary">
            <dt>
              {estimate.deliveryFeeInPaise === null
                ? t("estimateDelivery")
                : tier === "fresh"
                  ? t("estimateDeliveryFresh")
                  : t("estimateDeliveryShelf")}
            </dt>
            <dd data-testid="cart-estimate-fee">
              {estimate.deliveryFeeInPaise === null
                ? t("estimateDeliveryUnknown")
                : formatPaise(estimate.deliveryFeeInPaise)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-border-card pt-3 text-text-heading">
            <dt className="font-display text-base">{t("estimateTotal")}</dt>
            <dd data-testid="cart-estimate-total" className="font-display text-base">
              {estimate.estimatedTotalInPaise === null ? (
                <span className="rounded-full bg-gold px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-on-gold">
                  {t("onRequest")}
                </span>
              ) : (
                formatPaise(estimate.estimatedTotalInPaise)
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs italic leading-relaxed text-text-muted">
          {estimate.allPriced ? t("estimateNote") : t("estimateOnRequestNote")}
        </p>
      </div>

      {/* CTAs — checkout primary, WhatsApp + clear secondary. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border-card bg-bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-heading">
            {t("orderTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            {t("orderNote")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-full border border-border-input px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            {t("clear")}
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_clicked", {source: "cart", items: items.length})}
            className="rounded-full border border-border-input px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            {t("whatsapp")}
          </a>
          <Link
            href="/checkout"
            data-testid="proceed-to-checkout"
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-text-light transition-colors hover:bg-primary-hover"
          >
            {t("proceed")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CartItems;
