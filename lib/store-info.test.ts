// lib/store-info.test.ts
import {describe, it, expect} from "vitest";
import {fullAddress, primaryStoreFrom} from "./store-info";

describe("primaryStoreFrom", () => {
  it("returns null when nothing is set", () => {
    expect(primaryStoreFrom(null)).toBeNull();
    expect(primaryStoreFrom({})).toBeNull();
    expect(primaryStoreFrom({stores: []})).toBeNull();
    expect(primaryStoreFrom({stores: [{name: "Empty", hours: "9-5"}]})).toBeNull();
  });
  it("uses the first store that has a city or an address, trimmed", () => {
    const s = primaryStoreFrom({
      stores: [{name: "  "}, {name: " Mishran ", city: " Delhi ", state: "Delhi", postalCode: "110009", address: " Main Market ", hours: ""}, {city: "Pune"}],
    });
    expect(s).toEqual({name: "Mishran", city: "Delhi", state: "Delhi", postalCode: "110009", address: "Main Market", hours: ""});
  });
  it("ignores values that are not text", () => {
    expect(primaryStoreFrom({stores: [{city: 5, address: "X"}]})).toEqual({name: "", city: "", state: "", postalCode: "", address: "X", hours: ""});
  });
});

describe("fullAddress", () => {
  it("joins the parts that exist", () => {
    expect(fullAddress({name: "", city: "Delhi", state: "Delhi", postalCode: "110009", address: "H-4/3, Model Town", hours: ""})).toBe("H-4/3, Model Town, Delhi, Delhi 110009");
    expect(fullAddress({name: "", city: "Delhi", state: "", postalCode: "", address: "", hours: ""})).toBe("Delhi");
  });
});
