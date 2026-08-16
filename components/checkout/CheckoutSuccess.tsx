"use client";

// components/checkout/CheckoutSuccess.tsx
// Post-payment landing for /checkout/success?orderId=… — reads the order id
// from the URL and renders the receipt by re-fetching the customer-scoped
// order (GET /orders/[id]) through the shared <OrderDetail /> island, so
// the receipt the customer just paid for and the one in /account can never
// drift. A missing orderId (direct visit) gets honest copy + a way out.

import {useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {Link} from "@/i18n/navigation";
import {OrderDetail} from "@/components/account/OrderDetail";

export function CheckoutSuccess() {
  const t = useTranslations("Checkout.success");
  const params = useSearchParams();
  const orderId = params.get("orderId");

  return (
    <div className="mt-10 space-y-10">
      <p
        data-testid="checkout-success-lead"
        className="max-w-md text-sm leading-relaxed text-text-muted"
      >
        {t("lead")}
      </p>

      {orderId ? (
        <OrderDetail orderId={orderId} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border-card bg-bg-card/50 p-8 text-center">
          <p className="text-sm italic leading-relaxed text-text-muted">
            {t("noOrder")}
          </p>
          <Link
            href="/account"
            className="mt-5 inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
          >
            {t("yourOrders")}
          </Link>
        </div>
      )}

      <Link
        href="/mithai"
        className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-primary underline-offset-4 hover:underline"
      >
        {t("continueShopping")}
      </Link>
    </div>
  );
}

export default CheckoutSuccess;
