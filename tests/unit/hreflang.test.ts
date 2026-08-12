import {describe, it, expect} from "vitest";
import {buildAlternates} from "@/lib/seo";

describe("buildAlternates", () => {
  it("returns en/hi/kn + x-default for a path", () => {
    const result = buildAlternates("/mithai/kaju-katli");
    expect(result).toEqual({
      languages: {
        en: "/en/mithai/kaju-katli",
        hi: "/hi/mithai/kaju-katli",
        kn: "/kn/mithai/kaju-katli",
        "x-default": "/en/mithai/kaju-katli",
      },
    });
  });

  it("handles root path without trailing slash", () => {
    const result = buildAlternates("/");
    expect(result).toEqual({
      languages: {
        en: "/en",
        hi: "/hi",
        kn: "/kn",
        "x-default": "/en",
      },
    });
  });

  it("handles empty string as root", () => {
    const result = buildAlternates("");
    expect(result).toEqual({
      languages: {
        en: "/en",
        hi: "/hi",
        kn: "/kn",
        "x-default": "/en",
      },
    });
  });

  it("strips existing locale prefix", () => {
    const result = buildAlternates("/en/mithai");
    expect(result).toEqual({
      languages: {
        en: "/en/mithai",
        hi: "/hi/mithai",
        kn: "/kn/mithai",
        "x-default": "/en/mithai",
      },
    });
  });

  it("strips existing hi locale prefix", () => {
    const result = buildAlternates("/hi/mithai/sweet-1");
    expect(result).toEqual({
      languages: {
        en: "/en/mithai/sweet-1",
        hi: "/hi/mithai/sweet-1",
        kn: "/kn/mithai/sweet-1",
        "x-default": "/en/mithai/sweet-1",
      },
    });
  });
});
