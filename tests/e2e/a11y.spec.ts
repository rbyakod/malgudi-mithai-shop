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
