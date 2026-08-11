import {test, expect } from "@playwright/test";

test("home shows hero + 4 portals + pillars", async ({page}) => {
  await page.goto("/en");

  // Hero — heading contains brand name "Mishran" (case-insensitive).
  await expect(
    page.getByRole("heading", {name: /Mishran/i}).first()
  ).toBeVisible();

  // Four vertical portals — each label visible as a link.
  await expect(
    page.getByRole("link", {name: /Mithai/i}).first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", {name: /QSR/i}).first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", {name: /Snacks/i}).first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", {name: /Merch/i}).first()
  ).toBeVisible();

  // Brand pillars — names render as plain text.
  await expect(page.getByText(/Milk Purity/i)).toBeVisible();
  await expect(page.getByText(/Karigar Mastery/i)).toBeVisible();
});
