"use client";

// components/account/OrderDetail.tsx
// Client island for /account/orders/[id] — fetches the customer-scoped
// order via GET /orders/[id] and renders the receipt: status, payment
// state, line items with per-unit prices (formatPaise), and the totals
// breakdown the server computed at checkout.

import {useEffect, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {apiFetch} from "@/lib/web/apiClient";
import {useAuth} from "@/context/AuthContext";
import {SignInPrompt} from "@/components/account/SignInPrompt";
import {StatusChip, type OrderStatusValue} from "@/components/account/StatusChip";
import {formatPaise} from "@/lib/web/format";

type OrderItem = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  unit: string;
  priceInPaise: number;
  image?: string;
};

export type Order = {
  id: string;
  items: OrderItem[];
  totals: {
    itemsTotalInPaise: number;
    deliveryFeeInPaise: number;
    taxesInPaise: number;
    discountInPaise: number;
    totalInPaise: number;
  };
  status: OrderStatusValue;
  paymentStatus: string;
  createdAt: string;
};

type Props = {
  orderId: string;
};

export function OrderDetail({orderId}: Props) {
  const t = useTranslations("Orders");
  const tAccount = useTranslations("Account");
  const locale = useLocale();
  const {session, ready} = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!ready || !session) return;
    let cancelled = false;
    setState("loading");
    void apiFetch<Order>(`/orders/${orderId}`)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
          setState("ok");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // ORDER_NOT_FOUND covers both "missing" and "someone else's order";
        // transient errors surface the same honest not-found copy.
        setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, session, orderId]);

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  }

  if (!ready) {
    return (
      <p aria-busy="true" className="text-sm italic text-text-muted">
        {tAccount("loading")}
      </p>
    );
  }

  if (!session) {
    return <SignInPrompt next={`/account/orders/${orderId}`} />;
  }

  if (state === "loading") {
    return (
      <p aria-busy="true" className="text-sm italic text-text-muted">
        {tAccount("loading")}
      </p>
    );
  }

  if (state === "missing" || !order) {
    return (
      <div className="rounded-2xl border border-dashed border-border-card bg-bg-card/50 p-8 text-center">
        <p className="text-sm italic leading-relaxed text-text-muted">
          {t("notFound")}
        </p>
        <Link
          href="/account"
          className="mt-5 inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
        >
          {t("backToAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Meta */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-card pb-6">
        <div>
          <p className="font-display text-2xl text-text-heading">
            {t("reference", {ref: order.id.slice(-8)})}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusChip status={order.status} />
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
            {t("paymentLabel")}: {t(`payment.${order.paymentStatus}`)}
          </p>
        </div>
      </div>

      {/* Items */}
      <section aria-labelledby="order-items-heading">
        <h2
          id="order-items-heading"
          className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
        >
          {t("itemsHeading")}
        </h2>
        <ul className="mt-4 divide-y divide-border-card">
          {order.items.map((item) => (
            <li
              key={`${item.productId}-${item.slug}`}
              className="flex flex-wrap items-baseline justify-between gap-2 py-4"
            >
              <div>
                <Link
                  href={`/mithai/${item.slug}`}
                  className="text-sm text-text-heading underline-offset-4 hover:text-primary hover:underline"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-xs text-text-muted">
                  {t("itemUnitPrice", {
                    quantity: String(item.quantity),
                    unit: item.unit,
                    price: formatPaise(item.priceInPaise),
                  })}
                </p>
              </div>
              <p
                data-testid="order-item-total"
                className="font-display text-base text-text-heading"
              >
                {formatPaise(item.priceInPaise * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Totals */}
      <section aria-labelledby="order-totals-heading">
        <h2
          id="order-totals-heading"
          className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
        >
          {t("totalsHeading")}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-text-secondary">
            <dt>{t("totalsItems")}</dt>
            <dd>{formatPaise(order.totals.itemsTotalInPaise)}</dd>
          </div>
          <div className="flex justify-between text-text-secondary">
            <dt>{t("totalsDelivery")}</dt>
            <dd>{formatPaise(order.totals.deliveryFeeInPaise)}</dd>
          </div>
          {order.totals.discountInPaise > 0 ? (
            <div className="flex justify-between text-text-secondary">
              <dt>{t("totalsDiscount")}</dt>
              <dd>−{formatPaise(order.totals.discountInPaise)}</dd>
            </div>
          ) : null}
          {order.totals.taxesInPaise > 0 ? (
            <div className="flex justify-between text-text-secondary">
              <dt>{t("totalsTaxes")}</dt>
              <dd>{formatPaise(order.totals.taxesInPaise)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border-card pt-3 text-text-heading">
            <dt className="font-display text-base">{t("totalsTotal")}</dt>
            <dd data-testid="order-detail-total" className="font-display text-base">
              {formatPaise(order.totals.totalInPaise)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs italic text-text-muted">{t("taxNote")}</p>
      </section>

      <Link
        href="/account"
        className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
      >
        {t("backToAccount")}
      </Link>
    </div>
  );
}

export default OrderDetail;
