// tests/e2e/legal.spec.ts
// Legal/trust surface — the seven Batch 4 pages plus footer rewiring.
//
// WRITTEN NOT RUN: needs a running dev server (playwright.config baseURL)
// with the seeded Payload DB. Covers:
//   - all seven new routes render 200 in en with their masthead copy
//   - /help/shipping interpolates the config delivery fees (₹49 / ₹99
//     defaults from DELIVERY_FEE_FRESH_PAISE / DELIVERY_FEE_SHELF_STABLE_PAISE)
//   - every footer link resolves (no dead hrefs after the rewire)
//   - the retired /sweets route 404s and points at /mithai
//   - noindex robots meta on the auth-gated /account and /checkout

import {test, expect} from "@playwright/test";

const ROUTES = [
  {path: "/en/privacy", heading: "Privacy policy"},
  {path: "/en/terms", heading: "Terms of service"},
  {path: "/en/help/shipping", heading: "Shipping & delivery"},
  {path: "/en/help/returns", heading: "Returns & refunds"},
  {path: "/en/help/contact", heading: "Contact us"},
  {path: "/en/accessibility", heading: "Accessibility"},
  {path: "/en/about", heading: "Our story"},
] as const;

test.describe("legal pages", () => {
  for (const route of ROUTES) {
    test(`${route.path} renders with masthead copy`, async ({page}) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", {level: 1, name: route.heading}),
      ).toBeVisible();
    });
  }

  test("shipping page interpolates the config delivery fees", async ({page}) => {
    await page.goto("/en/help/shipping");
    const body = await page.textContent("main, section, body");
    // Defaults from lib/config.ts (49 → ₹49, 99 → ₹99). If the env vars
    // override the fees at runtime this assertion needs the same values.
    expect(body).toContain("₹49");
    expect(body).toContain("₹99");
  });

  test("contact page renders the WhatsApp CTA and lead cards", async ({page}) => {
    await page.goto("/en/help/contact");
    const wa = page.getByRole("link", {name: /whatsapp/i}).first();
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute("href", /wa\.me\/\d+/);
    await expect(
      page.getByRole("link", {name: /planning a wedding\?/i}),
    ).toHaveAttribute("href", /\/en\/weddings$/);
    await expect(
      page.getByRole("link", {name: /corporate & bulk gifting/i}),
    ).toHaveAttribute("href", /\/en\/corporate$/);
  });
});

test.describe("footer rewire", () => {
  test("every footer href resolves", async ({page}) => {
    await page.goto("/en");
    const hrefs = await page
      .locator("footer a[href]")
      .evaluateAll((anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).getAttribute("href"))
          .filter((href): href is string =>
            href !== null && href.startsWith("/"),
          ),
      );
    // Deduplicate and drop pure query/hash strings.
    const unique = [...new Set(hrefs)];
    expect(unique.length).toBeGreaterThan(5);
    for (const href of unique) {
      const response = await page.request.get(href);
      expect(response.status(), `footer link ${href}`).toBeLessThan(400);
    }
  });

  test("footer links shipping/returns/track-order/contact once rewired", async ({page}) => {
    await page.goto("/en");
    const footer = page.locator("footer");
    await expect(
      footer.getByRole("link", {name: "Shipping & delivery"}),
    ).toHaveAttribute("href", "/en/help/shipping");
    await expect(
      footer.getByRole("link", {name: "Returns & refunds"}),
    ).toHaveAttribute("href", "/en/help/returns");
    await expect(
      footer.getByRole("link", {name: "Track order"}),
    ).toHaveAttribute("href", "/en/track-order");
    // Dropped dead links stay dropped.
    await expect(
      footer.getByRole("link", {name: "Careers"}),
    ).toHaveCount(0);
    await expect(footer.getByRole("link", {name: "Press"})).toHaveCount(0);
    await expect(footer.getByRole("link", {name: "Wholesale"})).toHaveCount(0);
  });
});

test.describe("retired routes and indexing", () => {
  test("/sweets 404s and links to /mithai", async ({page}) => {
    const response = await page.goto("/en/sweets");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("link", {name: "Browse sweets"}),
    ).toHaveAttribute("href", "/en/mithai");
  });

  test("/account and /checkout are noindex", async ({page}) => {
    for (const path of ["/en/account", "/en/checkout"]) {
      await page.goto(path);
      const robots = page.locator('meta[name="robots"]');
      await expect(robots.first()).toHaveAttribute(
        "content",
        /noindex/i,
        {timeout: 10_000},
      );
    }
  });
});
