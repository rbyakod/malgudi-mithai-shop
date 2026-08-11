// components/stories/PillarListing.tsx
// Shared server component for pillar-filtered stories listings. Each of the
// four static routes under app/[locale]/stories/(pillar)/{farms,karigars,
// karigari,journal} renders this component with its storage pillar value.
//
// Why a shared component (not a single dynamic [pillar] route): Next.js
// disallows two dynamic segments at the same path level, so [pillar] would
// collide with the existing [slug] route. Static routes side-step that and
// also let us pre-render each pillar at build time.

import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {StoryCard} from "@/components/stories/StoryCard";

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

export type PillarListingProps = {
  locale: string;
  /** Payload storage pillar value, e.g. "farm" / "karigar". */
  storagePillar: string;
};

export async function PillarListing({locale, storagePillar}: PillarListingProps) {
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
