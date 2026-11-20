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
  const itemCount = docs.length;
  const itemCountLabel = t("itemCount", {count: itemCount});

  const [featured, ...rest] = docs;

  return (
    <section aria-labelledby="stories-pillar-heading" className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
        {/* Header */}
        {/* Header: the design system's SectionHead (the old numeral ornament is gone: the system's
            only ornaments are the lockup's dot and the antique-gold hairline). */}
        <header className="ms-head ms-hub-head">
          <p className="ms-label ms-muted">
            {t("eyebrow")} · {itemCountLabel}
          </p>
          <h1 id="stories-pillar-heading" className="ms-headline">
            {pillarLabel}
          </h1>
          <p className="ms-lead">{t("intro")}</p>
        </header>

        {/* Body — or empty state */}
        {itemCount === 0 ? (
          <p className="ms-body ms-muted mt-16">
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
