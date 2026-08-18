// app/[locale]/gifts/[slug]/page.tsx
// Gift box PDP — hero, price, compartments, the compatible-mithai rail,
// add-ons, packaging, and curated assortments. Batch 7's public surface for
// the previously admin-only `gift-boxes` collection.
//
// Slugless routing (snacks/qsr/merch precedent): `gift-boxes` has no slug
// field, so the URL is slugify(name) derived server-side. Payload runs
// without a `localization` config, so `name` is canonical and the derived
// slug is locale-stable.
//
// depth: 2 on the find — compatibleMithai / curatedAssortments[].items
// populate at depth 1, and their images[].image uploads resolve at depth 2.

import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {Link} from "@/i18n/navigation";
import {slugify} from "@/lib/slugify";
import {MediaCard} from "@/components/ui/MediaCard";
import {InlineScript} from "@/components/InlineScript";
import {productSchema} from "@/lib/seo/schema";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {firstDocImage} from "@/lib/verticals/catalogMedia";

export const revalidate = 60;

type Params = {locale: string; slug: string};
type Context = {params: Promise<Params>};

type MithaiDoc = {
  id: string | number;
  name?: string;
  slug?: string;
  displayPrice?: string | null;
  images?: Array<{image?: {url?: string}} | null> | null;
};

type GiftDoc = {
  id: string | number;
  name?: string;
  size?: string | null;
  compartmentLayout?: string | null;
  displayPrice?: string | null;
  excerpt?: string | null;
  images?: Array<{image?: {url?: string}} | null> | null;
  compatibleMithai?: MithaiDoc[] | null;
  packaging?: Array<{id: string | number; name?: string} | null> | null;
  addOns?: Array<{label?: string; type?: string} | null> | null;
  curatedAssortments?: Array<{
    label?: string;
    items?: MithaiDoc[] | null;
  } | null> | null;
};

async function findDoc(slug: string): Promise<GiftDoc | null> {
  const payload = await getPayload();
  let page = 1;
  let totalPages = 1;
  do {
    const r = await payload.find({
      collection: "gift-boxes",
      limit: 100,
      page,
      depth: 2,
    });
    const match = (r.docs as GiftDoc[]).find(
      (d) => d.name && slugify(d.name) === slug,
    );
    if (match) return match;
    totalPages = r.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return null;
}

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({collection: "gift-boxes", limit: 100});
  const slugs = (r.docs as GiftDoc[])
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
  const {slug} = await params;
  const doc = await findDoc(slug);
  if (!doc) return {};
  return {title: doc.name, description: doc.excerpt ?? undefined};
}

export default async function Page({params}: Context) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const doc = await findDoc(slug);
  if (!doc) notFound();

  const t = await getTranslations("Gifts");
  const tShared = await getTranslations("Pdp");

  const imageUrl = (doc.images ?? []).flatMap((row) =>
    row?.image?.url ? [row.image.url] : [],
  )[0];

  const compatible = (doc.compatibleMithai ?? []).filter(
    (m): m is MithaiDoc => !!m && !!m.name,
  );
  const addOns = (doc.addOns ?? []).filter(
    (a): a is {label: string; type?: string} => !!a && !!a.label,
  );
  const packaging = (doc.packaging ?? []).filter(
    (p): p is {id: string | number; name: string} => !!p && !!p.name,
  );
  const assortments = (doc.curatedAssortments ?? []).filter(
    (a): a is {label: string; items: MithaiDoc[]} =>
      !!a && !!a.label && !!a.items && a.items.length > 0,
  );

  // Product JSON-LD — emitted only when the display price parses to a real
  // number (the helper omits `offers` otherwise). `<` escaped per the
  // Next.js pattern.
  const productLd = productSchema({
    name: doc.name,
    description: doc.excerpt ?? undefined,
    displayPrice: doc.displayPrice ?? undefined,
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
          <Link href="/gifts" className="hover:text-primary">
            {t("title")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-text-muted">{doc.name}</span>
        </nav>

        {/* Header — buy column | image panel. Mirrors the snacks PDP: text
            leads on desktop (lg:order-first), image leads on mobile. */}
        <div className="mt-10 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.55fr_0.45fr]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={doc.name ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 28rem, 100vw"
                className="object-cover kb-drift"
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
            {doc.size ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc.size}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {doc.name}
            </h1>

            {/* Price block */}
            {doc.displayPrice ? (
              <div className="mt-6">
                <p className="font-display text-2xl font-medium text-text-heading">
                  <span data-testid="gift-price">{doc.displayPrice}</span>
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
                  {t("taxNote")}
                </p>
              </div>
            ) : null}

            {doc.excerpt ? (
              <p className="mt-6 max-w-md text-sm leading-relaxed text-text-muted">
                {doc.excerpt}
              </p>
            ) : null}

            {/* Builder CTA — gift boxes aren't cart-checkout-able yet; the
                builder + WhatsApp are the buy paths for now. */}
            <div className="mt-6 border-t border-border-card pt-6">
              <Link
                href="/build-a-gift"
                className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-text-light transition-colors hover:bg-primary-hover"
              >
                {t("buildCta")}
              </Link>
            </div>
          </div>
        </div>

        {/* Compartment layout copy */}
        {doc.compartmentLayout ? (
          <section className="mt-10 border-b border-border-card pb-12">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("inTheBox")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
              {doc.compartmentLayout}
            </p>
          </section>
        ) : null}

        {/* Add-ons + packaging — quiet chip rows */}
        {addOns.length > 0 || packaging.length > 0 ? (
          <section className="mt-10 grid gap-x-8 gap-y-8 border-b border-border-card pb-12 sm:grid-cols-2">
            {addOns.length > 0 ? (
              <div>
                <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                  {t("addOns")}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {addOns.map((a) => (
                    <li
                      key={a.label}
                      className="border border-border-input bg-bg-control px-3 py-1.5 text-xs text-text-secondary"
                    >
                      {a.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {packaging.length > 0 ? (
              <div>
                <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                  {t("packaging")}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {packaging.map((p) => (
                    <li
                      key={String(p.id)}
                      className="border border-border-input bg-bg-control px-3 py-1.5 text-xs text-text-secondary"
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Compatible mithai rail → /mithai/[slug] */}
        {compatible.length > 0 ? (
          <section className="mt-10 border-b border-border-card pb-12" data-testid="gift-mithai-rail">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("fillWith")}
            </h2>
            <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {compatible.map((m) => (
                <li key={String(m.id)}>
                  <MediaCard
                    title={m.name ?? "Untitled"}
                    href={pdpHref(m as Record<string, unknown>, "mithai-products")}
                    image={firstDocImage(m as Record<string, unknown>, "mithai-products")}
                    priceLabel={m.displayPrice ?? null}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Curated assortments — label + linked item chips */}
        {assortments.length > 0 ? (
          <section className="mt-10 border-b border-border-card pb-12">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("curated")}
            </h2>
            <div className="mt-6 space-y-6">
              {assortments.map((a) => (
                <div key={a.label}>
                  <p className="font-display text-lg text-text-heading">
                    {a.label}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {a.items
                      .filter((m) => !!m?.name)
                      .map((m) => (
                        <li key={String(m.id)}>
                          <Link
                            href={pdpHref(
                              m as Record<string, unknown>,
                              "mithai-products",
                            )}
                            className="border border-gold bg-bg-accent px-4 py-2 font-display text-sm text-primary transition-colors hover:border-primary"
                          >
                            {m.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {productLdHtml ? (
        <InlineScript id="gift-jsonld" html={productLdHtml} />
      ) : null}
    </article>
  );
}
