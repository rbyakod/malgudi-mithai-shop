// app/[locale]/checkout/page.tsx
// Checkout — address → delivery slot (fresh tier) → server-priced summary
// → Razorpay (Batch 5 / Track 2b). Server shell in the commerce masthead
// rhythm wrapping the <CheckoutFlow /> client island. noindex: a
// transactional page has no search intent. Signed-out customers see the
// sign-in prompt inside the island (deep-linked back here); an empty cart
// redirects to /cart — both client-side, no middleware involved.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {CheckoutFlow} from "@/components/checkout/CheckoutFlow";
import {readWhatsappNumber} from "@/components/commerce/CommerceStub";
import {FALLBACK_WHATSAPP} from "@/lib/whatsapp";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Checkout",
  robots: {index: false, follow: false},
};

export default async function CheckoutPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Checkout");
  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;

  return (
    <section
      aria-labelledby="checkout-heading"
      className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8"
    >
      {/* Masthead — eyebrow + display-serif title + blurb (CommerceStub rhythm). */}
      <header className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {t("eyebrow")}
          </p>
          <h1
            id="checkout-heading"
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
        <CheckoutFlow whatsapp={whatsapp} />
      </div>
    </section>
  );
}
