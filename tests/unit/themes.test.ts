import { describe, it, expect } from "vitest";
import { normalizeTheme, DEFAULT_THEME, VALID_THEMES } from "@/lib/themes";

describe("themes", () => {
  it("defaults to mishran-default", () => {
    expect(DEFAULT_THEME).toBe("mishran-default");
  });

  it("locks to exactly 4 themes", () => {
    expect(VALID_THEMES).toEqual([
      "mishran-default",
      "diwali-saffron",
      "wedding-heritage",
      "everyday-sage",
    ]);
  });

  it("maps legacy festive -> diwali-saffron", () => {
    expect(normalizeTheme("festive")).toBe("diwali-saffron");
  });

  it("maps legacy heritage -> wedding-heritage", () => {
    expect(normalizeTheme("heritage")).toBe("wedding-heritage");
  });

  it("maps legacy sage -> everyday-sage", () => {
    expect(normalizeTheme("sage")).toBe("everyday-sage");
  });

  it("returns null for unknown themes", () => {
    expect(normalizeTheme("navy")).toBeNull();
    expect(normalizeTheme("ibm")).toBeNull();
  });
});
