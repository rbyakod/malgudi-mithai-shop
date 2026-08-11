// app/[locale]/stories/[pillar]/page.tsx
// Pillar-filtered stories listing. Mirrors the /stories hub but constrained
// to a single pillar. The URL uses the public-facing slug spelling from
// Pillars.tsx (farms / karigars / karigari / journal); we map it to the
// internal Payload select value (farm / karigar / karigari / journal) before
// querying.
//
// Design intent — reuses the Stories hub's editorial header + featured/row
// layout so the pillar page feels like a section of the magazine, not a
// generic filter result.

import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {StoryCard} from "@/components/stories/StoryCard";
import {notFound} from "next/navigation";

// Public URL slug → Payload `pillar` select value. The four entries here
// mirror the links in components/home/Pillars.tsx. We accept all storage
// pillar values too (since they're valid) so future internal links can use
// the canonical spelling without an extra mapping.
const PILLAR_BY_SLUG: Record<string, string> = {
  farms: "farm",
  farm: "farm",
  milk: "milk",
  karigars: "karigar",
  karigar: "karigar",
  karigari: "karigari",
  packaging: "packaging",
  festival: "festival",
  regional: "regional",
  recipe: "recipe",
  journal: "journal",
};

const PILLAR_NUMERAL: Record<string, string> = {
  farm: "I",
  milk: "I",
  karigar: "II",
  karigari: "III",
  packaging: "IV",
  festival: "V",
  regional: "VI",
  recipe: "VII",
  journal: "VIII",
};

type StoryDoc = {
  id: string | number;
  title?: string;
  slug?: string;
  pillar?: string | null;
  excerpt?: string | null;
  heroImage?: {url?: string} | null;
  publishedAt?: string | null;
};

type Props = {
  params: Promise<{locale: string; pillar: string}>;
};

export const revalidate = 60;

export function generateStaticParams() {
  // Pre-render the four public slugs the home page links to. Other pillar
  // slugs are accepted at request time but not statically prerendered.
  return [
    {pillar: "farms"},
    {pillar: "karigars"},
    {pillar: "karigari"},
    {pillar: "journal"},
  ];
}

export default async function StoriesByPillar({params}: Props) {
  const {locale, pillar} = await params;
  const storagePillar = PILLAR_BY_SLUG[pillar];
  if (!storagePillar) notFound();

  const t = await getTranslations("Stories");

  let docs: StoryDoc[] = [];
  try {
    const payload = await getPayload();
    const r = await payload.find({
      collection: "stories",
      where: {
        and: [
          {_status: {equals: "published"}},
          {pillar: {equals: storagePillar}},
        ],
      },
      sort: "-publishedAt",
      limit: 60,
      locale: locale as "en" | "hi" | "kn" | undefined,
      depth: 1,
    });
    docs = r.docs as StoryDoc[];
  } catch {
    docs = [];
  }

  const pillarLabel = t(`pillars.${storagePillar}` as const);
  const numeral = PILLAR_NUMERAL[storagePillar] ?? "·";
  const itemCount = docs.length;
  const itemCountLabel = t("itemCount", {count: itemCount});

  const [featured, ...rest] = docs;

  return (
    <section aria-labelledby="stories-pillar-heading" className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
        {/* Header */}
        <div className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("eyebrow")} · {itemCountLabel}
            </p>
            {/* Pillar masthead — numeral + label */}
            <div className="mt-3 flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className="font-display text-3xl font-light italic text-gold"
              >
                {numeral}
              </span>
              <span className="h-px w-10 bg-gold/40" />
              <h1
                id="stories-pillar-heading"
                className="font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
              >
                {pillarLabel}
              </h1>
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            {t("intro")}
          </p>
        </div>

        {/* Body — or empty state */}
        {itemCount === 0 ? (
          <p className="mt-16 max-w-md text-sm italic leading-relaxed text-text-muted">
            {t("empty")}
          </p>
        ) : (
          <div className="mt-12 space-y-10">
            {featured ? (
              <StoryCard
                variant="featured"
                title={featured.title ?? "Untitled"}
                href={`/stories/${featured.slug ?? ""}`}
                excerpt={featured.excerpt}
                pillarLabel={pillarLabel}
                image={featured.heroImage?.url ?? null}
                publishedLabel={t("readMore")}
              />
            ) : null}

            {rest.length > 0 ? (
              <ul className="grid gap-x-10 sm:grid-cols-2">
                {rest.map((d) => (
                  <li key={String(d.id)}>
                    <StoryCard
                      variant="row"
                      title={d.title ?? "Untitled"}
                      href={`/stories/${d.slug ?? ""}`}
                      excerpt={d.excerpt}
                      pillarLabel={pillarLabel}
                      image={d.heroImage?.url ?? null}
                      publishedLabel={formatDate(d.publishedAt, locale)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </section>
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
