"use client";

// components/account/OrdersList.tsx
// Customer orders via GET /orders (customer-scoped on the server). Renders
// one row per order — reference, date, status chip, total — linking to the
// order detail page at /account/orders/[id]. Also serves /track-order:
// pass `nextBase` so empty/sign-in deep links return to the right surface.

import {useCallback, useEffect, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {apiFetch, ApiClientError} from "@/lib/web/apiClient";
import {useAuth} from "@/context/AuthContext";
import {SignInPrompt} from "@/components/account/SignInPrompt";
import {StatusChip, type OrderStatusValue} from "@/components/account/StatusChip";
import {formatPaise} from "@/lib/web/format";

export type OrderSummary = {
  id: string;
  status: OrderStatusValue;
  paymentStatus: string;
  totals: {totalInPaise: number};
  createdAt: string;
};

type Props = {
  /** Where the sign-in prompt and empty-state links return to. */
  nextBase?: string;
};

export function OrdersList({nextBase = "/account"}: Props) {
  const t = useTranslations("Orders");
  const tAccount = useTranslations("Account");
  const locale = useLocale();
  const {session, ready} = useAuth();

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{items: OrderSummary[]}>(
        "/orders?page=1&pageSize=10",
      );
      setOrders(data.items ?? []);
    } catch (err) {
      setOrders([]);
      if (err instanceof ApiClientError) setError(t("loadError"));
    }
  }, [t]);

  useEffect(() => {
    if (!ready || !session) return;
    void load();
  }, [ready, session, load]);

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  }

  if (!ready) {
    return (
      <section aria-labelledby="orders-heading">
        <h2
          id="orders-heading"
          className="border-b border-border-card pb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
        >
          {t("heading")}
        </h2>
        <p aria-busy="true" className="mt-6 text-sm italic text-text-muted">
          {tAccount("loading")}
        </p>
      </section>
    );
  }

  if (!session) {
    return (
      <section aria-labelledby="orders-heading">
        <h2
          id="orders-heading"
          className="border-b border-border-card pb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
        >
          {t("heading")}
        </h2>
        <div className="mt-6">
          <SignInPrompt next={nextBase} />
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="orders-heading">
      <h2
        id="orders-heading"
        className="border-b border-border-card pb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
      >
        {t("heading")}
      </h2>

      {error ? (
        <p aria-live="polite" className="mt-4 text-sm italic text-text-muted">
          {error}
        </p>
      ) : null}

      {orders === null ? (
        <p aria-busy="true" className="mt-6 text-sm italic text-text-muted">
          {tAccount("loading")}
        </p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm italic leading-relaxed text-text-muted">
          {t("empty")}{" "}
          <Link
            href="/mithai"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("emptyCta")} →
          </Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.id} data-testid="order-row">
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl border border-border-card bg-bg-card p-5 transition-colors hover:border-primary"
              >
                <div>
                  <p className="font-display text-base text-text-heading">
                    {t("reference", {ref: order.id.slice(-8)})}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusChip status={order.status} />
                  <p
                    data-testid="order-total"
                    className="font-display text-base text-text-heading"
                  >
                    {formatPaise(order.totals.totalInPaise)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default OrdersList;
