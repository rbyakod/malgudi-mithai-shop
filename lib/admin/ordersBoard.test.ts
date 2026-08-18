// lib/admin/ordersBoard.test.ts
// Unit tests for the orders-board pure helpers — Task 5.4.
import { describe, it, expect } from "vitest";
import {
  BOARD_COLUMNS,
  columnForStatus,
  canAdvance,
  STATUS_LABEL,
  buildOrdersWhere,
  queryLooksLikePhone,
  isCashToCollect,
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

// --- known-gaps B13: console filter -> query helpers ----------------------

describe("ordersBoard.queryLooksLikePhone", () => {
  it("accepts phone-shaped queries", () => {
    expect(queryLooksLikePhone("+918088983014")).toBe(true);
    expect(queryLooksLikePhone("8088983014")).toBe(true);
    expect(queryLooksLikePhone("80889 83014")).toBe(true);
  });

  it("rejects order ids and free text", () => {
    expect(queryLooksLikePhone("6a83ff95e2c8")).toBe(false);
    expect(queryLooksLikePhone("TEST100")).toBe(false);
    expect(queryLooksLikePhone("")).toBe(false);
  });
});

describe("ordersBoard.buildOrdersWhere", () => {
  it("returns an empty where for no filters", () => {
    expect(buildOrdersWhere({})).toEqual({});
  });

  it("maps each console filter to an equals clause", () => {
    const where = buildOrdersWhere({
      status: "confirmed",
      paymentMethod: "cod",
      paymentStatus: "pending",
      source: "web",
    });
    expect(where).toEqual({
      and: [
        { status: { equals: "confirmed" } },
        { paymentMethod: { equals: "cod" } },
        { paymentStatus: { equals: "pending" } },
        { source: { equals: "web" } },
      ],
    });
  });

  it("maps date bounds to createdAt range clauses", () => {
    const where = buildOrdersWhere({ from: "2026-08-01", to: "2026-08-17" });
    expect(where).toEqual({
      and: [
        { createdAt: { greater_than_equal: "2026-08-01" } },
        { createdAt: { less_than_equal: "2026-08-17" } },
      ],
    });
  });

  it("treats non-phone q as an order id equality", () => {
    const where = buildOrdersWhere({ q: "6a83ff95e2c8379b4140530c" });
    expect(where).toEqual({ and: [{ id: { equals: "6a83ff95e2c8379b4140530c" } }] });
  });

  it("scopes phone q to the resolved customer ids", () => {
    const where = buildOrdersWhere({ q: "8088983014" }, ["cust-1", "cust-2"]);
    expect(where).toEqual({ and: [{ customerId: { in: ["cust-1", "cust-2"] } }] });
  });

  it("combines filters with a phone q", () => {
    const where = buildOrdersWhere(
      { paymentMethod: "cod", q: "8088983014" },
      ["cust-1"],
    );
    expect(where).toEqual({
      and: [
        { paymentMethod: { equals: "cod" } },
        { customerId: { in: ["cust-1"] } },
      ],
    });
  });
});

describe("ordersBoard.isCashToCollect", () => {
  it("is true only for COD orders with payment pending", () => {
    expect(isCashToCollect({ paymentMethod: "cod", paymentStatus: "pending" })).toBe(true);
    expect(isCashToCollect({ paymentMethod: "cod", paymentStatus: "paid" })).toBe(false);
    expect(isCashToCollect({ paymentMethod: "razorpay", paymentStatus: "pending" })).toBe(false);
    expect(isCashToCollect({})).toBe(false);
    expect(isCashToCollect({ paymentMethod: null, paymentStatus: null })).toBe(false);
  });
});
