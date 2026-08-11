// Unit test: app/sitemap.ts.
//
// The sitemap reads Payload's content collections across the 3 locked
// locales (en, hi, kn) and emits <url> entries. This test asserts the
// contract from task-20-brief.md Step 1 plus task-24 should-fix coverage:
// URLs for the seeded `kaju-katli` mithai, qsr/snacks/merch detail pages,
// and the static commerce stubs all appear in the result.
//
// Self-sufficient: seeds docs with unique slugs in `beforeAll` and removes
// them in `afterAll` so the test does not depend on `npm run seed` having
// run and never leaks between runs. Cleanup is idempotent.
//
// Env: MONGODB_URI from .env.local via tests/setup-integration.ts (loaded
// for all tests by vitest.config.ts setupFiles).
import {describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_SLUG = `test-sitemap-kaju-${process.pid}-${Date.now()}`;
const TEST_QSR_NAME = `Sitemap Qsr Test ${TEST_SLUG}`;
const TEST_SNACK_NAME = `Sitemap Snack Test ${TEST_SLUG}`;
const TEST_MERCH_NAME = `Sitemap Merch Test ${TEST_SLUG}`;

describe("sitemap", () => {
  let createdId: string | undefined;
  let createdQsrId: string | undefined;
  let createdSnackId: string | undefined;
  let createdMerchId: string | undefined;

  beforeAll(async () => {
    const {getPayload} = await import("@/lib/payload-client");
    const payload = await getPayload();
    // Clean up any stale doc with the same slug from a prior run.
    const stale = await payload.find({
      collection: "mithai-products",
      where: {slug: {equals: TEST_SLUG}},
    });
    for (const doc of stale.docs) {
      await payload.delete({collection: "mithai-products", id: doc.id});
    }
    const created = (await payload.create({
      collection: "mithai-products",
      data: {
        name: "Kaju Katli (Sitemap Test)",
        // The brief's assertion checks for "/mithai/kaju-katli" — give the
        // slug that prefix so it matches without polluting the real
        // `kaju-katli` doc namespace.
        slug: `kaju-katli-${TEST_SLUG}`,
        family: "classic",
        ingredients: "Cashew, sugar, ghee.",
        // MithaiProducts has `versions: {drafts: true}` — without
        // `_status: "published"` the doc ships as a draft and the sitemap's
        // published filter excludes it (and so does the test).
        _status: "published",
      },
    })) as {id: string};
    createdId = created.id;

    // Seed one doc each in qsr/snacks/merch so the detail-URL assertions
    // have something deterministic to find without depending on `npm run seed`.
    // These collections have NO `slug` field — the sitemap uses `slugify(name)`.
    const createdQsr = (await payload.create({
      collection: "qsr-menu-items",
      data: {name: TEST_QSR_NAME, category: "chole-bhature", veg: true, spiceLevel: "medium"},
    })) as {id: string};
    createdQsrId = createdQsr.id;

    const createdSnack = (await payload.create({
      collection: "snack-products",
      data: {name: TEST_SNACK_NAME, category: "namkeen", weight: "200g", msrp: "₹60"},
    })) as {id: string};
    createdSnackId = createdSnack.id;

    const createdMerch = (await payload.create({
      collection: "merch-products",
      data: {name: TEST_MERCH_NAME, type: "tool", availability: "enquiry-only"},
    })) as {id: string};
    createdMerchId = createdMerch.id;
  });

  afterAll(async () => {
    const {getPayload} = await import("@/lib/payload-client");
    const payload = await getPayload();
    for (const [collection, id] of [
      ["mithai-products", createdId],
      ["qsr-menu-items", createdQsrId],
      ["snack-products", createdSnackId],
      ["merch-products", createdMerchId],
    ] as const) {
      if (!id) continue;
      try {
        await payload.delete({collection, id});
      } catch {
        // Already gone — ignore.
      }
    }
  });

  it("returns urls for seeded mithai product", async () => {
    const {default: sitemap} = await import("@/app/sitemap");
    const result = await sitemap();
    expect(
      result.some((u: {url: string}) => u.url.includes("/mithai/kaju-katli")),
    ).toBe(true);
  });

  it("includes all three locales for a mithai PDP", async () => {
    const {default: sitemap} = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result
      .filter((u: {url: string}) =>
        u.url.includes(`/mithai/kaju-katli-${TEST_SLUG}`),
      )
      .map((u: {url: string}) => u.url);
    expect(urls.some((u: string) => u.includes("/en/"))).toBe(true);
    expect(urls.some((u: string) => u.includes("/hi/"))).toBe(true);
    expect(urls.some((u: string) => u.includes("/kn/"))).toBe(true);
  });

  it("includes the locale home, mithai hub, and stories hub", async () => {
    const {default: sitemap} = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((u: {url: string}) => u.url);
    expect(urls.some((u: string) => u.endsWith("/en"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/mithai"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/stories"))).toBe(true);
  });

  it("emits URLs for qsr, snacks, and merch detail pages", async () => {
    const {default: sitemap} = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((u: {url: string}) => u.url);
    // slugify(name) — see app/sitemap.ts slugify().
    const qsrSlug = TEST_QSR_NAME.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const snackSlug = TEST_SNACK_NAME.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const merchSlug = TEST_MERCH_NAME.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    expect(urls.some((u: string) => u.includes(`/en/qsr/${qsrSlug}`))).toBe(true);
    expect(urls.some((u: string) => u.includes(`/en/snacks/${snackSlug}`))).toBe(true);
    expect(urls.some((u: string) => u.includes(`/en/merch/${merchSlug}`))).toBe(true);
  });

  it("emits URLs for the commerce stubs and lead pages", async () => {
    const {default: sitemap} = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((u: {url: string}) => u.url);
    // Commerce stubs (priority 0.3).
    expect(urls.some((u: string) => u.endsWith("/en/cart"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/checkout"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/account"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/track-order"))).toBe(true);
    // Lead pages (priority 0.5).
    expect(urls.some((u: string) => u.endsWith("/en/weddings"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/corporate"))).toBe(true);
    // Vertical hubs beyond mithai (priority 0.9).
    expect(urls.some((u: string) => u.endsWith("/en/qsr"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/snacks"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/en/merch"))).toBe(true);
  });

  it("does not include draft stories", async () => {
    const {default: sitemap} = await import("@/app/sitemap");
    const result = await sitemap();
    // `draft-test-*` slugs should never appear — Stories collection filters
    // to `_status: "published"`.
    const drafts = result.filter((u: {url: string}) =>
      u.url.includes("/stories/draft-test-"),
    );
    expect(drafts).toHaveLength(0);
  });
});
