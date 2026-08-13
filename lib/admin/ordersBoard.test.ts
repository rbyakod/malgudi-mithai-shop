// lib/admin/ordersBoard.test.ts
// Unit tests for the orders-board pure helpers — Task 5.4.
import { describe, it, expect } from "vitest";
import {
  BOARD_COLUMNS,
  columnForStatus,
  canAdvance,
  STATUS_LABEL,
} from "./ordersBoard";
import type { OrderStatus } from "../commerce/types";
import { ORDER_TRANSITIONS } from "../commerce/types";

describe("ordersBoard.columnForStatus", () => {
  it("maps each fulfillment stage to its own column", () => {
    for (const col of BOARD_COLUMNS) {
      expect(columnForStatus(col)).toBe(col);
    }
  });

  it("buckets terminal failure states into 'blocked'", () => {
    expect(columnForStatus("cancelled")).toBe("blocked");
    expect(columnForStatus("payment_failed")).toBe("blocked");
    expect(columnForStatus("failed_delivery")).toBe("blocked");
    expect(columnForStatus("returned")).toBe("blocked");
  });

  it("hides pre-payment states (not yet ops-actionable)", () => {
    expect(columnForStatus("created")).toBeNull();
    expect(columnForStatus("pending_payment")).toBeNull();
  });
});

describe("ordersBoard.canAdvance", () => {
  it("permits only transitions the backend state machine allows", () => {
    // Spot-check the happy forward path.
    expect(canAdvance("confirmed", "packed")).toBe(true);
    expect(canAdvance("packed", "dispatched")).toBe(true);
    expect(canAdvance("dispatched", "out_for_delivery")).toBe(true);
    expect(canAdvance("out_for_delivery", "delivered")).toBe(true);
  });

  it("rejects skipped or backward transitions", () => {
    expect(canAdvance("confirmed", "delivered")).toBe(false);
    expect(canAdvance("delivered", "confirmed")).toBe(false);
    expect(canAdvance("packed", "out_for_delivery")).toBe(false);
  });

  it("matches ORDER_TRANSITIONS for every status pair", () => {
    const all: OrderStatus[] = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];
    for (const from of all) {
      for (const to of all) {
        expect(canAdvance(from, to)).toBe(ORDER_TRANSITIONS[from].includes(to));
      }
    }
  });
});

describe("ordersBoard.STATUS_LABEL", () => {
  it("has a human label for every OrderStatus", () => {
    const all: OrderStatus[] = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];
    for (const s of all) {
      expect(typeof STATUS_LABEL[s]).toBe("string");
      expect(STATUS_LABEL[s].length).toBeGreaterThan(0);
    }
  });
});
