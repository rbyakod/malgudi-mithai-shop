// app/[locale]/mithai/[slug]/page.tsx
// Mithai PDP route. Server component — delegates the body to <MithaiPDP/>.
// Owns the SEO + static-param concerns; the component owns the layout.
//
// Also owns the JSON-LD <script> for schema.org Product + BreadcrumbList.
// The schema is built from the same Payload doc the body renders; this
// duplicates one `find()` call but is cheap (ISR-cached at 60s) and keeps
// the SEO concern co-located with metadata rather than threading doc
// through the component tree.
//
// ISR: revalidate every 60s. Mithai docs change rarely (price copy,
// allergen tweaks) but we want stock/availability edits to surface within
// a minute without a full rebuild.

import type {Metadata} from "next";
import {getPayload} from "@/lib/payload-client";
import {MithaiPDP} from "@/components/mithai/MithaiPDP";
import {ProductViewed} from "@/components/mithai/ProductViewed";
import {InlineScript} from "@/components/InlineScript";
import {productSchema, breadcrumbSchema} from "@/lib/seo/schema";

export const revalidate = 60;

type Params = {locale: string; slug: string};

type Context = {params: Promise<Params>};

type Doc = {
  name?: string;
  slug?: string;
  ingredients?: string;
  images?: Array<{image?: {url?: string; alt?: string}} | null>;
  displayPrice?: string;
};

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({collection: "mithai-products", limit: 100});
  return r.docs.map((d) => ({slug: String((d as {slug?: string}).slug)}));
}

export async function generateMetadata({
  params,
}: Context): Promise<Metadata> {
  const {locale, slug} = await params;
  const payload = await getPayload();
  const r = await payload.find({
    collection: "mithai-products",
    where: {slug: {equals: slug}},
    limit: 1,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });
  const doc = r.docs[0] as
    | {name?: string; ingredients?: string}
    | undefined;
  if (!doc) return {};
  return {title: doc.name, description: doc.ingredients};
}

export default async function Page({params}: Context) {
  const {slug, locale} = await params;

  // Fetch doc for JSON-LD. Best-effort — if the lookup fails the page still
  // renders via <MithaiPDP> (which 404s on missing doc itself).
  const payload = await getPayload();
  const r = await payload.find({
    collection: "mithai-products",
    where: {slug: {equals: slug}},
    limit: 1,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });
  const doc = r.docs[0] as Doc | undefined;

  const jsonLd =
    doc && doc.name
      ? [
          // Product — name/brand/image/offers. See lib/seo/schema.ts.
          productSchema(doc),
          // Breadcrumb: Home → Mithai → <name>.
          breadcrumbSchema([
            {name: "Home", url: `/${locale}`},
            {name: "Mithai", url: `/${locale}/mithai`},
            {name: doc.name ?? "Product", url: `/${locale}/mithai/${slug}`},
          ]),
        ]
      : null;

  // Escape `<` to prevent `</script>` breakouts inside JSON string values.
  // `JSON.stringify` does not escape `<` by default; an admin-authored
  // description like "</script><script>alert(1)</script>" would otherwise
  // escape the inline script context. This is the documented Next.js
  // defensive pattern.
  const jsonLdHtml = jsonLd
    ? jsonLd.map((s) => JSON.stringify(s).replace(/</g, "\\u003c")).join(",")
    : null;

  return (
    <>
      <MithaiPDP slug={slug} locale={locale} />
      <ProductViewed id={slug} name={doc?.name ?? slug} />
      {jsonLdHtml ? (
        <InlineScript id="mithai-jsonld" html={jsonLdHtml} />
      ) : null}
    </>
  );
}
