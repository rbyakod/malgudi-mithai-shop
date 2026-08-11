// components/mithai/MithaiPDP.tsx
// Mithai product detail page body. Server component — reads the
// `mithai-products` collection by slug and renders an editorial PDP.
//
// Design intent — avoid the generic e-commerce PDP template (big image left,
// buy-box right, tabs below). Instead:
//   - Two-column asymmetric header: left a hairline-anchored display-serif
//     title + display price + freshness eyebrow; right the image panel with
//     a tonal wash and gold rule, mirroring the home inset / MediaCard rhythm.
//   - Provenance strip (karigar + freshness + family) laid out as a
//     horizontal hairline-divided list, like Pillars.tsx — not a 3-up card
//     grid.
//   - Story + ingredients read as a magazine spread: a wide italic lead on
//     the left, an honest-label column (allergens, shelf life, storage) on
//     the right, separated by a vertical hairline on lg+.
//   - CTA is a borderless tracked-uppercase button styled as a hairline
//     rule, not a chunky add-to-cart pill — keeps the editorial voice.
//
// 404s via `notFound()` when the slug matches no published doc.

import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {AddToCartButton} from "@/components/mithai/AddToCartButton";

type Props = {
  slug: string;
  locale: string;
};

// Freshness copy is intentionally terse — maps the `freshnessStatus` enum
// (made-daily / made-to-order / batch-frozen) to a one-line promise. Could
// be translation keys, but the enum values are stable and few.
const FRESHNESS_COPY: Record<string, string> = {
  "made-daily": "Made fresh each morning",
  "made-to-order": "Made to order, finished on request",
  "batch-frozen": "Finished fresh, frozen at peak",
};

export async function MithaiPDP({slug, locale}: Props) {
  const t = await getTranslations("Pdp.mithai");
  const tNav = await getTranslations("Nav");
  const tShared = await getTranslations("Pdp");

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
    ? FRESHNESS_COPY[doc!.freshnessStatus] ?? doc!.freshnessStatus
    : null;

  return (
    <article className="pb-24 pt-8">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
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

        {/* Header — title + price column | image panel */}
        <div className="mt-10 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.5fr_0.5fr]">
          <div className="flex flex-col justify-end">
            {doc!.family ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc!.family}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {name}
            </h1>
            {doc!.displayPrice ? (
              <p className="mt-6 font-display text-2xl font-medium text-text-heading">
                <span data-testid="display-price">{doc!.displayPrice}</span>
              </p>
            ) : null}
            {freshnessLabel ? (
              <p className="mt-4 text-sm italic leading-relaxed text-text-muted">
                {freshnessLabel}
              </p>
            ) : null}
          </div>

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

        {/* CTA — add to draft cart */}
        <div className="mt-16 flex justify-center">
          <AddToCartButton
            id={String(doc!.id)}
            name={name}
            priceLabel={doc!.displayPrice ?? ""}
            image={primaryImage ?? ""}
            label={t("addToCart")}
            addedLabel={t("added")}
          />
        </div>
      </div>
    </article>
  );
}

export default MithaiPDP;
