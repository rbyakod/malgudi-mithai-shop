// lib/loyalty/eligibility.test.ts
import { describe, it, expect } from "vitest";
import {
  tierForDeliveredCount,
  loyaltySerialNumber,
  LOYALTY_SILVER_MIN_DELIVERED,
  LOYALTY_GOLD_MIN_DELIVERED,
} from "./eligibility";

describe("tierForDeliveredCount", () => {
  it("returns null below the Silver threshold", () => {
    expect(tierForDeliveredCount(0)).toBeNull();
    expect(tierForDeliveredCount(1)).toBeNull();
  });

  it("returns silver from the Silver threshold up to (not incl) Gold", () => {
    expect(tierForDeliveredCount(LOYALTY_SILVER_MIN_DELIVERED)).toBe("silver");
    expect(tierForDeliveredCount(4)).toBe("silver");
  });

  it("returns gold at and above the Gold threshold", () => {
    expect(tierForDeliveredCount(LOYALTY_GOLD_MIN_DELIVERED)).toBe("gold");
    expect(tierForDeliveredCount(99)).toBe("gold");
  });
});

describe("loyaltySerialNumber", () => {
  it("is stable per customer + unique across customers", () => {
    expect(loyaltySerialNumber("cust-1")).toBe("mishran-loyalty-cust-1");
    expect(loyaltySerialNumber("cust-1")).toBe(loyaltySerialNumber("cust-1"));
    expect(loyaltySerialNumber("cust-2")).not.toBe(loyaltySerialNumber("cust-1"));
  });
});
