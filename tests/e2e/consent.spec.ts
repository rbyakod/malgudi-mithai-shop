import {test, expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Start as a first-time visitor: no consent cookie.
test.use({storageState: {cookies: [], origins: []}});

const THIRD_PARTY = /googletagmanager|google-analytics|connect\.facebook|facebook\.net/;

test("first visit: banner shows and no third-party analytics loads", async ({page}) => {
  const thirdParty: string[] = [];
  page.on("request", (r) => {
    if (THIRD_PARTY.test(r.url())) thirdParty.push(r.url());
  });

  await page.goto("/en");
  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("button", {name: "Accept all"})).toBeVisible();
  await expect(banner.getByRole("button", {name: "Essential only"})).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(thirdParty).toEqual([]);
});

test("essential only: choice is remembered and the banner stays away", async ({page, context}) => {
  await page.goto("/en");
  await page.getByRole("button", {name: "Essential only"}).click();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);

  const cookie = (await context.cookies()).find((c) => c.name === "mishran_consent");
  expect(cookie).toBeTruthy();
  expect(decodeURIComponent(cookie!.value)).toMatch(/"analytics":false,"assistant":false/);

  await page.reload();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
});

test("choose: optional categories start unticked and can be saved individually", async ({page, context}) => {
  await page.goto("/en");
  const banner = page.getByTestId("consent-banner");
  await banner.getByRole("button", {name: "Choose"}).click();
  await expect(banner.getByRole("checkbox", {name: /Analytics/})).not.toBeChecked();
  await expect(banner.getByRole("checkbox", {name: /AI assistant/})).not.toBeChecked();
  await expect(banner.getByRole("checkbox", {name: /Essential/})).toBeDisabled();

  await banner.getByRole("checkbox", {name: /AI assistant/}).check();
  await banner.getByRole("button", {name: "Save choices"}).click();
  const cookie = (await context.cookies()).find((c) => c.name === "mishran_consent");
  expect(decodeURIComponent(cookie!.value)).toMatch(/"analytics":false,"assistant":true/);
});

test("footer link reopens the banner to change or withdraw a choice", async ({page, context}) => {
  await page.goto("/en");
  await page.getByRole("button", {name: "Accept all"}).click();
  await page.getByRole("button", {name: "Privacy choices"}).click();

  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("checkbox", {name: /Analytics/})).toBeChecked();
  await banner.getByRole("checkbox", {name: /Analytics/}).uncheck();
  await banner.getByRole("checkbox", {name: /AI assistant/}).uncheck();
  await banner.getByRole("button", {name: "Save choices"}).click();

  const cookie = (await context.cookies()).find((c) => c.name === "mishran_consent");
  expect(decodeURIComponent(cookie!.value)).toMatch(/"analytics":false,"assistant":false/);
});

test("banner is translated on Hindi and Kannada pages", async ({page}) => {
  await page.goto("/hi");
  await expect(page.getByTestId("consent-banner")).toContainText("आपकी गोपनीयता के विकल्प");
  await page.goto("/kn");
  await expect(page.getByTestId("consent-banner")).toContainText("ನಿಮ್ಮ ಗೌಪ್ಯತೆಯ ಆಯ್ಕೆಗಳು");
});

test("phone: banner fits the screen without horizontal scroll", async ({page}) => {
  await page.setViewportSize({width: 375, height: 700});
  await page.goto("/en");
  await expect(page.getByTestId("consent-banner")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

for (const path of ["/en", "/hi", "/kn"]) {
  test(`${path}: banner (collapsed and expanded) has no serious a11y violations`, async ({page}) => {
    await page.goto(path);
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible();
    const scan = () => new AxeBuilder({page}).include('[data-testid="consent-banner"]').withTags(["wcag2a", "wcag2aa"]).analyze();

    let results = await scan();
    expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);

    await banner.getByRole("button").nth(2).click(); // Choose
    results = await scan();
    expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });
}
