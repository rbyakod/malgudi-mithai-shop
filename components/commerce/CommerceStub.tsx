// components/commerce/CommerceStub.tsx
// Branded stub shared by /cart, /checkout, /account, /track-order while
// commerce launches in Phase 8. Editorial masthead (eyebrow / display-serif
// title / blurb) + a two-column CTA rail: a WhatsApp deep link on the left,
// a weddings lead CTA on the right. Optional `children` renders between the
// masthead and the CTA rail — /cart uses it to list current cart items via
// the <CartItems /> client island.
//
// Server component. Reads `analytics-settings.whatsappNumber` from Payload
// with a try/catch fallback (same pattern as BrandBar / SiteFooter).

import {ReactNode} from "react";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";
import {WhatsAppLink} from "@/components/commerce/WhatsAppLink";
import {FALLBACK_WHATSAPP, toWaDigits} from "@/lib/whatsapp";

type StubNamespace = "cart" | "checkout" | "account" | "trackOrder" | "buildAGift";

type Props = {
  namespace: StubNamespace;
  children?: ReactNode;
  hideDefaultCtas?: boolean;
};

// Best-effort Payload read. Returns null on any error so the page never
// throws during build, migrations, or DB outages.
export async function readWhatsappNumber(): Promise<string | null> {
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

export async function CommerceStub({namespace, children, hideDefaultCtas = false}: Props) {
  const t = await getTranslations(`Commerce.stubs.${namespace}`);
  const tCommon = await getTranslations("Commerce.common");

  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;
  const digits = toWaDigits(whatsapp);
  const waHref = digits ? `https://wa.me/${digits}` : "#";

  // Pre-fill the WhatsApp message with the page name so the events team can
  // route the conversation.
  const waText = encodeURIComponent(
    `Hi Mishran — I'd like help with ${namespace === "trackOrder" ? "an order" : namespace}.`,
  );
  const waLink = digits ? `${waHref}?text=${waText}` : "#";

  return (
    <section
      aria-labelledby="commerce-stub-heading"
      className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8"
    >
      {/* Masthead — eyebrow + display-serif title + blurb */}
      <header className="ms-head ms-hub-head">
        <p className="ms-label ms-muted">{tCommon("eyebrow")}</p>
        <h1 id="commerce-stub-heading" className="ms-headline">{t("title")}</h1>
        <p className="ms-lead">{t("blurb")}</p>
      </header>

      {/* Optional children — /cart renders the read-only cart list here. */}
      {children ? <div className="mt-10">{children}</div> : null}

      {hideDefaultCtas ? null : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <WhatsAppLink
            href={waLink}
            whatsapp={whatsapp}
            ctaLabel={tCommon("whatsappCta")}
          />
          <Link
            href="/weddings"
            className="ms-door"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
              />
              <span className="ms-label ms-muted">
                {tCommon("leadEyebrow")}
              </span>
            </div>
            <p className="text-base font-medium text-text-heading">
              {tCommon("leadCta")}
            </p>
            <p className="text-xs leading-relaxed text-text-muted">
              {tCommon("leadHint")}
            </p>
          </Link>
        </div>
      )}
    </section>
  );
}

export default CommerceStub;
