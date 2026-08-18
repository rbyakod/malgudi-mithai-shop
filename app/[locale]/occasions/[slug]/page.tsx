// app/[locale]/occasions/[slug]/page.tsx
// Occasion detail — hero image, localized copy, and the curated
// recommendedProducts rail (Batch 7). The rail is polymorphic
// (mithai-products | gift-boxes); each entry resolves its href per
// `relationTo` via lib/verticals/pdpHref.
//
// Slugless routing: URL is slugify(name). depth: 2 on the find —
// recommendedProducts populate at depth 1, their images[].image uploads at
// depth 2.

import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {Link} from "@/i18n/navigation";
import {slugify} from "@/lib/slugify";
import {MediaCard} from "@/components/ui/MediaCard";
import {pdpHref, type PdpCollectionSlug} from "@/lib/verticals/pdpHref";
import {firstDocImage} from "@/lib/verticals/catalogMedia";

export const revalidate = 60;

type Params = {locale: string; slug: string};
type Context = {params: Promise<Params>};

type RelatedDoc = {
  id: string | number;
  name?: string;
  slug?: string;
  displayPrice?: string | null;
  images?: Array<{image?: {url?: string}} | null> | null;
};

type OccasionDoc = {
  id: string | number;
  name?: string;
  copy?: string | null;
  image?: {url?: string} | null;
  recommendedProducts?: Array<{
    relationTo: PdpCollectionSlug;
    value: RelatedDoc | string;
  } | null> | null;
};

async function findDoc(slug: string): Promise<OccasionDoc | null> {
  const payload = await getPayload();
  const r = await payload.find({collection: "occasions", limit: 100, depth: 2});
  return (
    (r.docs as OccasionDoc[]).find(
      (d) => d.name && slugify(d.name) === slug,
    ) ?? null
  );
}

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({collection: "occasions", limit: 100});
  const slugs = (r.docs as OccasionDoc[])
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
  return {title: doc.name, description: doc.copy ?? undefined};
}

export default async function Page({params}: Context) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const doc = await findDoc(slug);
  if (!doc) notFound();

  const t = await getTranslations("Occasions");
  const tShared = await getTranslations("Pdp");

  const imageUrl =
    doc.image && typeof doc.image === "object" ? (doc.image.url ?? null) : null;

  // The rail: polymorphic relationship values, filtered to populated docs
  // (an unpopulated value stays a bare id string and is skipped).
  const rail = (doc.recommendedProducts ?? []).flatMap((entry) => {
    if (!entry || typeof entry.value === "string") return [];
    const value = entry.value;
    if (!value.name) return [];
    return [
      {
        collection: entry.relationTo as PdpCollectionSlug,
        doc: value as Record<string, unknown>,
        name: value.name,
        href: pdpHref(value as Record<string, unknown>, entry.relationTo),
        image: firstDocImage(value as Record<string, unknown>, entry.relationTo),
        priceLabel: value.displayPrice ?? null,
      },
    ];
  });

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
          <Link href="/occasions" className="hover:text-primary">
            {t("title")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-text-muted">{doc.name}</span>
        </nav>

        {/* Hero — image panel | copy column (mirrors the gifts PDP) */}
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
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {doc.name}
            </h1>
            {doc.copy ? (
              <p className="mt-6 max-w-md text-sm leading-relaxed text-text-muted">
                {doc.copy}
              </p>
            ) : null}
          </div>
        </div>

        {/* Recommended products rail — href per relationTo */}
        {rail.length > 0 ? (
          <section
            className="mt-10 border-b border-border-card pb-12"
            data-testid="occasion-recommended-rail"
          >
            <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
              {t("recommended")}
            </h2>
            <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {rail.map((entry) => (
                <li key={`${entry.collection}-${String(entry.doc.id)}`}>
                  <MediaCard
                    title={entry.name}
                    href={entry.href}
                    image={entry.image}
                    priceLabel={entry.priceLabel}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Cross-link into the gifting vertical */}
        <div className="mt-10">
          <Link
            href="/gifts"
            className="inline-flex rounded-full border border-border-input bg-bg-control px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            {t("browseGifts")}
          </Link>
        </div>
      </div>
    </article>
  );
}
