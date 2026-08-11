// app/[locale]/merch/[slug]/page.tsx
// Merchandise PDP. Tools / books / experiences. Most merch is enquiry-only
// (lead-gen, not direct checkout) per the collection default.
//
// CTA: enquiry-only docs surface a disabled "Enquiries open soon" button for
// now — the real `/merch/[slug]/enquire` route + LeadForm modal is Task 17.
// When Task 17 lands, swap the disabled button for a Link to the enquire
// route (or wire the modal). The brief allows either; we chose defer.
//
// Same slugless-collection approach as QSR/Snacks (slugify(name) === :slug).

import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

export const revalidate = 60;

type Params = {locale: string; slug: string};
type Context = {params: Promise<Params>};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type MerchDoc = {
  id: string | number;
  name?: string;
  type?: string;
  description?: string;
  price?: string;
  availability?: string | null;
  images?: Array<{image?: {url?: string}} | null> | null;
};

async function findDoc(
  slug: string,
  locale: string,
): Promise<MerchDoc | null> {
  const payload = await getPayload();
  const r = await payload.find({
    collection: "merch-products",
    limit: 100,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });
  const docs = r.docs as MerchDoc[];
  return docs.find((d) => d.name && slugify(d.name) === slug) ?? null;
}

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({collection: "merch-products", limit: 100});
  return (r.docs as MerchDoc[])
    .map((d) => (d.name ? {slug: slugify(d.name)} : null))
    .filter((x): x is {slug: string} => x !== null);
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
  const doc = await findDoc(slug, locale);
  if (!doc) notFound();

  const t = await getTranslations("Pdp.merch");
  const tNav = await getTranslations("Nav");
  const tShared = await getTranslations("Pdp");

  const imageUrl = (doc.images ?? []).flatMap((row) =>
    row?.image?.url ? [row.image.url] : [],
  )[0];

  const enquiryOnly = doc.availability !== "in-stock";

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
          <Link href="/merch" className="hover:text-primary">
            {tNav("merch")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-text-muted">{doc.name}</span>
        </nav>

        {/* Header */}
        <div className="mt-10 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.55fr_0.45fr]">
          <div className="flex flex-col justify-end">
            {doc.type ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc.type}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {doc.name}
            </h1>
            {doc.price ? (
              <p className="mt-6 font-display text-2xl font-medium text-text-heading">
                {doc.price}
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

        {/* Availability + CTA */}
        <section className="mt-12 grid gap-10 lg:grid-cols-[0.6fr_0.4fr] lg:gap-16">
          <div>
            {doc.availability ? (
              <>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                  {t("availability")}
                </h2>
                <p className="mt-4 font-display text-xl capitalize text-text-heading">
                  {doc.availability.replace("-", " ")}
                </p>
              </>
            ) : null}
          </div>

          <aside className="border-l border-border-card pl-6 lg:pl-10">
            {enquiryOnly ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t("enquireDisabled")}
                className="inline-flex cursor-not-allowed items-center justify-center gap-3 border-y border-border-card px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.22em] text-text-muted opacity-70"
              >
                {t("enquireDisabled")}
              </button>
            ) : (
              <button
                type="button"
                className="group inline-flex items-center justify-center gap-3 border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.22em] text-primary transition-colors hover:bg-bg-accent hover:text-primary-hover"
              >
                {t("enquire")}
              </button>
            )}
          </aside>
        </section>
      </div>
    </article>
  );
}
