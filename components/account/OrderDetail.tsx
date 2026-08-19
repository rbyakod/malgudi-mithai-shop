"use client";

// components/account/OrderDetail.tsx
// Client island for /account/orders/[id] — fetches the customer-scoped
// order via GET /orders/[id] and renders the receipt: status, payment
// state, line items with per-unit prices (formatPaise), and the totals
// breakdown the server computed at checkout.
//
// Retention batch: one-tap "Order again" (maps items back to cart ids via
// lib/web/reorder — composite `productId:packLabel` where the order kept
// it, bare productId for legacy lines) and, for delivered orders, per-item
// review capture (1–5 stars + optional note → POST /reviews; upsert per
// product, so re-submitting edits). No review display anywhere.

import {useEffect, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {apiFetch} from "@/lib/web/apiClient";
import {useAuth} from "@/context/AuthContext";
import {useCart} from "@/context/CartContext";
import {SignInPrompt} from "@/components/account/SignInPrompt";
import {StatusChip, type OrderStatusValue} from "@/components/account/StatusChip";
import {formatPaise} from "@/lib/web/format";
import {toReorderCartItems} from "@/lib/web/reorder";

type OrderItem = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  unit: string;
  priceInPaise: number;
  image?: string;
  /** Derived-pack label (Batch A+); legacy orders omit it. */
  packLabel?: string;
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
  const router = useRouter();
  const {session, ready} = useAuth();
  const {addItem} = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [reordered, setReordered] = useState(false);
  // Per-item review state keyed by productId: chosen rating + lifecycle.
  const [reviewDraft, setReviewDraft] = useState<
    Record<string, {rating: number | null; body: string}>
  >({});
  const [reviewState, setReviewState] = useState<
    Record<string, "idle" | "saving" | "done" | "error">
  >({});

  useEffect(() => {
    if (!ready || !session) return;
    let cancelled = false;
    // setTimeout hop — react-hooks v6 flags a sync setState("loading")
    // in the effect body; the hop also lets cleanup cancel a refetch
    // that hasn't fired yet.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
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
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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

  // One-tap reorder — every line back into the cart (composite ids for
  // derived packs), a brief confirmation, then straight to /cart.
  function orderAgain() {
    if (!order) return;
    for (const item of toReorderCartItems(order.items)) {
      addItem(
        {id: item.id, name: item.name, priceLabel: item.priceLabel, image: item.image},
        item.quantity,
      );
    }
    setReordered(true);
    window.setTimeout(() => router.push("/cart"), 800);
  }

  async function submitReview(productId: string) {
    const draft = reviewDraft[productId];
    if (!draft?.rating) return;
    setReviewState((prev) => ({...prev, [productId]: "saving"}));
    try {
      await apiFetch("/reviews", {
        method: "POST",
        body: {
          productId,
          rating: draft.rating,
          ...(draft.body.trim() ? {body: draft.body.trim()} : {}),
        },
      });
      setReviewState((prev) => ({...prev, [productId]: "done"}));
    } catch {
      setReviewState((prev) => ({...prev, [productId]: "error"}));
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

      {/* One-tap reorder */}
      <section aria-labelledby="order-again-heading">
        <h2
          id="order-again-heading"
          className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
        >
          {t("reorderHeading")}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-testid="order-again"
            onClick={orderAgain}
            disabled={reordered}
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-light transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {t("reorderCta")}
          </button>
          {reordered ? (
            <p
              data-testid="order-again-added"
              className="text-xs leading-relaxed text-text-secondary"
            >
              {t("reorderAdded")}
            </p>
          ) : null}
        </div>
      </section>

      {/* Review capture — delivered orders only, one form per line item.
          Reviews upsert per (customer, product), so a re-submit edits. */}
      {order.status === "delivered" ? (
        <section aria-labelledby="order-reviews-heading">
          <h2
            id="order-reviews-heading"
            className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold"
          >
            {t("reviewsHeading")}
          </h2>
          <ul className="mt-4 divide-y divide-border-card">
            {order.items.map((item) => {
              const draft = reviewDraft[item.productId] ?? {rating: null, body: ""};
              const rs = reviewState[item.productId] ?? "idle";
              return (
                <li key={`review-${item.productId}`} className="py-5">
                  <p className="text-sm text-text-heading">{item.name}</p>
                  {rs === "done" ? (
                    <p
                      data-testid="review-received"
                      className="mt-2 text-xs leading-relaxed text-text-secondary"
                    >
                      {t("reviewReceived")}
                    </p>
                  ) : (
                    <form
                      data-testid="review-form"
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submitReview(item.productId);
                      }}
                    >
                      <div className="flex items-center gap-1" role="radiogroup" aria-label={t("reviewStarsLabel", {name: item.name})}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={draft.rating === n}
                            aria-label={t("reviewStarLabel", {count: String(n)})}
                            data-testid={`review-star-${n}`}
                            onClick={() =>
                              setReviewDraft((prev) => ({
                                ...prev,
                                [item.productId]: {...draft, rating: n},
                              }))
                            }
                            className={`px-1 font-display text-lg leading-none transition-colors ${
                              draft.rating !== null && n <= draft.rating
                                ? "text-gold"
                                : "text-text-muted/40 hover:text-gold/70"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        aria-label={t("reviewBodyLabel")}
                        placeholder={t("reviewBodyPlaceholder")}
                        value={draft.body}
                        onChange={(e) =>
                          setReviewDraft((prev) => ({
                            ...prev,
                            [item.productId]: {...draft, body: e.target.value},
                          }))
                        }
                        className="w-full rounded-2xl border border-border-input bg-bg-control px-4 py-2 text-sm text-text-heading placeholder:text-text-muted/70 focus:border-primary focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={draft.rating === null || rs === "saving"}
                          className="border border-border-input bg-bg-control px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                        >
                          {t("reviewSubmit")}
                        </button>
                        {rs === "error" ? (
                          <p className="text-xs text-gold">{t("reviewError")}</p>
                        ) : null}
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
