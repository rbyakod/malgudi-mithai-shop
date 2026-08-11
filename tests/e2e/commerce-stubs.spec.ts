// tests/e2e/commerce-stubs.spec.ts
// Commerce stub routes — /cart, /checkout, /account, /track-order.
// Each route renders the branded CommerceStub inside <main> with a WhatsApp
// CTA so customers can reach the events team while commerce launches in
// Phase 8. Scoped to main#main-content so it doesn't match the footer link.

import {test, expect} from "@playwright/test";

const ROUTES = [
  {path: "/en/cart", name: "cart"},
  {path: "/en/checkout", name: "checkout"},
  {path: "/en/account", name: "account"},
  {path: "/en/track-order", name: "track-order"},
] as const;

for (const route of ROUTES) {
  test(`${route.name} stub shows WhatsApp CTA`, async ({page}) => {
    await page.goto(route.path);
    const main = page.locator("#main-content");
    const whatsappLink = main.getByRole("link", {name: /whatsapp/i});
    await expect(whatsappLink).toBeVisible();
    const href = await whatsappLink.first().getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+/);
  });
}
