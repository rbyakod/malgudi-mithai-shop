// components/mithai/CrossSellRail.tsx
// Same-family cross-sell rail for the mithai PDP (Batch 8), rendered under
// the PDP story spread.
//
// Server component — fetches the doc's family siblings itself so
// <MithaiPDP> stays a single-doc render. Cards reuse <MediaCard>; hrefs
// come from lib/verticals/pdpHref (mithai case → /mithai/[slug]); the
// exclude-self / images-first / limit-4 selection lives in
// lib/verticals/crossSell (pure, unit-tested).
//
// Renders nothing when the family has no other cardable members.

import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {MediaCard} from "@/components/ui/MediaCard";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {fallbackDocImage, firstDocImage} from "@/lib/verticals/catalogMedia";
import {pickCrossSell, type CrossSellDoc} from "@/lib/verticals/crossSell";

type Props = {
  family: string | null | undefined;
  selfSlug: string;
  locale: string;
};

export async function CrossSellRail({family, selfSlug, locale}: Props) {
  if (!family) return null;

  // Featured first so best-seller siblings lead when flagged; the pure
  // picker then re-orders docs with uploaded media ahead of fallbacks.
  const payload = await getPayload();
  const r = await payload.find({
    collection: "mithai-products",
    where: {
      and: [{family: {equals: family}}, {slug: {not_equals: selfSlug}}],
    },
    limit: 12,
    sort: "-featured",
    depth: 1,
    locale: locale as "en" | "hi" | "kn" | undefined,
  });

  const picks = pickCrossSell(r.docs as CrossSellDoc[], selfSlug, 4);
  if (picks.length === 0) return null;

  const t = await getTranslations("Pdp.mithai.crossSell");
  const tFamily = await getTranslations("MithaiHub.family");
  const heading = t("title", {family: tFamily(family as never)});

  return (
    <section
      className="mt-16 border-t border-border-card pt-10"
      data-testid="pdp-cross-sell-rail"
    >
      <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
        {heading}
      </h2>
      <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((doc) => (
          <li key={String(doc.id)}>
            <MediaCard
              title={doc.name ?? "Untitled"}
              href={pdpHref(doc as Record<string, unknown>, "mithai-products")}
              image={
                firstDocImage(doc as Record<string, unknown>, "mithai-products") ??
                fallbackDocImage(doc as Record<string, unknown>, "mithai")
              }
              priceLabel={doc.displayPrice ?? null}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CrossSellRail;
