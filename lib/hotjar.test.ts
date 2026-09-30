// lib/hotjar.test.ts
import {describe, it, expect} from "vitest";
import {hotjarSnippet, isHotjarExcluded, validHotjarId} from "./hotjar";

describe("validHotjarId", () => {
  it("accepts only a number", () => {
    expect(validHotjarId(" 1234567 ")).toBe("1234567");
    for (const bad of ["", "abc", "12", "123456789012", "1234;alert(1)", "12 34", null, undefined, 1234567]) {
      expect(validHotjarId(bad as unknown)).toBe("");
    }
  });
});

describe("isHotjarExcluded", () => {
  it("never records pages with personal or payment details, in any language", () => {
    for (const p of ["/checkout", "/en/checkout", "/hi/checkout/success", "/kn/account", "/account/orders/1", "/sign-in", "/en/track-order", "/staff/orders-board", "/admin/collections/orders"]) {
      expect(isHotjarExcluded(p)).toBe(true);
    }
  });
  it("records the shopping pages", () => {
    for (const p of ["/", "/en", "/en/mithai", "/hi/gifts/box-1", "/en/cart", "/kn/stories", "/en/help/contact", null, undefined, ""]) {
      expect(isHotjarExcluded(p as string | null | undefined)).toBe(false);
    }
  });
  it("does not confuse similar names", () => {
    expect(isHotjarExcluded("/en/accounting")).toBe(false);
    expect(isHotjarExcluded("/checkout-tips")).toBe(false);
  });
});

describe("hotjarSnippet", () => {
  it("embeds the validated id only", () => {
    const s = hotjarSnippet("1234567");
    expect(s).toContain("hjid:1234567,hjsv:6");
    expect(s).toContain("https://static.hotjar.com/c/hotjar-");
    expect(hotjarSnippet("1234;alert(1)")).toBe("");
    expect(hotjarSnippet("")).toBe("");
  });
});
