// collections/_revalidate-hook.ts
// Factory for Payload afterChange hooks that trigger on-demand ISR
// revalidation via POST /api/revalidate.
//
// Why a factory: 6 collections need the same hook body (mithai-products,
// qsr-menu-items, snack-products, merch-products, gift-boxes, stories).
// Copy-pasting the hook 6× would drift. Each collection passes its slug
// and gets back a typed CollectionAfterChange hook.
//
// Production-only: in dev, Next.js dev server has different cache semantics
// and firing the webhook would just be noise (and could loop). The brief
// explicitly gates on NODE_ENV === "production".
//
// Fire-and-forget: failures are logged but never surface to the Payload
// admin UI — a stale cache for 60s is preferable to blocking a save.
import type {CollectionAfterChange} from "payload";

/**
 * Make an afterChange hook that pings /api/revalidate on doc save.
 * Wire it in via `hooks: { afterChange: [makeRevalidateHook("mithai-products")] }`.
 */
export function makeRevalidateHook(collection: string): CollectionAfterChange {
  return async function afterChange({doc, req}) {
    if (process.env.NODE_ENV !== "production") return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      console.warn(
        "[revalidate-hook] NEXT_PUBLIC_SITE_URL not set — skipping purge for",
        collection,
      );
      return;
    }

    const d = doc as {slug?: string};
    try {
      await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "",
        },
        body: JSON.stringify({collection, slug: d.slug}),
      });
    } catch (e) {
      console.error("[revalidate-hook]", collection, e);
    }
    // Touch req to satisfy TS noUnusedLocals if enabled; req is part of the
    // hook signature and may be used for locale-aware purges in the future.
    void req;
  };
}
