// app/[locale]/gifts/page.tsx
// Gifts hub — the public face of the `gift-boxes` collection (Batch 7).
// Hampers and keepsake boxes were previously admin-only data; this route
// surfaces them with price + blurb cards.
//
// Editorial header mirrors VerticalHub / the stories hub; the grid renders
// <MediaCard> with the price + excerpt lines so the gifting vertical reads
// like the rest of the storefront, not a bolt-on catalogue.

import type {Metadata} from "next";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {MediaCard} from "@/components/ui/MediaCard";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {firstDocImage} from "@/lib/verticals/catalogMedia";

export const revalidate = 60;

type GiftDoc = {
  id: string | number;
  name?: string;
  size?: string | null;
  displayPrice?: string | null;
  excerpt?: string | null;
  images?: Array<{image?: {url?: string}} | null> | null;
};

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Gifts");
  return {title: t("title"), description: t("blurb")};
}

async function fetchGifts(): Promise<GiftDoc[]> {
  try {
    const payload = await getPayload();
    let docs: GiftDoc[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const r = await payload.find({collection: "gift-boxes", limit: 100, page});
      docs = docs.concat(r.docs as GiftDoc[]);
      totalPages = r.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
    return docs;
  } catch {
    return [];
  }
}

export default async function GiftsHub({params}: Props) {
  await params;
  const t = await getTranslations("Gifts");
  const docs = await fetchGifts();

  return (
    <section aria-labelledby="gifts-hub-heading" className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
        {/* Header — left rail + blurb column (mirrors VerticalHub) */}
        <div className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("itemCount", {count: docs.length})}
            </p>
            <h1
              id="gifts-hub-heading"
              className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
            >
              {t("title")}
            </h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            {t("blurb")}
          </p>
        </div>

        {docs.length === 0 ? (
          <p className="mt-16 max-w-md text-sm italic leading-relaxed text-text-muted">
            {t("empty")}
          </p>
        ) : (
          <ul
            className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="gifts-grid"
          >
            {docs.map((doc) => (
              <li key={String(doc.id)}>
                <MediaCard
                  title={doc.name ?? "Untitled"}
                  href={pdpHref(doc as Record<string, unknown>, "gift-boxes")}
                  image={firstDocImage(doc as Record<string, unknown>, "gift-boxes")}
                  tag={doc.size ?? null}
                  priceLabel={doc.displayPrice ?? null}
                  blurb={doc.excerpt ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
