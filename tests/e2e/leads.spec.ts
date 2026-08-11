// tests/e2e/leads.spec.ts
// Lead capture forms — /weddings and /corporate.
// Each form posts to /api/leads (Task 10) and on success swaps to a
// thank-you panel. The test verifies the happy-path submit end-to-end
// against the dev server (webServer config in playwright.config.ts spins
// up `next dev`). Payload must be running for the route handler to create
// the lead; Resend notification is best-effort and must not block 201.

import {test, expect} from "@playwright/test";

test("wedding lead submits successfully", async ({page}) => {
  await page.goto("/en/weddings");

  await page.getByLabel(/name/i).first().fill("Test User");
  await page.getByLabel(/email/i).first().fill("test@example.com");
  await page.getByLabel(/phone/i).first().fill("+919999999999");
  await page.getByLabel(/guests/i).fill("200");
  await page.getByRole("button", {name: /submit/i}).click();

  await expect(page.getByText(/thank you/i)).toBeVisible({timeout: 15_000});
});

test("corporate lead submits successfully", async ({page}) => {
  await page.goto("/en/corporate");

  await page.getByLabel(/name/i).first().fill("Corp Planner");
  await page.getByLabel(/email/i).first().fill("corp@example.com");
  await page.getByLabel(/phone/i).first().fill("+918888888888");
  await page.getByLabel(/quantity/i).fill("500");
  await page.getByRole("button", {name: /submit/i}).click();

  await expect(page.getByText(/thank you/i)).toBeVisible({timeout: 15_000});
});
