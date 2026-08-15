"use client";

import Image from "next/image";
import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {toWaDigits} from "@/lib/whatsapp";

type Props = {
  whatsapp: string;
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

export function CartItems({whatsapp}: Props) {
  const {items, updateQuantity, removeItem, clear} = useCart();
  const t = useTranslations("Commerce.common");
  const locale = useLocale();
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
        {items.map((item) => (
          <li
            key={item.id}
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
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-primary"
              >
                {t("remove")}
              </button>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <button
                type="button"
                aria-label={t("decrease")}
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="h-9 w-9 rounded-full border border-border-input text-text-heading transition-colors hover:bg-bg-accent"
              >
                -
              </button>
              <span className="min-w-8 text-center text-sm font-semibold text-text-heading">
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label={t("increase")}
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="h-9 w-9 rounded-full border border-border-input text-text-heading transition-colors hover:bg-bg-accent"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-card bg-bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-heading">{t("orderDraftTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{t("itemsEditableNote")}</p>
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
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-text-light transition-colors hover:bg-primary-hover"
          >
            {t("sendOrder")}
          </a>
        </div>
      </div>
    </div>
  );
}

export default CartItems;
