import { describe, it, expect } from "vitest";
import { routing } from "@/i18n/routing";

describe("routing locales", () => {
  it("supports only en, hi, kn", () => {
    expect(routing.locales).toEqual(["en", "hi", "kn"]);
  });

  it("defaults to en", () => {
    expect(routing.defaultLocale).toBe("en");
  });
});
