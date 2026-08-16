// app/[locale]/cart/page.tsx
// Cart — editable quantities, per-line prices, a clearly-labeled estimate,
// and the Proceed-to-checkout CTA (Batch 5 / Track 2b). Server shell in the
// commerce masthead rhythm; the editable body is the <CartItems /> client
// island. Delivery fees are read from lib/config HERE (server) and passed
// down as props — lib/config parses server env and must never reach a
// client bundle. WhatsApp stays as the secondary ordering channel via
// CartItems' CTA.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {CartItems} from "@/components/commerce/CartItems";
import {readWhatsappNumber} from "@/components/commerce/CommerceStub";
import {config} from "@/lib/config";
import {FALLBACK_WHATSAPP} from "@/lib/whatsapp";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Cart",
  robots: {index: false, follow: true},
};

export default async function CartPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Cart");
  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;

  return (
    <section
      aria-labelledby="cart-heading"
      className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8"
    >
      {/* Masthead — eyebrow + display-serif title + blurb (CommerceStub rhythm). */}
      <header className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {t("eyebrow")}
          </p>
          <h1
            id="cart-heading"
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
        <CartItems
          whatsapp={whatsapp}
          fees={{
            freshPaise: config.deliveryFeeFreshPaise,
            shelfStablePaise: config.deliveryFeeShelfStablePaise,
          }}
        />
      </div>
    </section>
  );
}
