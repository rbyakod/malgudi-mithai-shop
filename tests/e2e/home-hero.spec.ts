import {test, expect} from "@playwright/test";

// Home hero should render at least a heading (current behaviour) and,
// when the home-hero Payload global has slides, a carousel.
test.describe("home hero", () => {
  test("renders the brand heading", async ({page}) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", {name: /Mishran/i}).first()
    ).toBeVisible();
  });

  test("carousel present when home-hero global has slides", async ({page}) => {
    await page.goto("/en");

    // Either carousel or static figure — both are valid.
    const carousel = page.getByRole("group", {name: /Featured products/i});
    const carouselCount = await carousel.count();

    if (carouselCount > 0) {
      // At least one slide.
      await expect(carousel.getByRole("group", {name: /1 \//}).first()).toBeVisible();
      // View + Add to cart buttons on the active slide.
      await expect(carousel.getByRole("link", {name: /^View$/i}).first()).toBeVisible();
      await expect(
        carousel.getByRole("button", {name: /Add to cart/i}).first()
      ).toBeVisible();
    } else {
      // Static fallback must render the kaju-katli figure caption.
      // NOTE: assertion text is English-only. If this test is ever
      // parameterized across locales, replace with locale-aware lookup
      // (e.g. read expected strings from messages/<locale>.json).
      await expect(page.getByText(/From the kitchen/i)).toBeVisible();
      await expect(page.getByText(/Kaju katli/).first()).toBeVisible();
    }
  });

  test("add-to-cart on hero bumps cart badge", async ({page}) => {
    await page.goto("/en");
    const carousel = page.getByRole("group", {name: /Featured products/i});
    const carouselCount = await carousel.count();
    test.skip(carouselCount === 0, "home-hero global is empty — skipping");

    const badgeBefore = await page
      .getByRole("link", {name: /cart/i})
      .filter({hasText: /\d/})
      .count();

    await carousel.getByRole("button", {name: /Add to cart/i}).first().click();

    // Cart badge should appear or increment.
    await expect(
      page.getByRole("link", {name: /cart/i}).filter({hasText: /\d/})
    ).toHaveCount(Math.min(badgeBefore + 1, 1));
  });

  test("next button advances carousel", async ({page}) => {
    await page.goto("/en");
    const carousel = page.getByRole("group", {name: /Featured products/i});
    const carouselCount = await carousel.count();
    test.skip(carouselCount === 0, "home-hero global is empty — skipping");

    const firstDot = carousel.getByRole("button", {name: /Go to slide 1/i});
    const secondDot = carousel.getByRole("button", {name: /Go to slide 2/i});
    const hasSecond = await secondDot.count();

    test.skip(!hasSecond, "only one slide — nothing to advance to");

    await expect(firstDot).toHaveAttribute("aria-current", "true");
    await carousel.getByRole("button", {name: /Next slide/i}).click();
    await expect(secondDot).toHaveAttribute("aria-current", "true");
  });
});
