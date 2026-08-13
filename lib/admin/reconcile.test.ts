// lib/admin/reconcile.test.ts
// Reconciliation logic tests — Task 5.5.
import { describe, it, expect } from "vitest";
import { parseSettlementCsv, reconcile, type PaymentDoc } from "./reconcile";

describe("parseSettlementCsv", () => {
  it("parses payment id + rupee amounts into paise", () => {
    const csv = "payment id,amount\npay_1,199.00\npay_2,500.50";
    const out = parseSettlementCsv(csv);
    expect(out).toEqual([
      { providerPaymentId: "pay_1", amountInPaise: 19900 },
      { providerPaymentId: "pay_2", amountInPaise: 50050 },
    ]);
  });

  it("handles paise-integer amounts and variant headers (pay_id)", () => {
    const csv = "pay_id,amount_in_paise\npay_9,19900";
    expect(parseSettlementCsv(csv)).toEqual([
      { providerPaymentId: "pay_9", amountInPaise: 19900 },
    ]);
  });

  it("tolerates quoted fields with embedded commas and CRLF", () => {
    const csv = "payment id,note\r\n\"pay_x\",\"hello, world\"\r\n";
    const out = parseSettlementCsv(csv);
    expect(out).toEqual([{ providerPaymentId: "pay_x", amountInPaise: 0 }]);
  });

  it("returns [] for empty / header-only / no-id-column input", () => {
    expect(parseSettlementCsv("")).toEqual([]);
    expect(parseSettlementCsv("foo,bar")).toEqual([]);
    expect(parseSettlementCsv("only,header\n")).toEqual([]);
  });
});

describe("reconcile", () => {
  const payments: PaymentDoc[] = [
    { id: "p1", orderId: "o1", providerPaymentId: "pay_A", status: "captured", amountInPaise: 10000 },
    { id: "p2", orderId: "o2", providerPaymentId: "pay_B", status: "captured", amountInPaise: 20000 },
    { id: "p3", orderId: "o3", providerPaymentId: "pay_C", status: "pending", amountInPaise: 30000 },
  ];

  it("classifies matched, captured-unsettled, and orphan-settlement rows", () => {
    const settlement = parseSettlementCsv("payment id,amount\npay_A,100.00\npay_Z,999.00");
    const rows = reconcile(payments, settlement);
    const byClass = Object.fromEntries(rows.map((r) => [r.classification, r]));
    // pay_A captured + in settlement -> matched
    expect(byClass.matched.providerPaymentId).toBe("pay_A");
    // pay_B captured, not in settlement -> captured_unsettled
    expect(byClass.captured_unsettled.providerPaymentId).toBe("pay_B");
    // pay_Z in settlement, no captured doc -> orphan_settlement
    expect(byClass.orphan_settlement.providerPaymentId).toBe("pay_Z");
  });

  it("ignores non-captured payments", () => {
    const rows = reconcile(payments, []);
    expect(rows.every((r) => r.providerPaymentId !== "pay_C")).toBe(true);
  });
});
