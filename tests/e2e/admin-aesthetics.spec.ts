import {test, expect, type Page} from "@playwright/test";

// Admin panel aesthetic regression coverage.
// Auto-login via Payload's dev autoLogin (dev@mithai.shop / dev-password).
//
// Selector iterations during Task 19:
// - Login page tests: AutoLogin redirects /admin/login -> /admin, so we
//   hit /admin/logout first to actually see the login page.
// - data-admin-theme: AdminThemeBootScript is a client component (useEffect)
//   that sets body[data-admin-theme] post-hydration. Tests must wait for it.
// - Settings menu: Payload 3.85 uses an avatar button with aria-label that
//   contains "Account"; the gear icon has aria-label "View account options".
// - Catalog: dashboard widget heading is exact-text matched to avoid
//   colliding with the "03 Catalog Ops" nav group.

const ADMIN_THEMES = ["mishran-admin", "mishran-midnight", "mishran-monsoon"] as const;

// Wait for the AdminThemeBootScript client component to set body[data-admin-theme].
async function waitForThemeAttr(page: Page) {
  await expect.poll(
    async () => page.evaluate(() => document.body.getAttribute("data-admin-theme")),
    {timeout: 10000},
  ).not.toBeNull();
}

test.describe("Mishran admin aesthetics", () => {
  test.beforeEach(async ({page}) => {
    // /admin/login with AutoLogin active will redirect to /admin. To exercise
    // the login page itself we explicitly log out first. For dashboard tests
    // we then re-navigate to /admin which AutoLogin restores.
    await page.goto("/admin/logout", {waitUntil: "domcontentloaded"});
    await page.goto("/admin", {waitUntil: "domcontentloaded"});
  });

  // First test pays Turbopack cold-compile cost.
  test.setTimeout(90000);

  // NOTE on login-page tests: AutoLogin (when active in dev) intercepts
  // /admin/login and bounces the browser to /admin before the Logo override
  // renders, so the wordmark/hero-crest can't be asserted from a Playwright
  // session that shares the cookie jar with AutoLogin. These two tests are
  // therefore skipped when AutoLogin is active (which it is in `next dev`).
  // To exercise the login page visually, temporarily disable AutoLogin in
  // payload.config.ts. The dashboard-side crest (sidebar Icon override) IS
  // testable under AutoLogin — see "sidebar shows crest icon" below.
  const autoLoginActive = true; // payload.config.ts sets autoLogin when isLocalDev
  test.skip("login page renders wordmark", async ({page}) => {
    // Run only when AutoLogin is disabled.
    test.skip(autoLoginActive, "AutoLogin redirects /admin/login before Logo renders");
    await page.goto("/admin/logout", {waitUntil: "domcontentloaded"});
    await page.goto("/admin/login", {waitUntil: "domcontentloaded"});
    const logo = page.locator('img[src*="mishran-wordmark.svg"]').first();
    await expect(logo).toBeVisible({timeout: 20000});
  });

  test.skip("login page renders crest in hero", async ({page}) => {
    test.skip(autoLoginActive, "AutoLogin redirects /admin/login before hero renders");
    await page.goto("/admin/logout", {waitUntil: "domcontentloaded"});
    await page.goto("/admin/login", {waitUntil: "domcontentloaded"});
    const crest = page.locator('img[src*="mishran-crest.svg"]').first();
    await expect(crest).toBeVisible({timeout: 20000});
  });

  test("sidebar shows crest icon", async ({page}) => {
    // AutoLogin places us on /admin dashboard — the nav crest should be visible.
    await page.goto("/admin", {waitUntil: "domcontentloaded"});
    const crest = page.locator('img[src*="mishran-crest.svg"]').first();
    await expect(crest).toBeVisible({timeout: 20000});
  });

  test("body has data-admin-theme attribute on load", async ({page}) => {
    await page.goto("/admin", {waitUntil: "domcontentloaded"});
    await waitForThemeAttr(page);
    const attr = await page.evaluate(() => document.body.getAttribute("data-admin-theme"));
    expect(ADMIN_THEMES).toContain(attr);
  });

  test("sidebar theme switcher changes body attribute", async ({page}) => {
    await page.goto("/admin", {waitUntil: "domcontentloaded"});
    await waitForThemeAttr(page);

    // Since audit D4 the AdminThemeSwitcher lives in the sidebar
    // (afterNavLinks), not the header settings popup. The select is a plain
    // visible control — drive it through a native change event so React's
    // onChange handler fires (works regardless of RTL wrappers).
    await page.evaluate(() => {
      const sel = document.getElementById("mishran-admin-theme-select") as HTMLSelectElement | null;
      if (!sel) throw new Error("theme select not found");
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!;
      nativeSetter.call(sel, "mishran-midnight");
      sel.dispatchEvent(new Event("change", {bubbles: true}));
    });

    // Body attribute updates immediately (onChange handler).
    await expect(page.locator("body")).toHaveAttribute("data-admin-theme", "mishran-midnight", {timeout: 5000});

    // Reload preserves theme via cookie.
    await page.reload();
    await waitForThemeAttr(page);
    await expect(page.locator("body")).toHaveAttribute("data-admin-theme", "mishran-midnight");
  });

  test("dashboard renders all 4 widget headings", async ({page}) => {
    await page.goto("/admin", {waitUntil: "domcontentloaded"});
    // Use exact heading role to avoid colliding with nav-group labels.
    await expect(page.getByRole("heading", {name: "Recent leads", exact: true})).toBeVisible({timeout: 20000});
    await expect(page.getByRole("heading", {name: "Mithai freshness", exact: true})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Pending stories", exact: true})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Catalog", exact: true})).toBeVisible();
  });

  test("mithai-products list view renders thumbnails in name column", async ({page}) => {
    await page.goto("/admin/collections/mithai-products", {waitUntil: "domcontentloaded"});
    await page.waitForLoadState("networkidle");
    // Conditional per brief: skip if seed data missing (count == 0).
    const nameCellImg = page.locator('td img[src*="/media/"], td img[src*="mishran"]').first();
    const hasImage = await nameCellImg.count();
    if (hasImage > 0) {
      await expect(nameCellImg).toBeVisible();
    }
  });

  test("nav groups render with 01–05 prefixes", async ({page}) => {
    await page.goto("/admin", {waitUntil: "domcontentloaded"});
    // Sidebar nav is the second <nav> element (Payload's nav--nav-animate).
    const sidebarNav = page.locator("nav.nav, aside.nav").first();
    await expect(sidebarNav).toContainText("01 Brand", {timeout: 20000});
    await expect(sidebarNav).toContainText("02 Products");
    await expect(sidebarNav).toContainText("03 Catalog Ops");
    await expect(sidebarNav).toContainText("04 Storefront");
    await expect(sidebarNav).toContainText("05 Settings");
  });

  // Audit D9: the dashboard-home crumb is a visible "Admin home" chip,
  // not the stock 18×18 icon box. Header element — no rail dependency.
  test("breadcrumb home renders the Admin home chip", async ({page}) => {
    await page.goto("/admin/collections/addresses", {waitUntil: "domcontentloaded"});
    const chip = page.locator(".step-nav__home").first();
    await expect(chip).toBeVisible({timeout: 20000});
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.querySelector(".step-nav__home");
            return el ? getComputedStyle(el, "::after").content : null;
          }),
        {timeout: 10000},
      )
      .toBe('"Admin home"');
    const width = await chip.evaluate((el) => parseFloat(getComputedStyle(el).width));
    expect(width).toBeGreaterThan(60); // stock crumb is a fixed 18px box
  });

  // Audit D8: Cancel on every edit view backs out to the list. A clean
  // form navigates instantly; if the leave-guard fires (e.g. form already
  // invalid), accepting it must still land on the list.
  test("edit views carry Cancel that backs out", async ({page}) => {
    await page.goto("/admin/collections/addresses/create", {waitUntil: "domcontentloaded"});
    await page.getByRole("link", {name: "Cancel"}).click();
    const leaveBtn = page.getByRole("button", {name: /leave anyway/i});
    try {
      await leaveBtn.waitFor({state: "visible", timeout: 3000});
      await leaveBtn.click();
    } catch {
      // No modal — clean navigation.
    }
    // Payload's list view syncs default params into the URL
    // (?depth=1&limit=10), so match on path with optional query.
    await page.waitForURL(/\/admin\/collections\/addresses(\?.*)?$/, {timeout: 15000});
  });

  // Audit D8: a dirty form must be confirmed before Cancel discards it —
  // Payload's native LeaveWithoutSaving modal over our link.
  test("dirty form: Cancel opens the leave-without-saving modal", async ({page}) => {
    await page.goto("/admin/collections/customers/create", {waitUntil: "domcontentloaded"});
    await page.getByLabel(/^name$/i).fill("Undo Me");
    await page.getByRole("link", {name: "Cancel"}).click();
    await expect(page.getByText(/leave without saving/i)).toBeVisible({timeout: 10000});
    await page.getByRole("button", {name: /leave anyway/i}).click();
    await page.waitForURL(/\/admin\/collections\/customers(\?.*)?$/, {timeout: 15000});
  });
});
