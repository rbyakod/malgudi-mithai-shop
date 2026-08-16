// components/mithai/MithaiPDP.tsx
// Mithai product detail page body. Server component — reads the
// `mithai-products` collection by slug and renders an editorial PDP.
//
// Design intent — avoid the generic e-commerce PDP template (big image left,
// boxed buy-card right, tabs below). Instead:
//   - Two-column asymmetric header: left a display-serif title, price, and
//     the buy module (pincode check, pack sizes, quantity — the conversion
//     affordances the reference sweet shops have, but editorial-styled);
//     right the image panel with a tonal wash and gold rule, mirroring the
//     home inset / MediaCard rhythm. The buy module is deliberate, not
//     template drift — hairline rules and quiet uppercase labels keep the
//     editorial voice.
//   - Provenance strip (karigar + freshness + family) laid out as a
//     horizontal hairline-divided list, like Pillars.tsx — not a 3-up card
//     grid.
//   - Story + ingredients read as a magazine spread: a wide italic lead on
//     the left, an honest-label column (allergens, shelf life, storage) on
//     the right, separated by a vertical hairline on lg+.
//
// 404s via `notFound()` when the slug matches no published doc.

import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {BuyModule} from "@/components/mithai/BuyModule";
import {derivePackSizes} from "@/lib/mithai/packSizes";
import {isFullWidthLayout} from "@/lib/storefront-layout";
import {readStorefrontLayoutMode} from "@/lib/storefront-layout-server";
import {readWhatsappNumber} from "@/components/commerce/CommerceStub";
import {FALLBACK_WHATSAPP} from "@/lib/whatsapp";
import {flattenLexical} from "@/lib/api/richText";

type Props = {
  slug: string;
  locale: string;
};

// Freshness promise keyed by the `freshnessStatus` enum — copy lives in
// messages under Pdp.mithai.trust so hi/kn get it too.
const FRESHNESS_KEY: Record<string, string> = {
  "made-daily": "freshDaily",
  "made-to-order": "freshToOrder",
  "batch-frozen": "frozen",
};

export async function MithaiPDP({slug, locale}: Props) {
  const t = await getTranslations("Pdp.mithai");
  const tNav = await getTranslations("Nav");
  const tShared = await getTranslations("Pdp");
  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;
  const layoutMode = await readStorefrontLayoutMode();
  const isFullWidth = isFullWidthLayout(layoutMode);

  const payload = await getPayload();
  const r = await payload.find({
    collection: "mithai-products",
    where: {slug: {equals: slug}},
    limit: 1,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });

  const doc = r.docs[0] as
    | {
        id: string | number;
        name?: string;
        slug?: string;
        family?: string;
        story?: unknown;
        ingredients?: string;
        allergens?: string[] | null;
        shelfLife?: string;
        storage?: string;
        freshnessStatus?: string | null;
        dietaryTags?: string[] | null;
        leadTime?: string;
        images?: Array<{image?: {url?: string; alt?: string}} | null>;
        karigar?:
          | {
              name?: string;
              village?: string;
            }
          | string
          | null;
        displayPrice?: string;
        weight?: string | null;
      }
    | undefined;

  if (!doc) {
    notFound();
  }

  const name = doc!.name ?? "Untitled";
  const images = (doc!.images ?? []).flatMap((row) =>
    row?.image?.url ? [row.image.url] : [],
  );
  const primaryImage = images[0] ?? null;
  const karigarName =
    typeof doc!.karigar === "object" ? doc!.karigar?.name ?? null : null;
  const freshnessLabel = doc!.freshnessStatus
    ? FRESHNESS_KEY[doc!.freshnessStatus]
      ? t(`trust.${FRESHNESS_KEY[doc!.freshnessStatus]}`)
      : doc!.freshnessStatus
    : null;
  const packSizes = derivePackSizes(doc!.displayPrice ?? "", doc!.weight);
  // Payload's lexical field (or a plain string for older fixtures) → the
  // italic standfirst the magazine spread below leads with.
  const storyText = flattenLexical(doc!.story);
  const isVegetarian = (doc!.dietaryTags ?? []).some(
    (tag) => tag.toLowerCase() === "vegetarian",
  );

  return (
    <article className="pb-24 pt-8">
      <div className={["mx-auto px-1 sm:px-2 lg:px-3", isFullWidth ? "max-w-none" : "max-w-6xl"].join(" ")}>
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-breadcrumb"
        >
          <Link href="/" className="hover:text-primary">
            {tShared("breadcrumbHome")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/mithai" className="hover:text-primary">
            {tNav("mithai")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-text-muted">{name}</span>
        </nav>

        {/* Header — buy column | image panel (image leads on mobile,
            lg:order-first restores text-left / image-right on desktop) */}
        <div className="mt-10 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.5fr_0.5fr]">
          {/* Image panel — or designed fallback */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
            {primaryImage ? (
              <>
                <Image
                  src={primaryImage}
                  alt={name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 32rem, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/30 via-transparent to-transparent" />
              </>
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-gold/15 to-transparent"
              >
                <span className="font-display text-[8rem] font-light italic text-primary">
                  {(name[0] ?? "·").toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:order-first">
            {doc!.family ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc!.family}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {name}
            </h1>
            {freshnessLabel ? (
              <p className="mt-4 text-sm italic leading-relaxed text-text-muted">
                {freshnessLabel}
              </p>
            ) : null}

            <BuyModule
              productId={String(doc!.id)}
              name={name}
              image={primaryImage ?? ""}
              displayPrice={doc!.displayPrice ?? ""}
              packSizes={packSizes}
              whatsapp={whatsapp}
              layoutMode={layoutMode}
            />

            {/* Trust strip — real fields only, quiet uppercase microcopy */}
            {freshnessLabel || doc!.shelfLife || isVegetarian ? (
              <ul className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-card pt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {freshnessLabel ? <li>{freshnessLabel}</li> : null}
                {doc!.shelfLife ? (
                  <li>{t("trust.shelfLife", {shelfLife: doc!.shelfLife})}</li>
                ) : null}
                {isVegetarian ? <li>{t("trust.vegetarian")}</li> : null}
              </ul>
            ) : null}
          </div>
        </div>

        {/* Provenance strip — karigar · family · lead time */}
        <dl className="mt-10 grid gap-x-8 gap-y-6 border-b border-border-card pb-12 sm:grid-cols-3">
          {karigarName ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("karigar")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {karigarName}
              </dd>
            </div>
          ) : null}
          {doc!.leadTime ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("freshness")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {doc!.leadTime}
              </dd>
            </div>
          ) : null}
          {doc!.shelfLife ? (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("shelfLife")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {doc!.shelfLife}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Story + honest label column */}
        <section className="mt-12 grid gap-10 lg:grid-cols-[0.6fr_0.4fr] lg:gap-16">
          <div>
            {storyText ? (
              <div className={doc!.ingredients ? "mb-10" : undefined}>
                {storyText.split("\n").map((paragraph, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? "font-display text-2xl font-light italic leading-relaxed text-text-heading"
                        : "mt-4 font-display text-xl font-light italic leading-relaxed text-text-muted"
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
            {doc!.ingredients ? (
              <>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                  {t("ingredients")}
                </h2>
                <p className="mt-4 font-display text-xl font-light leading-relaxed text-text-heading">
                  {doc!.ingredients}
                </p>
              </>
            ) : null}
          </div>

          <aside className="border-l border-border-card pl-6 lg:pl-10">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("allergens")}
            </h2>
            {doc!.allergens && doc!.allergens.length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm text-text-muted">
                {doc!.allergens.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm italic text-text-muted">—</p>
            )}

            {doc!.storage ? (
              <>
                <h3 className="mt-8 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                  {t("storage")}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {doc!.storage}
                </p>
              </>
            ) : null}
          </aside>
        </section>
      </div>
    </article>
  );
}

export default MithaiPDP;
