// tests/e2e/mithai-pdp.spec.ts
// Mithai product detail page (PDP) — /en/mithai/[slug].
// Verifies the PDP renders the seeded doc's display price and ingredients,
// and that the buy module (pack sizes, pincode check, quantity stepper,
// CTAs) works end to end against the serviceability API.
//
// Batch 8 additions: the trust strip chips + honest-label column, and the
// same-family cross-sell rail.
//
// kaju-katli comes from scripts/seed-data/mithai-catalog.json (the catalog
// seed upserts by slug and supersedes the older scripts/seed.ts fixture):
// displayPrice "₹1,562 / 1 kg", ingredients mention cashew, dietaryTags
// ["vegetarian"], allergens ["tree-nuts", "milk"], family "classic".

import {test, expect} from "@playwright/test";

test("mithai PDP shows display price and ingredients", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  // Display price (catalog seed → displayPrice: "₹1,562 / 1 kg").
  await expect(page.getByText("₹1,562 / 1 kg").first()).toBeVisible();

  // Ingredients mentions cashew (seed → "cashew, sugar, ghee, cardamom.").
  await expect(page.getByText(/Cashew/i)).toBeVisible();
});

test("mithai PDP derives pack sizes around the seeded price", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  // Base option keeps the verbatim display price.
  await expect(page.getByTestId("display-price")).toHaveText("₹1,562 / 1 kg");

  // Ladder: 250g / 500g / 1kg with linearly derived prices.
  const options = page.getByTestId("pack-size");
  await expect(options).toHaveCount(3);
  await expect(options.filter({hasText: "500g"})).toBeVisible();
  await expect(options.filter({hasText: "1 kg"})).toBeVisible();

  // Selecting a derived size swaps the price line.
  await options.filter({hasText: "500g"}).click();
  await expect(page.getByTestId("display-price")).toHaveText("₹780 / 500g");
});

test("mithai PDP pincode check hits the serviceability API", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  // Invalid pincode → inline message, no API shape assumptions needed.
  await page.getByTestId("pincode-input").fill("12");
  await page.getByTestId("pincode-check-button").click();
  await expect(page.getByText("Enter a 6-digit pincode.")).toBeVisible();

  // Seeded Delhi-NCR pincode → fresh tier with city + SLA.
  await page.getByTestId("pincode-input").fill("110001");
  await page.getByTestId("pincode-check-button").click();
  const result = page.getByTestId("pincode-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("110001");
  await expect(result).toContainText(/fresh/i);

  // Reload restores the persisted result without refetching.
  await page.reload();
  await expect(page.getByTestId("pincode-result")).toContainText("110001");
});

test("mithai PDP quantity stepper feeds the cart", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  await page.getByTestId("qty-increment").click();
  await page.getByTestId("qty-increment").click();
  await expect(page.getByTestId("qty-value")).toHaveText("3");

  // Decrement floors at 1 and disables there.
  await page.getByTestId("qty-decrement").click();
  await page.getByTestId("qty-decrement").click();
  await expect(page.getByTestId("qty-value")).toHaveText("1");
  await expect(page.getByTestId("qty-decrement")).toBeDisabled();
  await page.getByTestId("qty-increment").click();

  await page.getByTestId("add-to-cart").click();
  await page.goto("/en/cart");
  await expect(page.getByText("Qty 2")).toBeVisible();
});

test("mithai PDP buy now adds and routes to the cart", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  await page.getByTestId("buy-now").click();
  await expect(page).toHaveURL(/\/en\/cart$/);
  await expect(page.getByText(/Kaju Katli/)).toBeVisible();
});

test("mithai PDP trust strip carries the seeded chips and honest labels", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  // Trust strip — seeded kaju-katli: freshness promise, shelf life, and the
  // vegetarian dietary chip (uppercase styling is CSS-only; DOM text is
  // title-case).
  const strip = page.getByTestId("pdp-trust-strip");
  await expect(strip).toBeVisible();
  await expect(strip).toContainText("Made to order");
  await expect(strip).toContainText("7-10 days shelf life");
  await expect(strip).toContainText("Vegetarian");

  // Honest-label column — allergens list + storage row (both seeded).
  const honest = page.getByTestId("pdp-honest-label");
  await expect(honest).toBeVisible();
  await expect(page.getByTestId("pdp-allergens").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("pdp-allergens")).toContainText("tree-nuts");
  await expect(page.getByTestId("pdp-storage")).toContainText(/room temperature/i);
});

test("mithai PDP renders the same-family cross-sell rail", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  // kaju-katli is family "classic" (26 seeded members) — the rail must show
  // up to 4 siblings, never the current product, all linking to mithai PDPs.
  const rail = page.getByTestId("pdp-cross-sell-rail");
  await expect(rail).toBeVisible();

  const hrefs = await rail.locator("a").evaluateAll((els) =>
    els
      .map((el) => el.getAttribute("href"))
      .filter((h): h is string => Boolean(h)),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.length).toBeLessThanOrEqual(4);
  for (const href of hrefs) {
    expect(href).toMatch(/\/en\/mithai\/[a-z0-9-]+$/);
    expect(href).not.toContain("kaju-katli");
  }

  // Cards lead with photography — every pick renders an image panel.
  await expect(rail.locator("li img").first()).toBeVisible();

  // The first card resolves to a real PDP.
  const response = await page.request.get(hrefs[0]!);
  expect(response.status()).toBe(200);
});
