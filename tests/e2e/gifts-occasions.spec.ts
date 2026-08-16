// tests/e2e/gifts-occasions.spec.ts
// Batch 7 — public gifts + occasions surfaces.
//
// WRITTEN NOT RUN (legal.spec.ts pattern): needs a running dev server
// (playwright.config baseURL) with the seeded Payload DB AND the
// giftbox-price backfill applied (`pnpm backfill:giftbox-price`) so
// displayPrice values exist. Covers:
//   - both hubs render 200 with their masthead copy
//   - a seeded gift card renders its price and links to a detail that 200s
//   - the gift detail renders the price and its mithai rail links resolve
//   - occasions detail renders the recommended rail with resolving hrefs
//   - sitemap.xml contains the gifts + occasions hubs and detail URLs

import {test, expect} from "@playwright/test";

test("gifts hub renders with seeded hampers", async ({page}) => {
  const response = await page.goto("/en/gifts");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {level: 1, name: "Gifts"}),
  ).toBeVisible();
  await expect(page.getByTestId("gifts-grid").locator("li").first()).toBeVisible();
});

test("gift card price renders and the detail page resolves", async ({page}) => {
  await page.goto("/en/gifts");

  // First card that carries a price (backfilled displayPrice parses as ₹…).
  const pricedCard = page
    .getByTestId("gifts-grid")
    .locator("li")
    .filter({hasText: /₹\d/})
    .first();
  await expect(pricedCard).toBeVisible();

  const href = await pricedCard.locator("a").first().getAttribute("href");
  expect(href).toMatch(/\/en\/gifts\/[a-z0-9-]+$/);

  const detail = await page.goto(href!);
  expect(detail?.status()).toBe(200);
  await expect(page.getByTestId("gift-price")).toBeVisible();
});

test("gift detail mithai rail links resolve to /mithai PDPs", async ({page}) => {
  await page.goto("/en/gifts");

  // Any gift detail with a compatible-mithai rail (admin-curated data —
  // the seeded hampers may not have any, so this soft-skips when empty).
  // Hrefs are snapshotted up front: locators re-resolve on the current
  // page, so iterating one captured on the hub would stall on a detail.
  const hrefs = await page
    .getByTestId("gifts-grid")
    .locator("li a")
    .evaluateAll((els) =>
      els
        .slice(0, 3)
        .map((el) => el.getAttribute("href"))
        .filter((h): h is string => Boolean(h)),
    );
  for (const href of hrefs) {
    await page.goto(href);
    const rail = page.getByTestId("gift-mithai-rail");
    if (!(await rail.count())) continue;
    const railHref = await rail.locator("a").first().getAttribute("href");
    expect(railHref).toMatch(/\/en\/mithai\/[a-z0-9-]+$/);
    const railResponse = await page.request.get(railHref!);
    expect(railResponse.status()).toBe(200);
    return;
  }
  test.skip(true, "no seeded gift has a compatible-mithai rail");
});

test("occasions hub and detail render", async ({page}) => {
  const hub = await page.goto("/en/occasions");
  expect(hub?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {level: 1, name: "Occasions"}),
  ).toBeVisible();

  const firstCard = page.getByTestId("occasions-grid").locator("li a").first();
  if (!(await firstCard.count())) {
    test.skip(true, "no occasions seeded");
  }
  const href = await firstCard.getAttribute("href");
  expect(href).toMatch(/\/en\/occasions\/[a-z0-9-]+$/);

  const detail = await page.goto(href!);
  expect(detail?.status()).toBe(200);

  // Recommended rail hrefs resolve per relationTo (mithai or gifts).
  const rail = page.getByTestId("occasion-recommended-rail");
  if (await rail.count()) {
    const railHref = await rail.locator("a").first().getAttribute("href");
    expect(railHref).toMatch(/\/en\/(mithai|gifts)\/[a-z0-9-]+$/);
    const railResponse = await page.request.get(railHref!);
    expect(railResponse.status()).toBe(200);
  }
});

test("sitemap contains gifts and occasions URLs", async ({request}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("/en/gifts</loc>");
  expect(body).toContain("/en/occasions</loc>");
  // Detail URLs are slugify(name) — at least the seeded entries exist when
  // the DB has data; the hubs alone satisfy the route-wiring assertion.
  expect(body).toMatch(/\/en\/gifts\/[a-z0-9-]+<\/loc>/);
  expect(body).toMatch(/\/en\/occasions\/[a-z0-9-]+<\/loc>/);
});
