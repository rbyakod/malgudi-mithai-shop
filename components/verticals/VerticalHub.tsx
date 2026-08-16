// components/verticals/VerticalHub.tsx
// Shared vertical landing page — mithai, qsr, snacks, merch.
//
// Renders an editorial header (eyebrow + display-serif title + blurb + item
// count) and an asymmetric grid of MediaCards drawn from the corresponding
// Payload collection. Designed to read like a magazine department page,
// not a stock e-commerce catalogue:
//   - Header has a left rail (locale-aware eyebrow + title) and a blurb
//     column on the right, mirroring the home section rhythm.
//   - Grid is `sm:grid-cols-2 lg:grid-cols-3` but each card is borderless
//     and anchored by a top hairline + monogram fallback so the eye reads
//     it as a list of entries rather than identical product tiles.
//
// Server component. Reads Payload with try/catch so a missing DB or empty
// collection renders an empty "kitchen is quiet" state instead of a 500.

import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {CatalogBrowser, type CatalogItem} from "@/components/verticals/CatalogBrowser";
import {isFullWidthLayout} from "@/lib/storefront-layout";
import {
  readCatalogPageSize,
  readStorefrontLayoutMode,
} from "@/lib/storefront-layout-server";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {
  fallbackDocImage,
  firstDocImage,
  type VerticalMediaKey,
} from "@/lib/verticals/catalogMedia";

type CollectionSlug =
  | "mithai-products"
  | "qsr-menu-items"
  | "snack-products"
  | "merch-products";

type VerticalKey = VerticalMediaKey;

type Props = {
  collection: CollectionSlug;
  vertical: VerticalKey;
};

// Discriminator field used as the card eyebrow tag. Each collection has a
// different name for it (see collections/*.ts).
const TAG_FIELD: Record<CollectionSlug, string> = {
  "mithai-products": "family",
  "qsr-menu-items": "category",
  "snack-products": "category",
  "merch-products": "type",
};

// PDP hrefs live in lib/verticals/pdpHref.ts; card media extraction and
// static artwork fallbacks in lib/verticals/catalogMedia.ts (shared with the
// /mithai search hub and the gifts/occasions surfaces).

export async function VerticalHub({collection, vertical}: Props) {
  const t = await getTranslations(`Verticals.${vertical}`);
  const tShared = await getTranslations("Verticals");
  const title = t("title");
  const blurb = t("blurb");
  const [layoutMode, catalogPageSize] = await Promise.all([
    readStorefrontLayoutMode(),
    readCatalogPageSize(),
  ]);
  const isFullWidth = isFullWidthLayout(layoutMode);

  // Read the full collection in batches so storefront pagination does not
  // silently hide products once a catalog grows past 100 records.
  let docs: Array<Record<string, unknown>> = [];
  try {
    const payload = await getPayload();
    let page = 1;
    let totalPages = 1;
    do {
      const r = await payload.find({collection, limit: 100, page});
      docs = docs.concat(r.docs as Array<Record<string, unknown>>);
      totalPages = r.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
  } catch {
    docs = [];
  }

  const tagField = TAG_FIELD[collection];
  const itemCount = docs.length;
  const itemCountLabel = tShared("itemCount", {count: itemCount});

  // Image-bearing entries first — keeps the grid anchored by photography
  // while some seeded docs still lack artwork. Stable, so within each group
  // the collection's natural order (newest-first) is preserved.
  docs = [...docs].sort(
    (a, b) =>
      Number(
        Boolean(firstDocImage(b, collection) ?? fallbackDocImage(b, vertical)),
      ) -
      Number(
        Boolean(firstDocImage(a, collection) ?? fallbackDocImage(a, vertical)),
      ),
  );

  const items: CatalogItem[] = docs.map((doc) => {
    const name =
      (doc.name as string | undefined) ??
      (doc.title as string | undefined) ??
      "Untitled";
    const priceLabel =
      (doc.displayPrice as string | undefined) ??
      (doc.msrp as string | undefined) ??
      (doc.price as string | undefined) ??
      "";
    const description =
      (doc.description as string | undefined) ??
      (doc.ingredients as string | undefined) ??
      "";
    const freshness =
      (doc.freshnessStatus as string | undefined) ??
      (doc.leadTime as string | undefined) ??
      (doc.availability as string | undefined) ??
      "";
    return {
      id: String(doc.id ?? name),
      title: name,
      href: pdpHref(doc, collection),
      image: firstDocImage(doc, collection) ?? fallbackDocImage(doc, vertical),
      tag: (doc[tagField] as string | null | undefined) ?? null,
      priceLabel,
      description,
      freshness,
      dietaryTags: (doc.dietaryTags as string[] | null | undefined) ?? [],
    };
  });

  return (
    <section aria-labelledby="vertical-hub-heading" className="pb-20 pt-10">
      <div className={["mx-auto px-1 sm:px-2 lg:px-3", isFullWidth ? "max-w-none" : "max-w-6xl"].join(" ")}>
        {/* Header — left rail + blurb column */}
        <div className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {itemCountLabel}
            </p>
            <h1
              id="vertical-hub-heading"
              className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
            >
              {title}
            </h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            {blurb}
          </p>
        </div>

        <CatalogBrowser
          items={items}
          emptyLabel={tShared("empty")}
          layoutMode={layoutMode}
          pageSize={catalogPageSize}
        />
      </div>
    </section>
  );
}

export default VerticalHub;
