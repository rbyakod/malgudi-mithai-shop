import { describe, it, expect } from "vitest";
import { normalizeTheme, DEFAULT_THEME, VALID_THEMES } from "@/lib/themes";

describe("themes", () => {
  it("defaults to mishran-default", () => {
    expect(DEFAULT_THEME).toBe("mishran-default");
  });

  it("exposes 4 house themes + 4 extra palette themes", () => {
    expect(VALID_THEMES).toEqual([
      "mishran-default",
      "diwali-saffron",
      "wedding-heritage",
      "everyday-sage",
      "navy",
      "mblue2",
      "mindbox",
      "yoshida",
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

  it("accepts the restored palette themes by id", () => {
    expect(normalizeTheme("navy")).toBe("navy");
    expect(normalizeTheme("mblue2")).toBe("mblue2");
    expect(normalizeTheme("mindbox")).toBe("mindbox");
    expect(normalizeTheme("yoshida")).toBe("yoshida");
  });

  it("returns null for fully-archived themes", () => {
    expect(normalizeTheme("heritage-2")).toBe("wedding-heritage");
    expect(normalizeTheme("ibm")).toBeNull();
    expect(normalizeTheme("coinbase")).toBeNull();
    expect(normalizeTheme("myblue")).toBe("mblue2");
  });
});
