// app/[locale]/stories/[slug]/page.tsx
// Story detail route. Server component.
//
// Owns the SEO + static-param concerns; the layout lives in StoryHero +
// the @payloadcms/richtext-lexical/react <RichText/> renderer.
//
// ISR: revalidate every 60s — stories change rarely but publishedAt edits
// and new drafts going live should surface within a minute.

import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {RichText} from "@payloadcms/richtext-lexical/react";
import type {SerializedEditorState} from "lexical";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {StoryHero} from "@/components/stories/StoryHero";

export const revalidate = 60;

type Params = {locale: string; slug: string};
type Context = {params: Promise<Params>};

type StoryDoc = {
  id: string | number;
  title?: string;
  slug?: string;
  pillar?: string | null;
  excerpt?: string | null;
  body?: SerializedEditorState | null;
  heroImage?: {url?: string} | null;
  publishedAt?: string | null;
};

export async function generateStaticParams() {
  const payload = await getPayload();
  const r = await payload.find({
    collection: "stories",
    where: {_status: {equals: "published"}},
    limit: 100,
  });
  return r.docs
    .map((d) => ({slug: String((d as {slug?: string}).slug ?? "")}))
    .filter((p) => p.slug.length > 0);
}

export async function generateMetadata({
  params,
}: Context): Promise<Metadata> {
  const {locale, slug} = await params;
  const payload = await getPayload();
  const r = await payload.find({
    collection: "stories",
    where: {slug: {equals: slug}},
    limit: 1,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });
  const doc = r.docs[0] as StoryDoc | undefined;
  if (!doc) return {};
  return {title: doc.title, description: doc.excerpt ?? undefined};
}

export default async function StoryPage({params}: Context) {
  const {locale, slug} = await params;
  const t = await getTranslations("Stories");

  const payload = await getPayload();
  const r = await payload.find({
    collection: "stories",
    where: {slug: {equals: slug}},
    limit: 1,
    locale: locale as "en" | "hi" | "kn" | undefined,
    depth: 1,
  });
  const doc = r.docs[0] as StoryDoc | undefined;
  if (!doc) notFound();

  const pillar = (doc.pillar ?? null) as string | null;
  const pillarLabel = pillar ? t(`pillars.${pillar}` as never) : null;
  const publishedLabel = formatDate(doc.publishedAt, locale);

  return (
    <article className="pb-24 pt-4">
      <div className="mx-auto max-w-4xl px-1 sm:px-2 lg:px-3">
        <StoryHero
          title={doc.title ?? "Untitled"}
          excerpt={doc.excerpt}
          pillarLabel={pillarLabel}
          image={doc.heroImage?.url ?? null}
          publishedLabel={publishedLabel}
          publishedPrefix={t("publishedOn")}
          breadcrumbHome="Mishran"
          hubLabel={t("title")}
        />

        {/* Body — lexical rich text */}
        {doc.body ? (
          <section className="prose-story mt-12">
            <RichText data={doc.body} />
          </section>
        ) : null}

        {/* Back to hub */}
        <div className="mt-16 border-t border-border-card pt-6">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-gold transition-opacity hover:opacity-80"
          >
            <span aria-hidden="true">&larr;</span>
            {t("backToHub")}
          </Link>
        </div>
      </div>
    </article>
  );
}

// ---- helpers ---------------------------------------------------------------

function formatDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function localeToBcp47(locale: string): string {
  switch (locale) {
    case "hi":
      return "hi-IN";
    case "kn":
      return "kn-IN";
    default:
      return "en-IN";
  }
}
