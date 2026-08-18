import {describe, expect, it} from "vitest";
import {
  normalizeHeroStyle,
  normalizeThemeSwitcherVisibility,
} from "@/lib/storefront-layout";

describe("storefront layout settings", () => {
  it("normalizes Theme Studio visibility", () => {
    expect(normalizeThemeSwitcherVisibility("disabled")).toBe("disabled");
    expect(normalizeThemeSwitcherVisibility("home")).toBe("home");
    expect(normalizeThemeSwitcherVisibility("all")).toBe("all");
    expect(normalizeThemeSwitcherVisibility("legacy")).toBe("disabled");
    expect(normalizeThemeSwitcherVisibility(null)).toBe("disabled");
  });

  it("normalizes the home hero style", () => {
    expect(normalizeHeroStyle("framed")).toBe("framed");
    expect(normalizeHeroStyle("cinematic")).toBe("cinematic");
    // Unknown / absent values fall back to the framed default so a bad
    // admin write can never break the home page.
    expect(normalizeHeroStyle("cinema")).toBe("framed");
    expect(normalizeHeroStyle("")).toBe("framed");
    expect(normalizeHeroStyle(null)).toBe("framed");
    expect(normalizeHeroStyle(undefined)).toBe("framed");
    expect(normalizeHeroStyle({})).toBe("framed");
  });
});
