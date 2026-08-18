// components/reviews/ProductReviews.tsx
// Approved public reviews for one product — known-gaps campaign B10.
//
// Server component, self-fetching (CrossSellRail precedent) so <MithaiPDP>
// stays a single-doc render. Reads the reviews collection directly with
// the SAME filter the public GET /reviews route applies (status=approved,
// product, newest first) — display name is authorName, falling back to
// the customer's saved name via one batched lookup; ids/phones never
// render. Renders NOTHING when the product has no approved reviews (an
// empty "no reviews yet" block reads as social-proof debt, not honesty).
//
// Shows the average + total, then the first REVIEWS_SHOWN rows.

import {getPayload} from "@/lib/payload-client";
import {getTranslations} from "next-intl/server";
import {Stars} from "@/components/reviews/Stars";

const REVIEWS_SHOWN = 5;

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  authorName: string | null;
  customer: unknown;
  verifiedPurchase: boolean;
  createdAt: string;
};

type Props = {
  productId: string;
  locale: string;
};

export async function ProductReviews({productId, locale}: Props) {
  const t = await getTranslations("Pdp.reviews");

  const payload = await getPayload();
  const result = await payload.find({
    collection: "reviews",
    where: {
      and: [{product: {equals: productId}}, {status: {equals: "approved"}}],
    },
    sort: "-createdAt",
    limit: REVIEWS_SHOWN,
    // Reviews are admin-read; this explicit approved-only filter is the
    // public view (same policy as GET /reviews).
    overrideAccess: true,
    depth: 0,
  });
  const rows = result.docs as unknown as ReviewRow[];
  const total = result.totalDocs;
  if (rows.length === 0) return null;

  // Display-name fallback: one batched customers lookup for rows that
  // captured no authorName (mirrors the GET route).
  const missingNameIds = [
    ...new Set(
      rows
        .filter((r) => !r.authorName && typeof r.customer === "string")
        .map((r) => r.customer as string),
    ),
  ];
  const customerNames = new Map<string, string>();
  if (missingNameIds.length > 0) {
    const customers = await payload.find({
      collection: "customers",
      where: {id: {in: missingNameIds}},
      limit: missingNameIds.length,
      overrideAccess: true,
      depth: 0,
    });
    for (const doc of customers.docs as Array<{id: string; name?: string | null}>) {
      if (doc.name) customerNames.set(doc.id, doc.name);
    }
  }

  const average =
    Math.round(
      (rows.reduce((sum, r) => sum + r.rating, 0) / Math.max(rows.length, 1)) * 10,
    ) / 10;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <section
      aria-labelledby="pdp-reviews-heading"
      data-testid="pdp-reviews"
      className="mt-16 border-t border-border-card pt-8"
    >
      <h2
        id="pdp-reviews-heading"
        className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary"
      >
        {t("title")}
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stars rating={average} size="md" aria-label={t("starsLabel", {rating: String(average)})} />
        <p className="text-sm text-text-secondary">
          {t("summary", {rating: average.toFixed(1), count: total})}
        </p>
      </div>

      <ul className="mt-6 space-y-6">
        {rows.map((r) => (
          <li key={r.id} data-testid="pdp-review" className="text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={r.rating} />
              <p className="font-display text-text-heading">
                {r.authorName ??
                  (typeof r.customer === "string"
                    ? customerNames.get(r.customer) ?? null
                    : null) ??
                  t("anonymous")}
              </p>
              {r.verifiedPurchase ? (
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold">
                  {t("verified")}
                </p>
              ) : null}
              <p className="text-xs text-text-muted">
                {dateFormatter.format(new Date(r.createdAt))}
              </p>
            </div>
            {r.body ? (
              <p className="mt-2 leading-relaxed text-text-secondary">{r.body}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {total > rows.length ? (
        <p className="mt-6 text-xs italic text-text-muted">
          {t("more", {count: String(total - rows.length)})}
        </p>
      ) : null}
    </section>
  );
}

export default ProductReviews;
