/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { HomeHero } from "@/globals/HomeHero";

describe("HomeHero global", () => {
  it("uses slug home-hero", () => {
    expect(HomeHero.slug).toBe("home-hero");
  });

  it("is publicly readable", () => {
    expect(HomeHero.access?.read).toBeTypeOf("function");
    // read must return true for anon
    expect((HomeHero.access as any).read({ req: {} } as any)).toBe(true);
  });

  it("has slides array field with polymorphic product relationship", () => {
    const slidesField = HomeHero.fields.find(
      (f: any) => f.name === "slides"
    );
    expect(slidesField).toBeDefined();
    expect(slidesField!.type).toBe("array");

    // @ts-expect-error - testing internal field structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const productField = slidesField!.fields.find(
      (f: any) => f.name === "product"
    );
    expect(productField.type).toBe("relationship");
    expect(productField.relationTo).toEqual([
      "mithai-products",
      "qsr-menu-items",
      "snack-products",
      "merch-products",
      "gift-boxes",
    ]);
    expect(productField.required).toBe(true);
  });

  it("has optional captionOverride per slide", () => {
    const slidesField = HomeHero.fields.find(
      (f: any) => f.name === "slides"
    );
    // @ts-expect-error - testing internal field structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const captionField = slidesField!.fields.find(
      (f: any) => f.name === "captionOverride"
    );
    expect(captionField.type).toBe("text");
    expect(captionField.required).toBeFalsy();
  });

  it("caps slides at 12 rows", () => {
    const slidesField = HomeHero.fields.find(
      (f: any) => f.name === "slides"
    ) as any;
    expect(slidesField.maxRows).toBe(12);
  });

  it("has an editorial autoplayMs field with sane bounds + default", () => {
    const field = HomeHero.fields.find((f: any) => f.name === "autoplayMs") as any;
    expect(field).toBeDefined();
    expect(field.type).toBe("number");
    expect(field.defaultValue).toBe(5000);
    expect(field.min).toBe(3000);
    expect(field.max).toBe(15000);
  });
});
