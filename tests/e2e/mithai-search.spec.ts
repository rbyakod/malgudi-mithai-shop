// tests/e2e/mithai-search.spec.ts
// Batch 6 — /mithai server-backed search + facets.
//
// Needs the seeded Payload DB behind a dev server (playwright.config
// baseURL; PORT=3100 avoids clobbering a dev server on 3000). Covers:
//   - typing "kaju" narrows the grid and fires the (previously declared,
//     never-fired) search_used analytics event into window.dataLayer
//   - a family chip filters the grid and syncs ?family= into the URL
//   - a deep link (?q=kaju) hydrates the searched view directly
//   - clearing the query restores the full list

import {test, expect} from "@playwright/test";

async function countLabel(page: import("@playwright/test").Page) {
  const raw = await page
    .getByTestId("mithai-results-count")
    .innerText({timeout: 10_000});
  return Number(raw.replace(/[^0-9]/g, ""));
}

test("searching kaju narrows the grid and fires search_used", async ({page}) => {
  await page.goto("/en/mithai");

  const before = await countLabel(page);
  expect(before).toBeGreaterThan(1);

  await page.getByTestId("mithai-search-input").fill("kaju");
  await expect
    .poll(() => countLabel(page), {timeout: 15_000})
    .toBeLessThan(before);

  // The declared-but-never-fired event now fires on actual searches.
  await page.waitForFunction(
    () =>
      (window as {dataLayer?: Array<{event?: string}>}).dataLayer?.some(
        (e) => e.event === "search_used",
      ) === true,
    undefined,
    {timeout: 15_000},
  );

  // URL carries the query so the view is shareable.
  await expect(page).toHaveURL(/\/en\/mithai\?q=kaju/);
});

test("family chip filters and syncs the URL", async ({page}) => {
  await page.goto("/en/mithai");

  const before = await countLabel(page);
  await page.getByRole("button", {name: "Sugar-free"}).click();

  await expect
    .poll(() => countLabel(page), {timeout: 10_000})
    .toBeLessThan(before);
  await expect(page).toHaveURL(/family=sugar-free/);
});

test("deep link hydrates the searched view", async ({page}) => {
  await page.goto("/en/mithai?q=kaju");

  // Input seeded from the URL, grid already narrowed, no typing needed.
  // toHaveText retries so the in-flight "Searching…" state settles first.
  await expect(page.getByTestId("mithai-search-input")).toHaveValue("kaju");
  await expect(page.getByTestId("mithai-results-count")).toHaveText(/^[0-9]/);
});

test("clearing the query restores the full list", async ({page}) => {
  await page.goto("/en/mithai?family=classic");

  await page.getByTestId("mithai-search-input").fill("kaju");
  await expect
    .poll(() => page.url(), {timeout: 15_000})
    .toContain("q=kaju");
  await page.getByTestId("mithai-search-input").fill("");
  await expect
    .poll(() => page.url(), {timeout: 15_000})
    .not.toContain("q=");
});
