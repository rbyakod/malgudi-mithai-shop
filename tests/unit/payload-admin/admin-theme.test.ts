import {describe, it, expect} from "vitest";
import {
  ADMIN_THEMES,
  DEFAULT_ADMIN_THEME,
  ADMIN_THEME_COOKIE,
  isAdminTheme,
  parseAdminTheme,
  getAdminThemeFromCookies,
} from "@/components/payload-admin/theme/admin-theme";

describe("admin-theme helpers", () => {
  it("exposes 3 themes with mishran-admin first", () => {
    expect(ADMIN_THEMES).toEqual([
      "mishran-admin",
      "mishran-midnight",
      "mishran-monsoon",
    ]);
    expect(DEFAULT_ADMIN_THEME).toBe("mishran-admin");
  });

  it("exposes exact cookie name", () => {
    expect(ADMIN_THEME_COOKIE).toBe("mishran-admin-theme");
  });

  it("isAdminTheme narrows known themes", () => {
    expect(isAdminTheme("mishran-admin")).toBe(true);
    expect(isAdminTheme("mishran-midnight")).toBe(true);
    expect(isAdminTheme("mishran-monsoon")).toBe(true);
    expect(isAdminTheme("mishran-something")).toBe(false);
    expect(isAdminTheme(undefined)).toBe(false);
    expect(isAdminTheme(42)).toBe(false);
  });

  it("parseAdminTheme returns valid theme or default", () => {
    expect(parseAdminTheme("mishran-midnight")).toBe("mishran-midnight");
    expect(parseAdminTheme("garbage")).toBe(DEFAULT_ADMIN_THEME);
    expect(parseAdminTheme(undefined)).toBe(DEFAULT_ADMIN_THEME);
    expect(parseAdminTheme(null)).toBe(DEFAULT_ADMIN_THEME);
  });

  it("getAdminThemeFromCookies reads cookie or returns default", () => {
    const store = {get: (name: string) => name === "mishran-admin-theme" ? "mishran-monsoon" : undefined};
    expect(getAdminThemeFromCookies(store)).toBe("mishran-monsoon");

    const empty = {get: () => undefined};
    expect(getAdminThemeFromCookies(empty)).toBe(DEFAULT_ADMIN_THEME);

    const corrupt = {get: () => "garbage"};
    expect(getAdminThemeFromCookies(corrupt)).toBe(DEFAULT_ADMIN_THEME);
  });
});
