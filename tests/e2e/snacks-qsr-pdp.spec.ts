// tests/e2e/snacks-qsr-pdp.spec.ts
// Snack + QSR PDPs — same buy-column structure as the mithai PDP
// (top-aligned info column, image-first on mobile, MRP / pack chip /
// retailer CTAs for snacks; veg+spice badges and counter-menu CTA for QSR).

import {test, expect} from "@playwright/test";

test("snacks PDP shows MRP, pack chip, and retailer CTA", async ({page}) => {
  await page.goto("/en/snacks/chatpata-dal");

  // MRP price block (seed → msrp "₹55" for Chatpata Dal).
  await expect(page.getByTestId("display-price")).toHaveText("₹55");

  // Pack-size chip from the seeded weight.
  await expect(page.getByText("1 pack", {exact: true}).first()).toBeVisible();

  // Retailer CTA is an external link (seed → haldirams source URL).
  const retailer = page.getByTestId("retailer-link");
  await expect(retailer).toHaveCount(1);
  await expect(retailer).toHaveAttribute("href", /^https:\/\//);
});

test("qsr PDP shows veg badge, spice level, and counter-menu CTA", async ({page}) => {
  await page.goto("/en/qsr/rajma-raseela");

  // Veg + spice badges (seed → veg true, spiceLevel medium).
  await expect(page.getByText("Vegetarian", {exact: true}).first()).toBeVisible();
  await expect(page.getByText("Medium spice", {exact: true}).first()).toBeVisible();

  // Counter-menu CTA routes back to the QSR hub.
  const cta = page.getByTestId("counter-menu-cta");
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/en/qsr");
});
