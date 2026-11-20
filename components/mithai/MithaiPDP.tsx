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
import {CrossSellRail} from "@/components/mithai/CrossSellRail";
import {ProductReviews} from "@/components/reviews/ProductReviews";
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

// Dietary chips keyed by the seed's known dietaryTags values. Admin-entered
// free text renders verbatim — the strip's uppercase tracking styles it.
const DIETARY_KEY: Record<string, string> = {
  vegetarian: "vegetarian",
  "sugar-free": "sugarFree",
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
  const dietaryChips = Array.from(new Set(doc!.dietaryTags ?? [])).map(
    (tag) => {
      const key = DIETARY_KEY[tag.toLowerCase()];
      return {tag, label: key ? t(`trust.${key}`) : tag};
    },
  );

  const isVeg = (doc!.dietaryTags ?? []).some((tag) => tag.toLowerCase() === "vegetarian");

  return (
    <article className="pb-24 pt-8" data-agent-section="product">
      <div className={["mx-auto px-1 sm:px-2 lg:px-3", isFullWidth ? "max-w-none" : "max-w-6xl"].join(" ")}>
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="ms-breadcrumb"
        >
          <Link href="/">{tShared("breadcrumbHome")}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/mithai">{tNav("mithai")}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{name}</span>
        </nav>

        {/* Header — buy column | image panel (image leads on mobile,
            lg:order-first restores text-left / image-right on desktop) */}
        <div className="ms-pdp-top">
          {/* Picture: 4:5 on a nutmeg ground, as the design system crops a hero. */}
          <figure className="ms-pdp-media">
            {primaryImage ? (
              <Image
                src={primaryImage}
                alt={name}
                fill
                priority
                sizes="(min-width: 1024px) 32rem, 100vw"
                className="object-cover kb-drift"
              />
            ) : (
              <span aria-hidden="true" className="ms-card-glyph ms-card-glyph--lg">
                {(name[0] ?? "·").toUpperCase()}
              </span>
            )}
          </figure>

          <div className="ms-pdp-buy">
            {doc!.family ? <p className="ms-label ms-muted">{doc!.family}</p> : null}
            <div className="ms-card-name">
              {isVeg ? <span className="ms-veg" role="img" aria-label={t("trust.vegetarian")} /> : null}
              <h1 className="ms-headline ms-maroon">{name}</h1>
            </div>
            {freshnessLabel ? <p className="ms-caption ms-muted">{freshnessLabel}</p> : null}

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
            {freshnessLabel ||
            doc!.shelfLife ||
            doc!.leadTime ||
            dietaryChips.length > 0 ? (
              <ul
                data-testid="pdp-trust-strip"
                className="ms-tag-list"
              >
                {freshnessLabel ? <li className="ms-tag ms-tag-cream">{freshnessLabel}</li> : null}
                {doc!.shelfLife ? (
                  <li className="ms-tag ms-tag-cream">{t("trust.shelfLife", {shelfLife: doc!.shelfLife})}</li>
                ) : null}
                {doc!.leadTime ? <li className="ms-tag ms-tag-cream">{doc!.leadTime}</li> : null}
                {dietaryChips.map(({tag, label}) => (
                  <li key={tag} className="ms-tag ms-tag-cream">{label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* Provenance strip — karigar · family · lead time */}
        <dl className="ms-pdp-facts">
          {karigarName ? (
            <div>
              <dt className="ms-field-label">
                {t("karigar")}
              </dt>
              <dd className="ms-body">
                {karigarName}
              </dd>
            </div>
          ) : null}
          {doc!.leadTime ? (
            <div>
              <dt className="ms-field-label">
                {t("freshness")}
              </dt>
              <dd className="ms-body">
                {doc!.leadTime}
              </dd>
            </div>
          ) : null}
          {doc!.shelfLife ? (
            <div>
              <dt className="ms-field-label">
                {t("shelfLife")}
              </dt>
              <dd className="ms-body">
                {doc!.shelfLife}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Story + honest label column */}
        <section className="ms-pdp-story">
          <div>
            {storyText ? (
              <div className={["ms-stack", doc!.ingredients ? "mb-10" : ""].join(" ")}>
                {storyText.split("\n").map((paragraph, i) => (
                  <p
                    key={i}
                    className={i === 0 ? "ms-lead" : "ms-body ms-muted"}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
            {doc!.ingredients ? (
              <>
                <h2 className="ms-label ms-muted">
                  {t("ingredients")}
                </h2>
                <p className="ms-body">
                  {doc!.ingredients}
                </p>
              </>
            ) : null}
          </div>

          {/* Honest-label column — each row renders only when the doc
              actually carries the data (no empty "—" placeholders). */}
          {(doc!.allergens?.length ?? 0) > 0 || doc!.storage ? (
            <aside
              data-testid="pdp-honest-label"
              className="ms-pdp-label"
            >
              {doc!.allergens && doc!.allergens.length > 0 ? (
                <div data-testid="pdp-allergens">
                  <h2 className="ms-label ms-muted">
                    {t("allergens")}
                  </h2>
                  <ul className="ms-body ms-plain-list">
                    {doc!.allergens.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {doc!.storage ? (
                <div data-testid="pdp-storage">
                  <h3
                    className={[
                      "ms-label ms-muted",
                      (doc!.allergens?.length ?? 0) > 0 ? "mt-8" : "",
                    ].join(" ")}
                  >
                    {t("storage")}
                  </h3>
                  <p className="ms-body">
                    {doc!.storage}
                  </p>
                </div>
              ) : null}
            </aside>
          ) : null}
        </section>

        {/* Same-family cross-sell rail — fetches its own siblings and
            renders nothing when the family has no other members. */}
        <CrossSellRail
          family={doc!.family}
          selfSlug={doc!.slug ?? slug}
          locale={locale}
        />

        {/* Approved public reviews (B10) — self-fetching; renders nothing
            when the product has no approved reviews yet. */}
        <ProductReviews productId={String(doc!.id)} locale={locale} />
      </div>
    </article>
  );
}

export default MithaiPDP;
