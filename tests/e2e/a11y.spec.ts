import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/en", "/en/mithai", "/en/stories", "/en/weddings"];

for (const p of PAGES) {
  test(`${p} has no critical a11y violations`, async ({ page }) => {
    await page.goto(p);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
  });
}

// The root layout renders <html lang="en"> statically (it cannot see the
// [locale] param); the locale layout corrects it pre-paint via an inline
// script and on soft navigations via HtmlLangSync.
for (const [path, locale] of [
  ["/en", "en"],
  ["/kn", "kn"],
  ["/hi", "hi"],
] as const) {
  test(`${path} sets <html lang="${locale}">`, async ({ page }) => {
    await page.goto(path);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang))
      .toBe(locale);
  });
}
