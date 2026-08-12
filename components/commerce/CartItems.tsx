// components/commerce/CartItems.tsx
// Client island that renders the current cart items read-only. /cart is a
// server component (renders <CommerceStub />) but needs to read client-side
// cart state from CartContext — this island bridges that boundary.
//
// Read-only on purpose: checkout launches in Phase 8, so qty editing,
// removal, and pricing are deferred. Empty state links to /mithai.

"use client";

import Image from "next/image";
import {useCart} from "@/context/CartContext";
import {Link} from "@/i18n/navigation";
import {useTranslations} from "next-intl";

export function CartItems() {
  const {items} = useCart();
  const t = useTranslations("Commerce.common");

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
            className="flex gap-4 rounded-2xl border border-border-card bg-bg-card p-4"
          >
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-bg-accent">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-1">
              <p className="text-sm font-semibold text-text-heading">
                {item.name}
              </p>
              {item.priceLabel && (
                <p className="text-[11px] text-text-muted">{item.priceLabel}</p>
              )}
              <p className="text-[11px] text-text-muted">
                Qty {item.quantity}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] italic leading-relaxed text-text-muted">
        {t("itemsReadonlyNote")}
      </p>
    </div>
  );
}

export default CartItems;
