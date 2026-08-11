// tests/unit/analytics.test.ts
// Unit tests for the isomorphic `track()` helper.
//
// `track()` pushes events to `window.dataLayer` (GA4 via GTM-style snippet)
// and forwards them to `window.fbq` (Meta Pixel custom event). On the server
// (no `window`) it must no-op so server-side call sites do not crash.

import {describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  // Simulate a browser that has GA4 + Meta Pixel snippets installed.
  (global as any).window = {dataLayer: [], fbq: vi.fn()};
});

afterEach(() => {
  // Clean delete so the SSR no-op branch is reachable in targeted tests.
  delete (global as any).window;
});

describe("track", () => {
  it("pushes to dataLayer with event name", async () => {
    const {track} = await import("@/lib/analytics");
    track("product_viewed", {id: "kaju-katli"});
    const last = (global as any).window.dataLayer.at(-1);
    expect(last.event).toBe("product_viewed");
    expect(last.id).toBe("kaju-katli");
  });

  it("initializes dataLayer if missing", async () => {
    const {track} = await import("@/lib/analytics");
    delete (global as any).window.dataLayer;
    track("add_to_cart", {id: "gulab-jamun", quantity: 2});
    expect(Array.isArray((global as any).window.dataLayer)).toBe(true);
    expect((global as any).window.dataLayer.at(-1).event).toBe("add_to_cart");
  });

  it("calls fbq with trackCustom when fbq is present", async () => {
    const {track} = await import("@/lib/analytics");
    track("lead_submitted", {form: "corporate"});
    expect((global as any).window.fbq).toHaveBeenCalledWith(
      "trackCustom",
      "lead_submitted",
      {form: "corporate"},
    );
  });

  it("does not throw when fbq is absent", async () => {
    const {track} = await import("@/lib/analytics");
    delete (global as any).window.fbq;
    expect(() => track("whatsapp_clicked")).not.toThrow();
  });

  it("merges event name and payload without losing fields", async () => {
    const {track} = await import("@/lib/analytics");
    track("gift_builder_completed", {box: "12-piece", total: 1200, currency: "INR"});
    const last = (global as any).window.dataLayer.at(-1);
    expect(last).toEqual({
      event: "gift_builder_completed",
      box: "12-piece",
      total: 1200,
      currency: "INR",
    });
  });

  it("no-ops on the server (no window)", async () => {
    delete (global as any).window;
    const {track} = await import("@/lib/analytics");
    expect(() => track("search_used", {q: "kaju"})).not.toThrow();
  });

  it("accepts no payload", async () => {
    const {track} = await import("@/lib/analytics");
    track("theme_changed");
    expect((global as any).window.dataLayer.at(-1).event).toBe("theme_changed");
  });
});
