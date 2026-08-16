// app/[locale]/occasions/page.tsx
// Occasions hub — the public face of the `occasions` collection (Batch 7).
// Diwali, weddings, Rakhi…: each occasion doc carries a hero image and a
// curated recommended-products rail on its detail page.
//
// Slugless routing (gifts/snacks precedent): the URL is slugify(name).

import type {Metadata} from "next";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {MediaCard} from "@/components/ui/MediaCard";
import {pdpHref} from "@/lib/verticals/pdpHref";

export const revalidate = 60;

type OccasionDoc = {
  id: string | number;
  name?: string;
  image?: {url?: string} | null;
};

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Occasions");
  return {title: t("title"), description: t("blurb")};
}

export default async function OccasionsHub({params}: Props) {
  await params;
  const t = await getTranslations("Occasions");

  let docs: OccasionDoc[] = [];
  try {
    const payload = await getPayload();
    const r = await payload.find({collection: "occasions", limit: 100});
    docs = r.docs as OccasionDoc[];
  } catch {
    docs = [];
  }

  return (
    <section aria-labelledby="occasions-hub-heading" className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
        {/* Header — left rail + blurb column (mirrors VerticalHub) */}
        <div className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("itemCount", {count: docs.length})}
            </p>
            <h1
              id="occasions-hub-heading"
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
            data-testid="occasions-grid"
          >
            {docs.map((doc) => (
              <li key={String(doc.id)}>
                <MediaCard
                  title={doc.name ?? "Untitled"}
                  href={pdpHref(doc as Record<string, unknown>, "occasions")}
                  image={
                    doc.image && typeof doc.image === "object"
                      ? (doc.image.url ?? null)
                      : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
