// lib/web/cartDraftSync.ts
// Abandoned-cart recovery — the client half of the cart-drafts collection.
//
// Every cart change on /cart schedules a debounced (2s) fire-and-forget
// POST /api/cart-drafts with the session id + items + a compact estimate,
// so the abandonment cron (Batch A) has something to remind about. Empty
// carts never sync (nothing to recover); failures are swallowed (the sync
// must never break the cart UI).
//
// Session id: a random UUID persisted at `mishran-cart-session-v1`. Same
// hydration discipline as CartContext — this module only touches
// localStorage from effects/event handlers, never during render.
//
// Analytics: `draft_saved` fires once per cart-state change (keyed on the
// synced payload signature) so repeated effect runs or a quick A→B→A
// toggle don't spam the dataLayer.

import {track} from "@/lib/analytics";
import type {CartItem} from "@/context/CartContext";
import type {ServiceabilityTier} from "@/lib/web/serviceability";

export const CART_DRAFT_SESSION_KEY = "mishran-cart-session-v1";
export const CART_DRAFT_DEBOUNCE_MS = 2_000;

/** Compact estimate stored on the draft (what the cron email summarizes). */
export type CartDraftEstimate = {
  /** Priced subtotal, or null when any line is "on request". */
  subtotalInPaise: number | null;
  /** Total quantity across lines. */
  itemCount: number;
  /** Saved serviceability tier at sync time, if any. */
  tier: ServiceabilityTier | null;
};

/** Get (or lazily create) the browser's cart-draft session id. Client-only
 *  — call from effects/handlers, never during render. */
export function getCartDraftSessionId(): string {
  try {
    const existing = window.localStorage.getItem(CART_DRAFT_SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(CART_DRAFT_SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Storage unavailable (private mode etc.) — a per-call id still syncs,
    // it just can't be restored on the next visit.
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Read the session id WITHOUT creating one — the conversion marker must
 *  never mint a draft for a cart that was never synced. */
export function peekCartDraftSessionId(): string | null {
  try {
    return window.localStorage.getItem(CART_DRAFT_SESSION_KEY);
  } catch {
    return null;
  }
}

type SyncerOptions = {
  debounceMs?: number;
  /** Test seam — defaults to window fetch against /api/cart-drafts. */
  post?: (body: Record<string, unknown>) => Promise<boolean>;
};

export type CartDraftSyncer = {
  /** Schedule a debounced sync of this cart state. Empty carts cancel any
   *  pending sync instead (an emptied cart is not abandonment data). */
  schedule: (items: CartItem[], estimate: CartDraftEstimate) => void;
  /** Fire a pending sync immediately (unmount hygiene). */
  flush: () => void;
  /** Drop any pending sync. */
  cancel: () => void;
};

/** Signature of the last payload that fired a `draft_saved` event — module
 *  level so remounts don't re-announce an unchanged cart. */
let lastTrackedSignature: string | null = null;

export function createCartDraftSyncer(options: SyncerOptions = {}): CartDraftSyncer {
  const debounceMs = options.debounceMs ?? CART_DRAFT_DEBOUNCE_MS;
  const post =
    options.post ??
    (async (body: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/cart-drafts", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
        });
        return res.ok;
      } catch {
        return false;
      }
    });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: {items: CartItem[]; estimate: CartDraftEstimate} | null = null;

  async function fire(): Promise<void> {
    const payload = pending;
    pending = null;
    if (!payload) return;
    const sessionId = getCartDraftSessionId();
    const ok = await post({
      sessionId,
      items: payload.items,
      estimate: payload.estimate,
    });
    if (!ok) return;
    // One draft_saved per distinct cart state — the upsert re-POSTs are
    // idempotent, but the dataLayer shouldn't see repeats.
    const signature = JSON.stringify([payload.items, payload.estimate]);
    if (signature === lastTrackedSignature) return;
    lastTrackedSignature = signature;
    track("draft_saved", {
      source: "cart",
      itemCount: payload.estimate.itemCount,
    });
  }

  return {
    schedule(items, estimate) {
      if (items.length === 0) {
        // Skip empty carts — and cancel anything queued for the cart that
        // just emptied.
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        return;
      }
      pending = {items, estimate};
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void fire();
      }, debounceMs);
    },
    flush() {
      if (!pending) return;
      if (timer) clearTimeout(timer);
      timer = null;
      void fire();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

/** Best-effort "this draft converted" marker (checkout success) and the
 *  email/consent capture (cart nudge). Both swallow every failure — a
 *  reminder about a completed order is worse than a lost marker. */
export async function markCartDraftConverted(): Promise<void> {
  // No session id = no draft was ever synced — nothing to mark (and never
  // mint one here; that would create a phantom converted row).
  const sessionId = peekCartDraftSessionId();
  if (!sessionId) return;
  try {
    await fetch("/api/cart-drafts", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({sessionId, status: "converted"}),
    });
  } catch {
    // ignore
  }
}

export async function saveCartDraftEmail(email: string): Promise<boolean> {
  try {
    const res = await fetch("/api/cart-drafts", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        sessionId: getCartDraftSessionId(),
        email,
        marketingConsent: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch a draft's items for ?draft= restore. Null on missing/expired. */
export async function fetchCartDraft(
  sessionId: string,
): Promise<CartItem[] | null> {
  try {
    const res = await fetch(
      `/api/cart-drafts/${encodeURIComponent(sessionId)}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {items?: unknown};
    if (!Array.isArray(body.items)) return null;
    return body.items.filter(
      (x): x is CartItem =>
        !!x &&
        typeof x === "object" &&
        typeof (x as CartItem).id === "string" &&
        typeof (x as CartItem).name === "string" &&
        typeof (x as CartItem).quantity === "number",
    );
  } catch {
    return null;
  }
}
