// components/stories/RelatedProductsRail.tsx
// Renders Stories.relatedProducts on the story detail page (Batch 8).
//
// The field is polymorphic (mithai-products | gift-boxes | qsr-menu-items |
// snack-products | merch-products); populated entries arrive as
// {relationTo, value} and each card resolves its href per relationTo via
// lib/verticals/pdpHref — the same contract as the occasions rail.
// Unpopulated values (bare id strings) are skipped. Hidden entirely when
// nothing resolves.
//
// Server component; the story page fetches its doc at depth 2 so the
// relationship (depth 1) and the related docs' uploads (depth 2) populate.

import {getTranslations} from "next-intl/server";
import {MediaCard} from "@/components/ui/MediaCard";
import {pdpHref, type PdpCollectionSlug} from "@/lib/verticals/pdpHref";
import {firstDocImage} from "@/lib/verticals/catalogMedia";

type RelatedValue = {
  id: string | number;
  name?: string;
  slug?: string;
  displayPrice?: string | null;
  images?: Array<{image?: unknown} | null> | null;
};

/** One populated polymorphic relationship row, as Payload returns it. */
export type RelatedProductEntry = {
  relationTo: PdpCollectionSlug;
  value: RelatedValue | string;
};

type Props = {
  related: ReadonlyArray<RelatedProductEntry | null>;
};

export async function RelatedProductsRail({related}: Props) {
  const rail = related.flatMap((entry) => {
    if (!entry || typeof entry.value === "string") return [];
    const value = entry.value;
    if (!value.name) return [];
    return [
      {
        collection: entry.relationTo,
        id: String(value.id),
        name: value.name,
        href: pdpHref(value as Record<string, unknown>, entry.relationTo),
        image: firstDocImage(value as Record<string, unknown>, entry.relationTo),
        priceLabel: value.displayPrice ?? null,
      },
    ];
  });

  if (rail.length === 0) return null;

  const t = await getTranslations("Stories.related");

  return (
    <section
      className="mt-16 border-t border-border-card pt-10"
      data-testid="story-related-rail"
    >
      <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
        {t("title")}
      </h2>
      <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {rail.map((entry) => (
          <li key={`${entry.collection}-${entry.id}`}>
            <MediaCard
              title={entry.name}
              href={entry.href}
              image={entry.image}
              priceLabel={entry.priceLabel}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RelatedProductsRail;
