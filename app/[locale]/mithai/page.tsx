// app/[locale]/mithai/page.tsx
// Mithai vertical hub — lists docs from the `mithai-products` collection.
//
// Batch 6: the fetch moved out of <VerticalHub/> into this page so the hub
// body can be the <MithaiHubClient/> search island (server-backed search,
// family chips, freshness select, URL-synced state) while the masthead and
// the doc→card mapping stay server-side. The other verticals still render
// through the shared <VerticalHub/>.

import {Suspense} from "react";
import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {MithaiHubClient} from "@/components/verticals/MithaiHubClient";
import type {CatalogItem} from "@/components/verticals/CatalogBrowser";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {fallbackDocImage, firstDocImage} from "@/lib/verticals/catalogMedia";
import {isFullWidthLayout} from "@/lib/storefront-layout";
import {readStorefrontLayoutMode} from "@/lib/storefront-layout-server";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  // Touch params so Next.js treats the page as dynamic per locale.
  await params;
  const t = await getTranslations("Verticals.mithai");
  const tShared = await getTranslations("Verticals");
  const [layoutMode] = await Promise.all([readStorefrontLayoutMode()]);
  const isFullWidth = isFullWidthLayout(layoutMode);

  // Read the full collection in batches so storefront pagination does not
  // silently hide products once a catalog grows past 100 records.
  let docs: Array<Record<string, unknown>> = [];
  try {
    const payload = await getPayload();
    let page = 1;
    let totalPages = 1;
    do {
      const r = await payload.find({collection: "mithai-products", limit: 100, page});
      docs = docs.concat(r.docs as Array<Record<string, unknown>>);
      totalPages = r.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
  } catch {
    docs = [];
  }

  // Image-bearing entries first — keeps the grid anchored by photography
  // while some seeded docs still lack artwork. Stable sort, so within each
  // group the collection's natural order (newest-first) is preserved.
  docs = [...docs].sort(
    (a, b) =>
      Number(
        Boolean(firstDocImage(b, "mithai-products") ?? fallbackDocImage(b, "mithai")),
      ) -
      Number(
        Boolean(firstDocImage(a, "mithai-products") ?? fallbackDocImage(a, "mithai")),
      ),
  );

  const items: CatalogItem[] = docs.map((doc) => {
    const name = (doc.name as string | undefined) ?? "Untitled";
    return {
      id: String(doc.id ?? name),
      title: name,
      href: pdpHref(doc, "mithai-products"),
      image:
        firstDocImage(doc, "mithai-products") ?? fallbackDocImage(doc, "mithai"),
      tag: (doc.family as string | null | undefined) ?? null,
      priceLabel: (doc.displayPrice as string | undefined) ?? "",
      description: (doc.ingredients as string | undefined) ?? "",
      freshness: (doc.freshnessStatus as string | undefined) ?? "",
      dietaryTags: (doc.dietaryTags as string[] | null | undefined) ?? [],
    };
  });

  return (
    <section aria-labelledby="mithai-hub-heading" className="pb-20 pt-10">
      <div
        className={[
          "mx-auto px-1 sm:px-2 lg:px-3",
          isFullWidth ? "max-w-none" : "max-w-6xl",
        ].join(" ")}
      >
        {/* Header — left rail + blurb column (mirrors VerticalHub) */}
        <div className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {tShared("itemCount", {count: items.length})}
            </p>
            <h1
              id="mithai-hub-heading"
              className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
            >
              {t("title")}
            </h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            {t("blurb")}
          </p>
        </div>

        {/* useSearchParams needs a Suspense boundary on the client island. */}
        <Suspense>
          <MithaiHubClient
            items={items}
            emptyLabel={tShared("empty")}
            layoutMode={layoutMode}
          />
        </Suspense>
      </div>
    </section>
  );
}
