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
import {MediaCard} from "@/components/ui/MediaCard";

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
    const img = doc.image as {url?: string} | null | undefined;
    return img?.url ?? null;
  }
  const images = doc.images as Array<{image?: {url?: string}} | null> | null;
  const url = images?.[0]?.image?.url;
  return url ?? null;
}

export async function VerticalHub({collection, vertical}: Props) {
  const t = await getTranslations(`Verticals.${vertical}`);
  const tShared = await getTranslations("Verticals");
  const title = t("title");
  const blurb = t("blurb");

  // Read up to 24 docs. Failures (DB down, collection gone) degrade to an
  // empty state — the hub still renders its chrome.
  let docs: Array<Record<string, unknown>> = [];
  try {
    const payload = await getPayload();
    const r = await payload.find({collection, limit: 24});
    docs = r.docs as Array<Record<string, unknown>>;
  } catch {
    docs = [];
  }

  const tagField = TAG_FIELD[collection];
  const itemCount = docs.length;
  const itemCountLabel = tShared("itemCount", {count: itemCount});

  return (
    <section aria-labelledby="vertical-hub-heading" className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 lg:px-3">
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

        {/* Grid — or empty state */}
        {itemCount === 0 ? (
          <p className="mt-16 max-w-md text-sm italic leading-relaxed text-text-muted">
            {tShared("empty")}
          </p>
        ) : (
          <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => {
              const name =
                (doc.name as string | undefined) ??
                (doc.title as string | undefined) ??
                "Untitled";
              const tag = (doc[tagField] as string | null | undefined) ?? null;
              return (
                <li key={String(doc.id ?? name)}>
                  <MediaCard
                    title={name}
                    href={pdpHref(doc, collection)}
                    image={firstImage(doc, collection)}
                    tag={tag}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export default VerticalHub;
