// app/[locale]/track-order/page.tsx
// Track order — the customer's most recent orders with live status, deep
// links into the full receipt at /account/orders/[id]. Server shell +
// <OrdersList /> client island (which owns the sign-in gate and empty
// state). noindex: personal pages have no search intent.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {OrdersList} from "@/components/account/OrdersList";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Track order",
  robots: {index: false, follow: false},
};

export default async function TrackOrderPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("TrackOrder");

  return (
    <section
      aria-labelledby="track-order-heading"
      className="mx-auto w-full max-w-4xl flex-1 pb-20 pt-10 sm:pt-14"
    >
      <header className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {t("eyebrow")}
          </p>
          <h1
            id="track-order-heading"
            className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
          >
            {t("title")}
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          {t("blurb")}
        </p>
      </header>
      <div className="mt-10">
        <OrdersList nextBase="/track-order" />
      </div>
    </section>
  );
}
