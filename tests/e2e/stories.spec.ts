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

test("unknown story slug 404s", async ({page}) => {
  await page.goto("/en/stories/no-such-story");
  // The not-found page renders a 404 + "Page not found" heading. Anchor on
  // the heading to avoid the strict-mode collision between the two
  // matching elements on the chrome.
  await expect(
    page.getByRole("heading", {name: /not found/i}).first(),
  ).toBeVisible();
});
