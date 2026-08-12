// lib/seo/schema.ts
// JSON-LD builders for schema.org structured data.
//
// Three builders are exposed:
//   - `productSchema(doc)` — Product, used on mithai/qsr/snacks/merch PDPs.
//   - `organizationSchema()` — static Organization, used on home / global.
//   - `breadcrumbSchema(trail)` — BreadcrumbList, used on every PDP.
//
// Each builder returns a plain object. Callers embed it via:
//   <script type="application/ld+json"
//     dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}}
//   />
//
// Design intent — keep schemas honest and minimal. Don't ship fields we
// cannot populate from the source doc (no fake reviews, no invented
// availability). Search engines penalise structured-data spam; an honest
// Product with name/image/description/offers is enough to qualify for rich
// results without risking a manual action.

type ImageField = {image?: {url?: string; alt?: string} | null} | null;

type ProductDoc = {
  name?: string;
  slug?: string;
  ingredients?: string;
  story?: unknown;
  displayPrice?: string;
  images?: ImageField[];
};

/** Site base URL, falling back to the local dev origin. */
function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Parse a display-only price string (e.g. "₹920 / 250g") into an INR number.
 * Returns null when no leading number is found. We do not invent currencies
 * or convert — the brand is INR-only at launch; multi-currency is a Phase 8
 * concern.
 */
function parseInrPrice(displayPrice: string | undefined): number | null {
  if (!displayPrice) return null;
  // Strip thousands separators first, then take the first integer run.
  const cleaned = displayPrice.replace(/[,]/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a schema.org Product. Image falls back to site logo when the doc
 * has no images so the structured data stays valid even on bare-bones docs
 * (the spec requires `image` for rich-result eligibility).
 */
export function productSchema(doc: ProductDoc): Record<string, unknown> {
  const imageRow = (doc.images ?? []).find((row) => row?.image?.url);
  const image = imageRow?.image?.url ?? `${siteUrl()}/icon.png`;
  const description = doc.ingredients ?? undefined;
  const price = parseInrPrice(doc.displayPrice);

  const offers =
    price !== null
      ? {
          "@type": "Offer",
          price: String(price),
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: doc.name ?? "Untitled",
    ...(description ? {description} : {}),
    image,
    brand: {"@type": "Brand", name: "Mishran"},
    ...(offers ? {offers} : {}),
  };
}

/**
 * Static schema.org Organization. Hardcoded to Mishran's brand defaults.
 * Wire to Payload `brand-settings` global later if copy/socials start
 * drifting; for launch, the static copy is stable and search-engine-friendly.
 */
export function organizationSchema(): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Mishran",
    url: base,
    logo: `${base}/icon.png`,
    sameAs: [
      "https://instagram.com/mishran",
      "https://facebook.com/mishran",
    ],
  };
}

type Crumb = {name: string; url: string};

/**
 * schema.org BreadcrumbList. Pass an ordered trail from root → leaf.
 * URLs may be absolute or relative; relative URLs are rooted at siteUrl.
 */
export function breadcrumbSchema(trail: Crumb[]): Record<string, unknown> {
  const base = siteUrl();
  const itemListElement = trail.map((c, i) => {
    const url = c.url.startsWith("http") ? c.url : `${base}${c.url}`;
    return {
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: url,
    };
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}
