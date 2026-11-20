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
      <header className="ms-head ms-hub-head">
        <p className="ms-label ms-muted">{t("eyebrow")}</p>
        <h1 id="track-order-heading" className="ms-headline">{t("title")}</h1>
        <p className="ms-lead">{t("blurb")}</p>
      </header>
      <div className="mt-10">
        <OrdersList nextBase="/track-order" />
      </div>
    </section>
  );
}
