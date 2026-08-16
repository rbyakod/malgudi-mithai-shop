// app/[locale]/snacks/[slug]/page.tsx
// Snack product PDP. Namkeen / cookie / dry-fruit. Sold through external
// retailers (not direct checkout) — surface the retailer links as the CTA.
//
// Same slugless-collection approach as QSR (slugify(name) === :slug).
// `snack-products` has no slug field; see qsr/[slug]/page.tsx for the
// rationale.

import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {Link} from "@/i18n/navigation";
import {slugify} from "@/lib/slugify";
import {RetailerLink} from "@/components/snacks/RetailerLink";
import {InlineScript} from "@/components/InlineScript";
import {productSchema} from "@/lib/seo/schema";

export const revalidate = 60;

type Params = {locale: string; slug: string};
type Context = {params: Promise<Params>};

type SnackDoc = {
  id: string | number;
  name?: string;
  category?: string;
  weight?: string;
  description?: string;
  msrp?: string;
  images?: Array<{image?: {url?: string}} | null> | null;
  externalRetailers?: Array<{label?: string; url?: string} | null> | null;
};

async function findDoc(
  slug: string,
  locale: string,
): Promise<SnackDoc | null> {
  const payload = await getPayload();
  const r = await payload.find({
    collection: "snack-products",
    limit: 100,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });
  const docs = r.docs as SnackDoc[];
  return docs.find((d) => d.name && slugify(d.name) === slug) ?? null;
}

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({collection: "snack-products", limit: 100});
  const slugs = (r.docs as SnackDoc[])
    .map((d) => (d.name ? slugify(d.name) : null))
    .filter((s): s is string => s !== null);
  // Cross-product with locales — see layout generateStaticParams.
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({locale, slug})),
  );
}

export async function generateMetadata({
  params,
}: Context): Promise<Metadata> {
  const {locale, slug} = await params;
  const doc = await findDoc(slug, locale);
  if (!doc) return {};
  return {title: doc.name, description: doc.description};
}

export default async function Page({params}: Context) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const doc = await findDoc(slug, locale);
  if (!doc) notFound();

  const t = await getTranslations("Pdp.snacks");
  const tNav = await getTranslations("Nav");
  const tShared = await getTranslations("Pdp");

  const imageUrl = (doc.images ?? []).flatMap((row) =>
    row?.image?.url ? [row.image.url] : [],
  )[0];

  const retailers = (doc.externalRetailers ?? []).filter(
    (r): r is {label: string; url: string} =>
      !!r && !!r.label && !!r.url,
  );

  // Product JSON-LD — emitted only when the MSRP parses to a real number
  // (the helper omits `offers` otherwise, and an offer-less Product adds
  // nothing over the page itself). `<` escaped per the Next.js pattern.
  const productLd = productSchema({
    name: doc.name,
    description: doc.description,
    displayPrice: doc.msrp,
    images: doc.images,
  });
  const productLdHtml =
    "offers" in productLd
      ? JSON.stringify(productLd).replace(/</g, "\\u003c")
      : null;

  return (
    <article className="pb-24 pt-8">
      <div className="mx-auto max-w-5xl px-1 sm:px-2 lg:px-3">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-breadcrumb"
        >
          <Link href="/" className="hover:text-primary">
            {tShared("breadcrumbHome")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/snacks" className="hover:text-primary">
            {tNav("snacks")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-text-muted">{doc.name}</span>
        </nav>

        {/* Header — buy column | image panel (image leads on mobile,
            lg:order-first restores text-left / image-right on desktop).
            Mirrors the mithai PDP buy module: price up top, pack chip,
            retailer CTAs — editorial-styled, no boxed cards. */}
        <div className="mt-10 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.55fr_0.45fr]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={doc.name ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 28rem, 100vw"
                className="object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-gold/15 to-transparent"
              >
                <span className="font-display text-[8rem] font-light italic text-primary">
                  {(doc.name?.[0] ?? "·").toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:order-first">
            {doc.category ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc.category}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {doc.name}
            </h1>

            {/* Price block */}
            {doc.msrp ? (
              <div className="mt-6">
                <p className="font-display text-2xl font-medium text-text-heading">
                  <span data-testid="display-price">{doc.msrp}</span>
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
                  {t("taxNote")}
                </p>
              </div>
            ) : null}

            {doc.description ? (
              <p className="mt-6 max-w-md text-sm leading-relaxed text-text-muted">
                {doc.description}
              </p>
            ) : null}

            {/* Pack size chip — single informational chip (snacks are sold
                as one pack per SKU; no derived sizes). */}
            {doc.weight ? (
              <div className="mt-6 border-t border-border-card pt-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                  {t("packSize")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="border border-gold bg-bg-accent px-4 py-2 font-display text-sm text-primary">
                    {doc.weight}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Retailer CTAs — snacks sell through external partners, so
                the "buy" affordance is the retailer link, not a cart. */}
            {retailers.length > 0 ? (
              <div className="mt-6 border-t border-border-card pt-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                  {t("buyAt")}
                </p>
                <ul className="mt-3 flex flex-wrap gap-3">
                  {retailers.map((r) => (
                    <li key={r.url}>
                      <RetailerLink label={r.label} url={r.url} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs italic text-text-muted">
                  {t("partnerNote")}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Spec strip */}
        <dl className="mt-10 grid gap-x-8 gap-y-6 border-b border-border-card pb-12 sm:grid-cols-2">
          {doc.weight ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("weight")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {doc.weight}
              </dd>
            </div>
          ) : null}
          {doc.category ? (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("category")}
              </dt>
              <dd className="mt-2 font-display text-lg capitalize text-text-heading">
                {doc.category}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      {productLdHtml ? (
        <InlineScript id="snack-jsonld" html={productLdHtml} />
      ) : null}
    </article>
  );
}
