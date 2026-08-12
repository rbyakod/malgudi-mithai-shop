// app/[locale]/stories/page.tsx
// Stories hub — magazine-spread listing of all published stories, grouped
// by pillar.
//
// Design intent — this is a brand journal, not a 3-up blog grid:
//   - Editorial header (count eyebrow + display-serif title + intro blurb),
//     mirroring VerticalHub / BrandHero.
//   - Pillar sections render in editorial order with Roman-numeral anchors
//     (matching Pillars.tsx on the home page), each containing one featured
//     StoryCard (large image, long title) followed by hairline-divided row
//     entries for the rest. The reading rhythm is therefore:
//       pillar I — featured + rows
//       pillar II — featured + rows
//       …
//     not a flat grid.
//   - Empty state is a quiet italic note (matches Verticals.empty).
//
// Server component. Reads Payload with try/catch so a missing DB or empty
// collection degrades to the empty state instead of a 500.

import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {StoryCard} from "@/components/stories/StoryCard";

// Pillars rendered in this fixed editorial order. `farm` is first because
// the Jhajjar sample seeds into it and milk-first is the brand's lead
// promise. Storage values mirror the select options in collections/Stories.ts.
const PILLAR_ORDER = [
  "farm",
  "milk",
  "karigar",
  "karigari",
  "packaging",
  "festival",
  "regional",
  "recipe",
  "journal",
] as const;

type Pillar = (typeof PILLAR_ORDER)[number];

// Roman numerals keep the broadsheet feel (mirrors Pillars.tsx on home).
const PILLAR_NUMERAL: Record<Pillar, string> = {
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
  params: Promise<{locale: string}>;
};

export const revalidate = 60;

export default async function StoriesHub({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("Stories");

  let docs: StoryDoc[] = [];
  try {
    const payload = await getPayload();
    const r = await payload.find({
      collection: "stories",
      // Editorially-published only. Drafts stay off the hub.
      where: {_status: {equals: "published"}},
      sort: "-publishedAt",
      limit: 60,
      locale: locale as "en" | "hi" | "kn" | undefined,
      depth: 1,
    });
    docs = r.docs as StoryDoc[];
  } catch {
    docs = [];
  }

  // Group by pillar, preserving PILLAR_ORDER. Skip pillars with no docs so
  // the page never renders an empty pillar section.
  const byPillar = new Map<Pillar, StoryDoc[]>();
  for (const p of PILLAR_ORDER) byPillar.set(p, []);
  for (const d of docs) {
    const p = d.pillar as Pillar | undefined;
    if (p && byPillar.has(p)) byPillar.get(p)!.push(d);
  }
  const pillarsPresent = PILLAR_ORDER.filter((p) => (byPillar.get(p) ?? []).length > 0);
  const itemCount = docs.length;
  const itemCountLabel = t("itemCount", {count: itemCount});

  return (
    <section aria-labelledby="stories-hub-heading" className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
        {/* Header — left rail + blurb column (mirrors VerticalHub) */}
        <div className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("eyebrow")} · {itemCountLabel}
            </p>
            <h1
              id="stories-hub-heading"
              className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
            >
              {t("title")}
            </h1>
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
          <div className="mt-12 space-y-20">
            {pillarsPresent.map((p) => {
              const list = byPillar.get(p)!;
              const [featured, ...rest] = list;
              const pillarLabel = t(`pillars.${p}` as const);
              return (
                <section key={p} aria-labelledby={`pillar-${p}-heading`}>
                  {/* Pillar masthead — numeral + label */}
                  <div className="mb-8 flex items-baseline gap-3">
                    <span
                      aria-hidden="true"
                      className="font-display text-2xl font-light italic text-gold"
                    >
                      {PILLAR_NUMERAL[p]}
                    </span>
                    <span className="h-px w-10 bg-gold/40" />
                    <h2
                      id={`pillar-${p}-heading`}
                      className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary"
                    >
                      {pillarLabel}
                    </h2>
                  </div>

                  {/* Featured story (first of pillar) */}
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

                  {/* Remaining stories in this pillar — hairline rows */}
                  {rest.length > 0 ? (
                    <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
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
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ---- helpers ---------------------------------------------------------------

// Locale-aware date formatter. Kept tiny — Intl is enough; no dayjs dep.
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
