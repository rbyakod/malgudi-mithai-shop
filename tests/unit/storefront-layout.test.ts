import {describe, expect, it} from "vitest";
import {normalizeThemeSwitcherVisibility} from "@/lib/storefront-layout";

describe("storefront layout settings", () => {
  it("normalizes Theme Studio visibility", () => {
    expect(normalizeThemeSwitcherVisibility("disabled")).toBe("disabled");
    expect(normalizeThemeSwitcherVisibility("home")).toBe("home");
    expect(normalizeThemeSwitcherVisibility("all")).toBe("all");
    expect(normalizeThemeSwitcherVisibility("legacy")).toBe("disabled");
    expect(normalizeThemeSwitcherVisibility(null)).toBe("disabled");
  });
});
