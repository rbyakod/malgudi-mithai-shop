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

        {/* Header */}
        <div className="mt-10 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.55fr_0.45fr]">
          <div className="flex flex-col justify-end">
            {doc.category ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc.category}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {doc.name}
            </h1>
            {doc.msrp ? (
              <p className="mt-6 font-display text-2xl font-medium text-text-heading">
                {doc.msrp}
              </p>
            ) : null}
            {doc.description ? (
              <p className="mt-6 max-w-md text-sm leading-relaxed text-text-muted">
                {doc.description}
              </p>
            ) : null}
          </div>

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
        </div>

        {/* Spec + retailers strip */}
        <section className="mt-12 grid gap-10 lg:grid-cols-[0.6fr_0.4fr] lg:gap-16">
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {doc.weight ? (
              <div>
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

          {retailers.length > 0 ? (
            <aside className="border-l border-border-card pl-6 lg:pl-10">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {t("buyAt")}
              </h2>
              <ul className="mt-4 space-y-3">
                {retailers.map((r) => (
                  <li key={r.url}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 font-display text-base text-text-heading transition-colors hover:text-primary"
                    >
                      <span>{r.label}</span>
                      <span
                        aria-hidden="true"
                        className="text-[11px] uppercase tracking-[0.18em] text-gold opacity-70 transition-opacity group-hover:opacity-100"
                      >
                        &rarr;
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </section>
      </div>
    </article>
  );
}
