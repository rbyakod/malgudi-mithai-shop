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
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {Link} from "@/i18n/navigation";
import {slugify} from "@/lib/slugify";

export const revalidate = 60;

// Spice enum → translated label ("mild" | "medium" | "hot").
function spiceLabel(
  t: (key: string) => string,
  level: string,
): string {
  if (level === "mild") return t("spiceMild");
  if (level === "hot") return t("spiceHot");
  return t("spiceMedium");
}

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
  const slugs = (r.docs as QsrDoc[])
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

        {/* Header — info column | image panel (image leads on mobile,
            lg:order-first restores text-left / image-right on desktop).
            Mirrors the mithai PDP structure; QSR has no cart, so the buy
            slot holds the veg/spice badges and a counter-menu CTA. */}
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
            {doc.category ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                {doc.category}
              </p>
            ) : null}
            <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] tracking-tight text-text-heading sm:text-5xl">
              {doc.name}
            </h1>

            {/* Veg / spice badges — quiet uppercase microcopy row */}
            {doc.veg !== null && doc.veg !== undefined ? (
              <ul className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                <li className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-3 w-3 rounded-full border ${
                      doc.veg
                        ? "border-green-700 bg-green-600/20"
                        : "border-red-800 bg-red-700/20"
                    }`}
                  />
                  {doc.veg ? t("vegYes") : t("vegNo")}
                </li>
                {doc.spiceLevel ? (
                  <li aria-hidden="true" className="text-gold">
                    ·
                  </li>
                ) : null}
                {doc.spiceLevel ? <li>{spiceLabel(t, doc.spiceLevel)}</li> : null}
              </ul>
            ) : null}

            {doc.description ? (
              <p className="mt-6 max-w-md text-sm leading-relaxed text-text-muted">
                {doc.description}
              </p>
            ) : null}

            {/* Availability + counter-menu CTA — QSR is walk-in, so instead
                of a cart button, route to the counter listing. */}
            <div className="mt-6 border-t border-border-card pt-6">
              {doc.availableAtStores && doc.availableAtStores.length > 0 ? (
                <p className="text-sm leading-relaxed text-text-heading">
                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                    {t("available")}
                  </span>
                  <span className="ml-2 font-display text-base">
                    {doc.availableAtStores.join(" · ")}
                  </span>
                </p>
              ) : (
                <p className="text-xs italic text-text-muted">
                  {t("availabilityNote")}
                </p>
              )}
              <div className="mt-4">
                <Link
                  href="/qsr"
                  data-testid="counter-menu-cta"
                  className="inline-flex items-center gap-3 border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent"
                >
                  {t("counterMenu")}
                  <span aria-hidden="true" className="text-gold">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Spec strip */}
        <dl className="mt-10 grid gap-x-8 gap-y-6 border-b border-border-card pb-12 sm:grid-cols-3">
          {doc.veg !== null && doc.veg !== undefined ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("veg")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {doc.veg ? t("vegYes") : t("vegNo")}
              </dd>
            </div>
          ) : null}
          {doc.spiceLevel ? (
            <div className="sm:border-r sm:border-border-card sm:pr-8">
              <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                {t("spiceLevel")}
              </dt>
              <dd className="mt-2 font-display text-lg text-text-heading">
                {spiceLabel(t, doc.spiceLevel)}
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
