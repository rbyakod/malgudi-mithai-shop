// tests/unit/analytics.test.ts
// Unit tests for the isomorphic `track()` helper.
//
// `track()` pushes events to `window.dataLayer` (GA4 via GTM-style snippet)
// and forwards them to `window.fbq` (Meta Pixel custom event). On the server
// (no `window`) it must no-op so server-side call sites do not crash.

import {describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Shape of the browser globals the analytics module reads. Mirrors the
// minimal contract of GA4 dataLayer + Meta Pixel fbq the production snippet
// installs. Both fields are optional because some tests delete them to
// exercise the "missing global" branches.
type MockWindow = {
  dataLayer?: Array<Record<string, unknown>>;
  fbq?: (...args: unknown[]) => void;
};

// globalThis is augmented with an override for window so tests can install
// and remove a mock without colliding with lib.dom's `Window` type.
type GlobalWithMockWindow = Record<PropertyKey, unknown> & { window?: MockWindow };

function mockGlobal(): GlobalWithMockWindow {
  return globalThis as unknown as GlobalWithMockWindow;
}

function win(): MockWindow {
  const w = mockGlobal().window;
  if (!w) throw new Error("window not set");
  return w;
}

beforeEach(() => {
  // Simulate a browser that has GA4 + Meta Pixel snippets installed.
  mockGlobal().window = {dataLayer: [], fbq: vi.fn()};
});

afterEach(() => {
  // Clean delete so the SSR no-op branch is reachable in targeted tests.
  delete mockGlobal().window;
});

describe("track", () => {
  it("pushes to dataLayer with event name", async () => {
    const {track} = await import("@/lib/analytics");
    track("product_viewed", {id: "kaju-katli"});
    const last = win().dataLayer!.at(-1);
    expect(last!.event).toBe("product_viewed");
    expect(last!.id).toBe("kaju-katli");
  });

  it("initializes dataLayer if missing", async () => {
    const {track} = await import("@/lib/analytics");
    delete win().dataLayer;
    track("add_to_cart", {id: "gulab-jamun", quantity: 2});
    expect(Array.isArray(win().dataLayer)).toBe(true);
    expect(win().dataLayer!.at(-1)!.event).toBe("add_to_cart");
  });

  it("calls fbq with trackCustom when fbq is present", async () => {
    const {track} = await import("@/lib/analytics");
    track("lead_submitted", {form: "corporate"});
    expect(win().fbq).toHaveBeenCalledWith(
      "trackCustom",
      "lead_submitted",
      {form: "corporate"},
    );
  });

  it("does not throw when fbq is absent", async () => {
    const {track} = await import("@/lib/analytics");
    delete win().fbq;
    expect(() => track("whatsapp_clicked")).not.toThrow();
  });

  it("merges event name and payload without losing fields", async () => {
    const {track} = await import("@/lib/analytics");
    track("gift_builder_completed", {box: "12-piece", total: 1200, currency: "INR"});
    const last = win().dataLayer!.at(-1);
    expect(last).toEqual({
      event: "gift_builder_completed",
      box: "12-piece",
      total: 1200,
      currency: "INR",
    });
  });

  it("no-ops on the server (no window)", async () => {
    delete mockGlobal().window;
    const {track} = await import("@/lib/analytics");
    expect(() => track("search_used", {q: "kaju"})).not.toThrow();
  });

  it("accepts no payload", async () => {
    const {track} = await import("@/lib/analytics");
    track("theme_changed");
    expect(win().dataLayer!.at(-1)!.event).toBe("theme_changed");
  });
});
