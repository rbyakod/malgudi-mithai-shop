// app/[locale]/cart/page.tsx
// Cart — editable quantities, per-line prices, a clearly-labeled estimate,
// and the Proceed-to-checkout CTA (Batch 5 / Track 2b). Server shell in the
// commerce masthead rhythm; the editable body is the <CartItems /> client
// island. Delivery fees AND free-delivery thresholds are read from
// lib/config HERE (server) and passed down as props — lib/config parses
// server env and must never reach a client bundle. WhatsApp stays as the
// secondary ordering channel via CartItems' CTA.
//
// Conversion batch: the page also fetches pan-India-shippable (shelf-stable)
// upsell candidates server-side and hands serialized cards to the
// <CartUpsellRail /> client island, and mounts <CartDraftRestore /> (inside
// Suspense — it reads ?draft= via useSearchParams) for abandoned-cart email
// links.

import type {Metadata} from "next";
import {Suspense} from "react";
import {getTranslations} from "next-intl/server";
import {CartItems} from "@/components/commerce/CartItems";
import {CartUpsellRail, type CartUpsellCard} from "@/components/cart/CartUpsellRail";
import {CartDraftRestore} from "@/components/cart/CartDraftRestore";
import {readWhatsappNumber} from "@/components/commerce/CommerceStub";
import {config} from "@/lib/config";
import {getPayload} from "@/lib/payload-client";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {fallbackDocImage, firstDocImage} from "@/lib/verticals/catalogMedia";
import {FALLBACK_WHATSAPP} from "@/lib/whatsapp";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Cart",
  robots: {index: false, follow: true},
};

/** Shelf-stable candidates for the "Ships pan-India" rail — anything the
 *  courier network can deliver, best-seller first. Serialized to the
 *  minimal card shape so no Payload doc crosses the boundary. */
async function fetchUpsellCards(locale: string): Promise<CartUpsellCard[]> {
  try {
    const payload = await getPayload();
    const r = await payload.find({
      collection: "mithai-products",
      where: {freshnessStatus: {not_equals: "made-daily"}},
      sort: "-featured",
      limit: 12,
      depth: 1,
      locale: locale as "en" | "hi" | "kn" | undefined,
    });
    return (r.docs as Record<string, unknown>[]).map((doc) => ({
      productId: String(doc.id),
      name: (doc.name as string | undefined) ?? "Untitled",
      href: pdpHref(doc, "mithai-products"),
      image:
        firstDocImage(doc, "mithai-products") ??
        fallbackDocImage(doc, "mithai") ??
        null,
      priceLabel: (doc.displayPrice as string | undefined) ?? null,
    }));
  } catch {
    // The rail is a bonus, never a blocker — an empty list hides it.
    return [];
  }
}

export default async function CartPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("Cart");
  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;
  const upsellCards = await fetchUpsellCards(locale);

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

      <div className="mt-10 space-y-8">
        {/* ?draft= email-link restore — Suspense per the useSearchParams
            prerender rule (same as checkout success). */}
        <Suspense fallback={null}>
          <CartDraftRestore />
        </Suspense>
        <CartItems
          whatsapp={whatsapp}
          fees={{
            freshPaise: config.deliveryFeeFreshPaise,
            shelfStablePaise: config.deliveryFeeShelfStablePaise,
          }}
          freeThresholds={{
            freshPaise: config.freeDeliveryThresholdFreshPaise,
            shelfStablePaise: config.freeDeliveryThresholdShelfStablePaise,
          }}
        />
        <CartUpsellRail cards={upsellCards} />
      </div>
    </section>
  );
}
