// lib/themes.test.ts
import {describe, it, expect} from "vitest";
import {DEFAULT_THEME, VALID_THEMES, buildInitialThemeScript} from "./themes";

function run(script: string, stored: string | null): string | null {
  let attr: string | null = null;
  const doc = {documentElement: {setAttribute: (_: string, v: string) => { attr = v; }}};
  const storage = {getItem: () => stored};
  new Function("document", "localStorage", script)(doc, storage);
  return attr;
}

describe("buildInitialThemeScript", () => {
  it("starts on the given default when the visitor has not chosen", () => {
    expect(run(buildInitialThemeScript("diwali-saffron"), null)).toBe("diwali-saffron");
    expect(run(buildInitialThemeScript(), null)).toBe(DEFAULT_THEME);
  });
  it("lets the visitor's own stored choice win, including legacy names", () => {
    expect(run(buildInitialThemeScript("diwali-saffron"), "everyday-sage")).toBe("everyday-sage");
    expect(run(buildInitialThemeScript("diwali-saffron"), "sage")).toBe("everyday-sage");
  });
  it("falls back to the default for an unknown stored value or an unknown default", () => {
    expect(run(buildInitialThemeScript("wedding-heritage"), "not-a-theme")).toBe("wedding-heritage");
    expect(run(buildInitialThemeScript("nope" as never), null)).toBe(DEFAULT_THEME);
  });
  it("only ever offers themes the site has", () => {
    expect(VALID_THEMES).toContain(DEFAULT_THEME);
  });
});
