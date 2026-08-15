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
import {readStorefrontLayoutMode} from "@/lib/storefront-layout-server";

type CollectionSlug =
  | "mithai-products"
  | "qsr-menu-items"
  | "snack-products"
  | "merch-products";

type VerticalKey = "mithai" | "qsr" | "snacks" | "merch";

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

// Which vertical route segment each collection maps to.
const VERTICAL_PATH: Record<CollectionSlug, string> = {
  "mithai-products": "mithai",
  "qsr-menu-items": "qsr",
  "snack-products": "snacks",
  "merch-products": "merch",
};

const VERTICAL_FALLBACK_IMAGE: Record<VerticalKey, string | null> = {
  mithai: "/images/kaju-katli-box.jpg",
  qsr: "/images/gulab-jamun.jpg",
  snacks: "/images/besan-laddoo.jpg",
  merch: null,
};

const FALLBACK_IMAGE_BY_SLUG: Record<string, string> = {
  "assorted-box": "/images/assorted-box.jpg",
  "badam-barfi": "/images/badam-barfi.jpg",
  "badam-burfi": "/images/badam-barfi.jpg",
  "besan-laddoo": "/images/besan-laddoo.jpg",
  "besan-laddu": "/images/besan-laddoo.jpg",
  "gulab-jamun": "/images/gulab-jamun.jpg",
  "ista-roll": "/images/ista-roll.jpg",
  "kaju-katli": "/images/kaju-katli.jpg",
  "kaju-katli-box": "/images/kaju-katli-box.jpg",
  "mango-peda": "/images/mango-peda.jpg",
  "motichoor-laddoo": "/images/motichoor-laddoo.jpg",
  "motichur-laddoo": "/images/motichoor-laddoo.jpg",
  "rasgulla": "/images/rasgulla.jpg",
  "rasmalai": "/images/rasmalai.jpg",
  "sugarfree-kaju": "/images/sugarfree-kaju.jpg",
};

// Slugify a doc name for the URL — only used for the slugless collections
// (qsr / snacks / merch). Mithai has a real `slug` field and uses it as-is.
function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Build the PDP href for a doc. Mithai uses its real slug; the slugless
// collections derive the URL from slugify(name).
function pdpHref(
  doc: Record<string, unknown>,
  collection: CollectionSlug,
): string {
  const vertical = VERTICAL_PATH[collection];
  if (collection === "mithai-products") {
    const slug = doc.slug as string | undefined;
    return slug ? `/${vertical}/${slug}` : "#";
  }
  const name = (doc.name as string | undefined) ?? "";
  return name ? `/${vertical}/${slugifyName(name)}` : "#";
}

// Pull the first media URL out of a doc, handling both the array shape
// (mithai/snacks/merch: `images: [{image: {url}}]`) and the singular shape
// (qsr: `image: {url}`).
function firstImage(
  doc: Record<string, unknown>,
  collection: CollectionSlug,
): string | null {
  if (collection === "qsr-menu-items") {
    const img = doc.image;
    if (img && typeof img === "object" && "url" in img) {
      return (img as {url?: string}).url ?? null;
    }
    return null;
  }
  const images = doc.images as Array<{image?: unknown} | null> | null;
  const image = images?.[0]?.image;
  if (image && typeof image === "object" && "url" in image) {
    return (image as {url?: string}).url ?? null;
  }
  return null;
}

function fallbackImage(
  doc: Record<string, unknown>,
  vertical: VerticalKey,
): string | null {
  const name =
    (doc.slug as string | undefined) ??
    (doc.name as string | undefined) ??
    (doc.title as string | undefined) ??
    "";
  const slug = slugifyName(name);
  return FALLBACK_IMAGE_BY_SLUG[slug] ?? VERTICAL_FALLBACK_IMAGE[vertical];
}

export async function VerticalHub({collection, vertical}: Props) {
  const t = await getTranslations(`Verticals.${vertical}`);
  const tShared = await getTranslations("Verticals");
  const title = t("title");
  const blurb = t("blurb");
  const layoutMode = await readStorefrontLayoutMode();
  const isFullWidth = isFullWidthLayout(layoutMode);

  // Read up to 100 docs (the seeded mithai catalog alone is 91 — the old
  // limit of 24 hid two-thirds of it). Same ceiling the PDP lookup uses;
  // paginate properly if a collection outgrows it. Failures (DB down,
  // collection gone) degrade to an empty state — the hub still renders.
  let docs: Array<Record<string, unknown>> = [];
  try {
    const payload = await getPayload();
    const r = await payload.find({collection, limit: 100});
    docs = r.docs as Array<Record<string, unknown>>;
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
      Number(Boolean(firstImage(b, collection) ?? fallbackImage(b, vertical))) -
      Number(Boolean(firstImage(a, collection) ?? fallbackImage(a, vertical))),
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
      image: firstImage(doc, collection) ?? fallbackImage(doc, vertical),
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
        />
      </div>
    </section>
  );
}

export default VerticalHub;
