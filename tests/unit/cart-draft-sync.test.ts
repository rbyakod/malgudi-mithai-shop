// tests/unit/cart-draft-sync.test.ts
// Abandoned-cart draft sync (lib/web/cartDraftSync) — the debounced 2s
// fire-and-forget POST on every cart change, the skip-empty rule (an
// emptied cart is not abandonment data — it also cancels a pending sync),
// the draft_saved analytics throttle (once per distinct cart state), and
// the session-id persistence key.

import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {
  CART_DRAFT_SESSION_KEY,
  createCartDraftSyncer,
  getCartDraftSessionId,
  markCartDraftConverted,
  saveCartDraftEmail,
} from "@/lib/web/cartDraftSync";
import type {CartItem} from "@/context/CartContext";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "p1",
    name: "Kaju Katli",
    priceLabel: "₹920 / 250g",
    quantity: 1,
    image: "",
    ...overrides,
  };
}

const ESTIMATE = {subtotalInPaise: 92000, itemCount: 1, tier: "fresh" as const};

type DataLayerWindow = typeof globalThis & {
  dataLayer?: Array<Record<string, unknown>>;
};

function dataLayer(): Array<Record<string, unknown>> {
  return ((globalThis as DataLayerWindow).dataLayer ??= []);
}

describe("getCartDraftSessionId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates and persists a session id at the v1 key", () => {
    const first = getCartDraftSessionId();
    expect(first).toBeTruthy();
    expect(window.localStorage.getItem(CART_DRAFT_SESSION_KEY)).toBe(first);
    expect(getCartDraftSessionId()).toBe(first);
  });
});

describe("createCartDraftSyncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    dataLayer().length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces: nothing posts before 2s, exactly one post after", async () => {
    const post = vi.fn().mockResolvedValue(true);
    const syncer = createCartDraftSyncer({post});
    syncer.schedule([item()], ESTIMATE);
    expect(post).not.toHaveBeenCalled();
    // Rapid cart churn collapses into the last state.
    syncer.schedule([item({quantity: 2})], {...ESTIMATE, itemCount: 2});
    await vi.advanceTimersByTimeAsync(1_999);
    expect(post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.items).toEqual([item({quantity: 2})]);
    expect(body.estimate).toEqual({subtotalInPaise: 92000, itemCount: 2, tier: "fresh"});
    expect(typeof body.sessionId).toBe("string");
  });

  it("never posts an empty cart — and cancels a pending sync", async () => {
    const post = vi.fn().mockResolvedValue(true);
    const syncer = createCartDraftSyncer({post});
    syncer.schedule([item()], ESTIMATE);
    syncer.schedule([], {...ESTIMATE, itemCount: 0});
    await vi.advanceTimersByTimeAsync(5_000);
    expect(post).not.toHaveBeenCalled();
  });

  it("tracks draft_saved once per distinct cart state", async () => {
    const post = vi.fn().mockResolvedValue(true);
    const syncer = createCartDraftSyncer({post});

    syncer.schedule([item()], ESTIMATE);
    await vi.advanceTimersByTimeAsync(2_100);
    // Same state again (e.g. effect re-run) → no second event.
    syncer.schedule([item()], ESTIMATE);
    await vi.advanceTimersByTimeAsync(2_100);
    let events = dataLayer().filter((e) => e.event === "draft_saved");
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe("cart");
    expect(events[0]!.itemCount).toBe(1);

    // A genuinely different cart state announces again.
    syncer.schedule([item(), item({id: "p2"})], {...ESTIMATE, itemCount: 2});
    await vi.advanceTimersByTimeAsync(2_100);
    events = dataLayer().filter((e) => e.event === "draft_saved");
    expect(events).toHaveLength(2);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("a failed POST never tracks", async () => {
    const post = vi.fn().mockResolvedValue(false);
    const syncer = createCartDraftSyncer({post});
    syncer.schedule([item()], ESTIMATE);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(post).toHaveBeenCalledTimes(1);
    expect(dataLayer().filter((e) => e.event === "draft_saved")).toHaveLength(0);
  });

  it("flush fires a pending sync immediately; cancel drops it", async () => {
    const post = vi.fn().mockResolvedValue(true);
    const syncer = createCartDraftSyncer({post});
    syncer.schedule([item()], ESTIMATE);
    syncer.flush();
    expect(post).toHaveBeenCalledTimes(1);

    syncer.schedule([item()], ESTIMATE);
    syncer.cancel();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("saveCartDraftEmail / markCartDraftConverted", () => {
  beforeEach(() => {
    window.localStorage.clear();
    dataLayer().length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(ok: boolean) {
    const calls: Array<{url: string; body: Record<string, unknown>}> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (
          url: string,
          init?: {method?: string; body?: string},
        ): Promise<Response> => {
          calls.push({
            url,
            body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {},
          });
          return {ok} as Response;
        },
      ),
    );
    return calls;
  }

  it("posts the consent-gated email capture to /api/cart-drafts", async () => {
    const calls = stubFetch(true);
    const ok = await saveCartDraftEmail("a@b.com");
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/cart-drafts");
    expect(calls[0]!.body.marketingConsent).toBe(true);
    expect(calls[0]!.body.email).toBe("a@b.com");
    expect(calls[0]!.body.sessionId).toBe(
      window.localStorage.getItem(CART_DRAFT_SESSION_KEY),
    );
  });

  it("reports failure quietly when the route rejects", async () => {
    stubFetch(false);
    await expect(saveCartDraftEmail("a@b.com")).resolves.toBe(false);
  });

  it("marks converted with the session id and never throws", async () => {
    const calls = stubFetch(false); // even a failing marker must not throw
    getCartDraftSessionId(); // ensure the session exists first
    await expect(markCartDraftConverted()).resolves.toBeUndefined();
    expect(calls[0]!.body.status).toBe("converted");
    expect(calls[0]!.body.sessionId).toBe(
      window.localStorage.getItem(CART_DRAFT_SESSION_KEY),
    );
  });

  it("never mints a session id just to mark converted", async () => {
    const calls = stubFetch(true);
    // No cart visit ever happened → no session key → no phantom draft row.
    await expect(markCartDraftConverted()).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
    expect(window.localStorage.getItem(CART_DRAFT_SESSION_KEY)).toBeNull();
  });
});
