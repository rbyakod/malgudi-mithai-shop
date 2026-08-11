// Unit test: app/sitemap.ts.
//
// The sitemap reads Payload's `mithai-products` and `stories` collections
// across the 3 locked locales (en, hi, kn) and emits <url> entries. This
// test asserts the contract from task-20-brief.md Step 1: a URL for the
// seeded `kaju-katli` mithai appears in the result.
//
// Self-sufficient: seeds a doc with a unique slug in `beforeAll` and removes
// it in `afterAll` so the test does not depend on `npm run seed` having run
// and never leaks between runs. Cleanup is idempotent.
//
// Env: MONGODB_URI from .env.local via tests/setup-integration.ts (loaded
// for all tests by vitest.config.ts setupFiles).
import {describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_SLUG = `test-sitemap-kaju-${process.pid}-${Date.now()}`;

describe("sitemap", () => {
  let createdId: string | undefined;

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
  });

  afterAll(async () => {
    if (!createdId) return;
    const {getPayload} = await import("@/lib/payload-client");
    try {
      const payload = await getPayload();
      await payload.delete({collection: "mithai-products", id: createdId});
    } catch {
      // Already gone — ignore.
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
