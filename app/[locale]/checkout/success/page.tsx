// app/[locale]/checkout/success/page.tsx
// Order-confirmed landing after a verified Razorpay payment — the receipt
// for ?orderId=… is re-fetched customer-scoped via GET /orders/[id] inside
// the <CheckoutSuccess /> island (which reuses <OrderDetail />). noindex:
// a transactional confirmation page has no search intent. The orderId
// arrives as a query param, so the island reads it client-side inside a
// Suspense boundary (useSearchParams).

import type {Metadata} from "next";
import {Suspense} from "react";
import {getTranslations} from "next-intl/server";
import {CheckoutSuccess} from "@/components/checkout/CheckoutSuccess";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: {index: false, follow: false},
};

export default async function CheckoutSuccessPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Checkout.success");

  return (
    <section
      aria-labelledby="checkout-success-heading"
      className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8"
    >
      <header className="border-b border-border-card pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("eyebrow")}
        </p>
        <h1
          id="checkout-success-heading"
          className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
        >
          {t("title")}
        </h1>
      </header>
      <Suspense fallback={null}>
        <CheckoutSuccess />
      </Suspense>
    </section>
  );
}
