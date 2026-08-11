// collections/_revalidate-hook.ts
// Factories for Payload hooks that trigger on-demand ISR revalidation via
// POST /api/revalidate.
//
// Why factories: 6 collections need the same hook body (mithai-products,
// qsr-menu-items, snack-products, merch-products, gift-boxes, stories).
// Copy-pasting the hook 6× would drift. Each collection passes its slug
// and gets back a typed hook.
//
// Two factories are exposed:
//   - `makeRevalidateHook(collection)` → afterChange (create/update)
//   - `makeRevalidateDeleteHook(collection)` → afterDelete (doc removed)
//
// Production-only: in dev, Next.js dev server has different cache semantics
// and firing the webhook would just be noise (and could loop). The brief
// explicitly gates on NODE_ENV === "production".
//
// Draft autosave: the afterChange hook skips revalidation when the save is
// a draft (either because Payload's `req.context.disableHooks` is set, or
// because the doc's `_status` is not "published"). Drafts aren't publicly
// served, so purging ISR on every autosave would just burn cycles.
//
// Fire-and-forget: failures are logged but never surface to the Payload
// admin UI — a stale cache for 60s is preferable to blocking a save.
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

/**
 * Send the revalidate POST. Shared between afterChange and afterDelete.
 * No-op outside production or when NEXT_PUBLIC_SITE_URL is unset.
 */
async function pingRevalidate(
  collection: string,
  slug: string | undefined,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.warn(
      "[revalidate-hook] NEXT_PUBLIC_SITE_URL not set — skipping purge for",
      collection,
    );
    return;
  }

  try {
    await fetch(`${siteUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "",
      },
      body: JSON.stringify({collection, slug}),
    });
  } catch (e) {
    console.error("[revalidate-hook]", collection, e);
  }
}

/**
 * Make an afterChange hook that pings /api/revalidate on doc save.
 * Wire it in via `hooks: { afterChange: [makeRevalidateHook("mithai-products")] }`.
 *
 * Skips draft autosaves: when `req.context.disableHooks` is set (Payload's
 * signal for autosave / import transactions), or when the doc has a
 * `_status` field that isn't "published", the hook returns early.
 */
export function makeRevalidateHook(
  collection: string,
): CollectionAfterChangeHook {
  return async function afterChange({doc, req}) {
    // Skip when Payload signals hooks should be quiet (autosave, imports).
    if (req.context?.disableHooks) return;

    // Skip draft saves — drafts aren't publicly served.
    const d = doc as {slug?: string; _status?: string};
    if (d._status !== undefined && d._status !== "published") return;

    await pingRevalidate(collection, d.slug);
  };
}

/**
 * Make an afterDelete hook that pings /api/revalidate on doc delete.
 * Wire it in via `hooks: { afterDelete: [makeRevalidateDeleteHook("mithai-products")] }`.
 *
 * The doc's old slug was cached at ISR time; we purge so the stale URL
 * returns 404 instead of the deleted doc.
 */
export function makeRevalidateDeleteHook(
  collection: string,
): CollectionAfterDeleteHook {
  return async function afterDelete({doc, req}) {
    // Respect Payload's hook-disable context for consistency with afterChange.
    if (req.context?.disableHooks) return;

    const d = doc as {slug?: string};
    await pingRevalidate(collection, d.slug);
  };
}
