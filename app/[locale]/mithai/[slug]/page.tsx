// app/[locale]/mithai/[slug]/page.tsx
// Mithai PDP route. Server component — delegates the body to <MithaiPDP/>.
// Owns the SEO + static-param concerns; the component owns the layout.
//
// ISR: revalidate every 60s. Mithai docs change rarely (price copy,
// allergen tweaks) but we want stock/availability edits to surface within
// a minute without a full rebuild.

import type {Metadata} from "next";
import {getPayload} from "@/lib/payload-client";
import {MithaiPDP} from "@/components/mithai/MithaiPDP";

export const revalidate = 60;

type Params = {locale: string; slug: string};

type Context = {params: Promise<Params>};

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
  return <MithaiPDP slug={slug} locale={locale} />;
}
