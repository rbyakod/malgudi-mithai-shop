// tests/unit/razorpay-display-config.test.ts
// B14 UPI rail — the checkout.js `config.display` shape that restricts the
// Razorpay widget to a single method. The key names are the contract with
// Razorpay's "Configure Payment Methods" sample code (2026-08); this test
// pins them so a refactor can't silently break the restriction and fall
// back to the full payment sheet.

import {describe, it, expect} from "vitest";
import {methodOnlyDisplayConfig} from "@/lib/web/razorpay";

describe("methodOnlyDisplayConfig", () => {
  it("builds a single-block display config that hides the default blocks", () => {
    expect(methodOnlyDisplayConfig("upi")).toEqual({
      display: {
        blocks: {
          only: {
            name: "Pay via UPI",
            instruments: [{method: "upi"}],
          },
        },
        sequence: ["block.only"],
        preferences: {show_default_blocks: false},
      },
    });
  });

  it("uses the method as the instrument, not a hand-rolled UPI link", () => {
    const config = methodOnlyDisplayConfig("upi");
    const instruments = config.display.blocks.only.instruments;
    expect(instruments).toEqual([{method: "upi"}]);
    // Hard rule (B14): no upi://pay links, no static VPAs, ever.
    expect(JSON.stringify(config)).not.toContain("upi://");
    expect(JSON.stringify(config)).not.toMatch(/@\w+bank/);
  });
});
