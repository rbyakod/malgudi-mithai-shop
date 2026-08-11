// app/[locale]/qsr/[slug]/page.tsx
// QSR menu item PDP. Simpler than mithai — name, image, description,
// category, spice, veg, store availability. No add-to-cart (QSR is
// walk-in/quick-serve; cart is mithai-only for v1).
//
// `qsr-menu-items` has no `slug` field (Task 7 schema). The route param is
// a slugified version of the doc `name`; we fetch the small menu list and
// match by slugify(name). Clean URLs without a schema migration — fine
// for v1 PDPs; if the menu grows beyond ~100 items, promote to a real
// `slug` field then.

import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {slugify} from "@/lib/slugify";

export const revalidate = 60;

type Params = {locale: string; slug: string};
type Context = {params: Promise<Params>};

type QsrDoc = {
  id: string | number;
  name?: string;
  category?: string;
  description?: string;
  image?: {url?: string} | null;
  veg?: boolean | null;
  spiceLevel?: string | null;
  availableAtStores?: string[] | null;
};

async function findDoc(slug: string, locale: string): Promise<QsrDoc | null> {
  const payload = await getPayload();
  const r = await payload.find({
    collection: "qsr-menu-items",
    limit: 100,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });
  const docs = r.docs as QsrDoc[];
  return docs.find((d) => d.name && slugify(d.name) === slug) ?? null;
}

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({collection: "qsr-menu-items", limit: 100});
  return (r.docs as QsrDoc[])
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

  const t = await getTranslations("Pdp.qsr");
  const tNav = await getTranslations("Nav");
  const tShared = await getTranslations("Pdp");

  const imageUrl = doc.image?.url ?? null;

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
          <Link href="/qsr" className="hover:text-primary">
            {tNav("qsr")}
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

        {/* Spec strip */}
        <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {doc.veg !== null && doc.veg !== undefined ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("veg")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {doc.veg ? "Yes" : "No"}
              </dd>
            </div>
          ) : null}
          {doc.spiceLevel ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("spiceLevel")}
              </dt>
              <dd className="mt-2 font-display text-lg capitalize text-text-heading">
                {doc.spiceLevel}
              </dd>
            </div>
          ) : null}
          {doc.availableAtStores && doc.availableAtStores.length > 0 ? (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("available")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {doc.availableAtStores.join(", ")}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  );
}
