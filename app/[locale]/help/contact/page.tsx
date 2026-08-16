// app/[locale]/help/contact/page.tsx
// Contact & support — bespoke layout (not the generic legal shell):
// WhatsApp primary CTA (number from the Payload `analytics-settings`
// global with the shared fallback, same best-effort pattern as
// CommerceStub / SiteFooter), weddings + corporate lead cards, and the
// kitchen address block. Copy in messages under Legal.contact. Indexable.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";
import {WhatsAppLink} from "@/components/commerce/WhatsAppLink";
import {FALLBACK_WHATSAPP, toWaDigits} from "@/lib/whatsapp";

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Legal.contact");
  return {title: t("title"), description: t("intro")};
}

// Best-effort Payload read — never throw during build or a DB outage.
async function readWhatsappNumber(): Promise<string | null> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "analytics-settings"});
    const value = (global as {whatsappNumber?: unknown}).whatsappNumber;
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  } catch {
    return null;
  }
}

export default async function ContactPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Legal.contact");

  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;
  const digits = toWaDigits(whatsapp);
  const waText = encodeURIComponent("Hi Mishran — I'd like some help with ");
  const waLink = digits ? `https://wa.me/${digits}?text=${waText}` : "#";

  return (
    <section
      aria-labelledby="legal-contact-heading"
      className="mx-auto w-full max-w-4xl flex-1 pb-20 pt-10 sm:pt-14"
    >
      <header className="border-b border-border-card pb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("eyebrow")}
        </p>
        <h1
          id="legal-contact-heading"
          className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
          {t("intro")}
        </p>
      </header>

      {/* CTA rail — WhatsApp primary, weddings + corporate secondary */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <WhatsAppLink
          href={waLink}
          whatsapp={whatsapp}
          ctaLabel={t("whatsappCta")}
        />
        <div className="grid gap-6">
          <Link
            href="/weddings"
            className="group flex flex-col justify-between gap-3 rounded-2xl border border-border-card bg-bg-card p-6 transition-colors hover:border-primary"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              {t("weddingsEyebrow")}
            </span>
            <p className="text-base font-medium text-text-heading">
              {t("weddingsCta")}
            </p>
            <p className="text-xs leading-relaxed text-text-muted">
              {t("weddingsHint")}
            </p>
          </Link>
          <Link
            href="/corporate"
            className="group flex flex-col justify-between gap-3 rounded-2xl border border-border-card bg-bg-card p-6 transition-colors hover:border-primary"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              {t("corporateEyebrow")}
            </span>
            <p className="text-base font-medium text-text-heading">
              {t("corporateCta")}
            </p>
            <p className="text-xs leading-relaxed text-text-muted">
              {t("corporateHint")}
            </p>
          </Link>
        </div>
      </div>

      {/* Address + hours */}
      <div className="mt-12 grid gap-8 border-t border-border-card pt-10 sm:grid-cols-2">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {t("addressHeading")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {t("addressBody")}
          </p>
        </div>
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {t("hoursHeading")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {t("hoursBody")}
          </p>
        </div>
      </div>
    </section>
  );
}
