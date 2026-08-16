// app/[locale]/account/orders/[id]/page.tsx
// Order detail — receipt for one order via the customer-scoped
// GET /orders/[id]. Server shell + <OrderDetail /> client island.
// noindex: personal pages have no search intent.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {OrderDetail} from "@/components/account/OrderDetail";

type Props = {
  params: Promise<{locale: string; id: string}>;
};

export const metadata: Metadata = {
  title: "Order detail",
  robots: {index: false, follow: false},
};

export default async function OrderDetailPage({params}: Props) {
  const {id} = await params;
  const t = await getTranslations("Orders");

  return (
    <section
      aria-labelledby="order-detail-heading"
      className="mx-auto w-full max-w-3xl flex-1 pb-20 pt-10 sm:pt-14"
    >
      <header className="border-b border-border-card pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("detailEyebrow")}
        </p>
        <h1
          id="order-detail-heading"
          className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
        >
          {t("detailTitle")}
        </h1>
      </header>
      <div className="mt-10">
        <OrderDetail orderId={id} />
      </div>
    </section>
  );
}
