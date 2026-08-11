// tests/e2e/mithai-pdp.spec.ts
// Mithai product detail page (PDP) — /en/mithai/[slug].
// Verifies the PDP renders the seeded doc's display price and ingredients,
// i.e. the page is wired to the `mithai-products` Payload collection.

import {test, expect} from "@playwright/test";

test("mithai PDP shows display price and ingredients", async ({page}) => {
  await page.goto("/en/mithai/kaju-katli");

  // Display price (from scripts/seed.ts → displayPrice: "₹920 / 250g").
  await expect(page.getByText("₹920 / 250g")).toBeVisible();

  // Ingredients mentions cashew (seed → "Cashew, sugar, kakvi.").
  await expect(page.getByText(/Cashew/i)).toBeVisible();
});
