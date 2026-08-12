import {describe, it, expect} from "vitest";
// SiteHeader re-exports NAV_LINKS for production callers, but importing the
// component pulls next-intl + next/navigation which don't resolve under jsdom.
// Import the pure data module directly to test the spec-mandated IA.
import {NAV_LINKS} from "@/components/layout/nav-links";

describe("SiteHeader nav", () => {
  it("includes all spec links", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(hrefs).toContain("/mithai");
    expect(hrefs).toContain("/stories");
    expect(hrefs).toContain("/qsr");
    expect(hrefs).toContain("/snacks");
    expect(hrefs).toContain("/merch");
  });

  it("exposes translation keys for each link", () => {
    for (const link of NAV_LINKS) {
      expect(typeof link.key).toBe("string");
      expect(link.key.startsWith("nav.")).toBe(true);
    }
  });
});
