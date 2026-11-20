import {describe, it, expect} from "vitest";
import {splitPriceLabel} from "@/lib/ms-price";

describe("splitPriceLabel", () => {
  it("splits figures from the unit", () => {
    expect(splitPriceLabel("₹840 / 1 kg")).toEqual({amount: "840", unit: "/ 1 kg"});
    expect(splitPriceLabel("₹ 1,300/kg")).toEqual({amount: "1,300", unit: "/ kg"});
  });

  it("keeps a bare price with no unit", () => {
    expect(splitPriceLabel("₹455")).toEqual({amount: "455", unit: ""});
  });

  it("returns null when there is no figure", () => {
    expect(splitPriceLabel("₹ on request / pack")).toBeNull();
    expect(splitPriceLabel("")).toBeNull();
  });
});
