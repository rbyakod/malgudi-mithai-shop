// tests/e2e/verticals.spec.ts
// Vertical hub pages — /mithai, /qsr, /snacks, /merch.
// Each page must list the seeded items from scripts/seed.ts so the hubs are
// confirmed wired to their Payload collections.

import {test, expect} from "@playwright/test";

test("mithai hub lists seeded kaju katli", async ({page}) => {
  await page.goto("/en/mithai");

  // Hub heading renders.
  await expect(
    page.getByRole("heading", {name: /mithai/i}).first(),
  ).toBeVisible();

  // Seeded item appears (scripts/seed.ts → mithai-products/Kaju Katli).
  await expect(page.getByText("Kaju Katli").first()).toBeVisible();
});

test("qsr hub lists seeded item", async ({page}) => {
  await page.goto("/en/qsr");

  await expect(
    page.getByRole("heading", {name: /qsr/i}).first(),
  ).toBeVisible();

  // Seeded item appears (scripts/seed.ts → qsr-menu-items/Chole Bhature).
  await expect(page.getByText("Chole Bhature").first()).toBeVisible();
});

test("snacks hub lists seeded item", async ({page}) => {
  await page.goto("/en/snacks");

  await expect(
    page.getByRole("heading", {name: /snacks/i}).first(),
  ).toBeVisible();

  // Seeded item appears (scripts/seed.ts → snack-products/Aloo Bhujia).
  await expect(page.getByText("Aloo Bhujia").first()).toBeVisible();
});

test("merch hub lists seeded item", async ({page}) => {
  await page.goto("/en/merch");

  await expect(
    page.getByRole("heading", {name: /merch/i}).first(),
  ).toBeVisible();

  // Seeded item appears (scripts/seed.ts → merch-products/Mithai-Making Tool Set).
  await expect(
    page.getByText("Mithai-Making Tool Set").first(),
  ).toBeVisible();
});
