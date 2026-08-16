// tests/e2e/stories.spec.ts
// Stories hub + sample story detail (Task 18).
//
// Mirrors the verticals spec pattern: the hub must list the seeded farm
// story from scripts/seed.ts, and the detail route must render the lexical
// rich-text body (proves the @payloadcms/richtext-lexical/react wiring).

import {test, expect} from "@playwright/test";

test("stories hub lists the farm story", async ({page}) => {
  await page.goto("/en/stories");

  // Hub heading renders.
  await expect(
    page.getByRole("heading", {name: /stories/i}).first(),
  ).toBeVisible();

  // Seeded farm story appears (scripts/seed.ts → stories/jhajjar-farm).
  await expect(page.getByText(/Jhajjar Farm/i).first()).toBeVisible();
});

test("story detail renders the lexical body", async ({page}) => {
  await page.goto("/en/stories/jhajjar-farm");

  // Title visible.
  await expect(
    page.getByRole("heading", {name: /Jhajjar Farm/i}).first(),
  ).toBeVisible();

  // Rich-text body paragraph renders — proves the lexical body field is
  // wired through @payloadcms/richtext-lexical/react, not just the excerpt.
  await expect(
    page.getByText(/milk is already two hours old/i),
  ).toBeVisible();
});

// Batch 8 — related-products rail. scripts/seed.ts curates kaju-katli on the
// sample story once the catalog seed has run; soft-skip (gift-rail pattern)
// when a DB predates that wiring or the admin cleared the field.
test("story detail renders the related-products rail when curated", async ({page}) => {
  await page.goto("/en/stories/jhajjar-farm");

  const rail = page.getByTestId("story-related-rail");
  if (!(await rail.count())) {
    test.skip(true, "story has no relatedProducts curated");
  }

  // Every card href resolves per its relationTo collection and 200s.
  const href = await rail.locator("a").first().getAttribute("href");
  expect(href).toMatch(/\/en\/(mithai|gifts|qsr|snacks|merch)\/[a-z0-9-]+$/);
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
});

test("unknown story slug 404s", async ({page}) => {
  await page.goto("/en/stories/no-such-story");
  // The not-found page renders a 404 + "Page not found" heading. Anchor on
  // the heading to avoid the strict-mode collision between the two
  // matching elements on the chrome.
  await expect(
    page.getByRole("heading", {name: /not found/i}).first(),
  ).toBeVisible();
});

// Pillar filter routes (/stories/{farms,karigars,karigari,journal}) — the
// four routes the home-page Pillars strip links to. They must render the
// filtered listing (or an empty state) rather than 404.
test.describe("stories pillar routes", () => {
  for (const pillar of ["farms", "karigars", "karigari", "journal"] as const) {
    test(`renders ${pillar} pillar route without 404`, async ({page}) => {
      const response = await page.goto(`/en/stories/${pillar}`);
      // Route resolves (not a 404).
      expect(response?.status()).toBe(200);

      // The pillar heading is visible — anchors on the level-1 heading so
      // we don't collide with chrome elements.
      await expect(
        page.getByRole("heading", {level: 1}).first(),
      ).toBeVisible();
    });
  }

  test("farms pillar lists the seeded farm story", async ({page}) => {
    // scripts/seed.ts seeds one `farm` pillar story (jhavjhar-farm). The
    // farms route maps to pillar=farm in storage, so the seeded doc should
    // appear here.
    await page.goto("/en/stories/farms");
    await expect(page.getByText(/Jhajjar Farm/i).first()).toBeVisible();
  });
});
