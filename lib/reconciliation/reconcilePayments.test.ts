// lib/reconciliation/reconcilePayments.test.ts
// Tests for the orphan-payment reconciliation loop — Task 4.7.
//
// Strategy: mock `payload`'s getPayload to return an in-memory store
// (orders + payments collections, plus minimal find/update/findByID
// semantics). Mock the container's paymentService so fetchStatusByOrder
// returns whatever the test sets. The container's logger is replaced
// with a no-op so test output stays clean.
//
// Coverage:
//   - happy path: stale 'created' -> Razorpay 'captured' -> payment +
//     order updated + order transitioned to confirmed.
//   - 'failed' from provider -> payment marked failed, order untouched.
//   - 'created' from provider (still pending) -> no writes.
//   - fetchStatusByOrder throws -> error logged, other payments still
//     processed, summary.errors incremented.
//   - missing providerOrderId on payment row -> skipped, logged.
//   - row captured by webhook between query and update -> race handled,
//     no double-transition.
//   - empty stale set -> 200-shaped summary, no side effects.
//   - cutoff filter excludes fresh payments.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock state — vi.mock factories run before any top-level
// declarations in the test file, so the maps + spies must live inside
// vi.hoisted to be visible to the factory closures.
const hoisted = vi.hoisted(() => {
  const storesBox = { current: { payments: new Map(), orders: new Map() } };
  const fetchBox = { current: null as unknown as ReturnType<typeof vi.fn> };
  type LogShape = {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
  };
  const loggerBox: { current: LogShape } = {
    current: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    },
  };
  loggerBox.current.child = vi.fn(() => loggerBox.current);
  return { storesBox, fetchBox, loggerBox };
});

interface PaymentRow {
  id: string;
  orderId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: string;
  amountInPaise: number;
  currency: string;
  createdAt: string;
}

interface OrderRow {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  razorpayOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

vi.mock("payload", () => ({
  // payload.config.ts calls buildConfig at module load; return a no-op
  // passthrough so importing the config doesn't drag in real Payload.
  buildConfig: (cfg: unknown) => cfg,
  getPayload: vi.fn(async () => {
    const { payments, orders } = hoisted.storesBox.current;
    return {
      find: vi.fn(
        async ({
          collection,
          where,
          limit,
        }: {
          collection: string;
          where?: Record<string, unknown>;
          limit?: number;
        }) => {
          if (collection === "payments") {
            let docs = Array.from(payments.values());
            const statusEq = (where?.status as { equals?: string } | undefined)
              ?.equals;
            const createdAtLt = (
              where?.createdAt as { less_than?: string } | undefined
            )?.less_than;
            if (statusEq !== undefined)
              docs = docs.filter((d) => d.status === statusEq);
            if (createdAtLt !== undefined)
              docs = docs.filter((d) => d.createdAt < createdAtLt);
            const l = limit ?? 100;
            return { docs: docs.slice(0, l), totalDocs: docs.length };
          }
          if (collection === "shipments") {
            return { docs: [], totalDocs: 0 };
          }
          if (collection === "orders") {
            const docs = Array.from(orders.values());
            return { docs, totalDocs: docs.length };
          }
          throw new Error(`find: unknown collection ${collection}`);
        },
      ),
      findByID: vi.fn(
        async ({ collection, id }: { collection: string; id: string }) => {
          if (collection === "payments") {
            const doc = payments.get(id);
            if (!doc) {
              const err = new Error("not found");
              (err as { statusCode?: number }).statusCode = 404;
              throw err;
            }
            return doc;
          }
          if (collection === "orders") {
            const doc = orders.get(id);
            if (!doc) {
              const err = new Error("not found");
              (err as { statusCode?: number }).statusCode = 404;
              throw err;
            }
            return doc;
          }
          throw new Error(`findByID: unknown collection ${collection}`);
        },
      ),
      update: vi.fn(
        async ({
          collection,
          id,
          data,
        }: {
          collection: string;
          id: string;
          data: Record<string, unknown>;
        }) => {
          if (collection === "payments") {
            const doc = payments.get(id);
            if (!doc) throw new Error("payment missing");
            const updated = { ...doc, ...data } as PaymentRow;
            payments.set(id, updated);
            return updated;
          }
          if (collection === "orders") {
            const doc = orders.get(id);
            if (!doc) throw new Error("order missing");
            const updated = {
              ...doc,
              ...data,
              updatedAt: new Date().toISOString(),
            } as OrderRow;
            orders.set(id, updated);
            return updated;
          }
          throw new Error(`update: unknown collection ${collection}`);
        },
      ),
      create: vi.fn(
        async ({
          collection,
          data,
        }: {
          collection: string;
          data: Record<string, unknown>;
        }) => {
          if (collection === "shipments") {
            return { id: `ship-${Math.random()}`, ...data };
          }
          throw new Error(`create: unknown collection ${collection}`);
        },
      ),
    };
  }),
}));

vi.mock("../../../payload.config", () => ({ default: {} }));

vi.mock("../container", () => ({
  container: {
    paymentService: {
      get fetchStatusByOrder() {
        return hoisted.fetchBox.current;
      },
    },
    get logger() {
      return hoisted.loggerBox.current;
    },
  },
}));

import { reconcilePayments } from "./reconcilePayments";

// Test-side refs to the maps so assertions don't go through the mock layer.
function paymentsForTest() {
  return hoisted.storesBox.current.payments as Map<string, PaymentRow>;
}
function ordersForTest() {
  return hoisted.storesBox.current.orders as Map<string, OrderRow>;
}

let nextPayId = 1;
let nextOrderId = 1;

// Seed an order + its payment row. Default createdAt = 30 min ago so the
// row is past the 15-min cutoff.
function seed(over: Partial<PaymentRow> & { orderStatus?: string } = {}) {
  const orderId = `order-${nextOrderId++}`;
  const payId = `pay-${nextPayId++}`;
  const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  ordersForTest().set(orderId, {
    id: orderId,
    customerId: "cust-1",
    status: over.orderStatus ?? "pending_payment",
    paymentStatus: "pending",
    createdAt,
    updatedAt: createdAt,
  });
  paymentsForTest().set(payId, {
    id: payId,
    orderId,
    providerOrderId: `order_rp_${payId}`,
    status: "created",
    amountInPaise: 85000,
    currency: "INR",
    createdAt,
    ...over,
  });
  return { orderId, payId };
}

describe("reconcilePayments", () => {
  beforeEach(() => {
    // Fresh stores + spies for each test.
    hoisted.storesBox.current = {
      payments: new Map(),
      orders: new Map(),
    };
    hoisted.fetchBox.current = vi.fn();
    const freshLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    freshLogger.child = vi.fn(() => freshLogger);
    hoisted.loggerBox.current = freshLogger;
    nextPayId = 1;
    nextOrderId = 1;
  });

  it("returns a zero summary when there are no stale payments", async () => {
    const result = await reconcilePayments();
    expect(result).toEqual({
      inspected: 0,
      captured: 0,
      failed: 0,
      pending: 0,
      errors: 0,
    });
    expect(hoisted.fetchBox.current).not.toHaveBeenCalled();
  });

  it("excludes payments newer than the cutoff", async () => {
    const fresh = new Date(Date.now() - 60 * 1000).toISOString();
    paymentsForTest().set("pay-fresh", {
      id: "pay-fresh",
      orderId: "order-1",
      providerOrderId: "order_rp_fresh",
      status: "created",
      amountInPaise: 100,
      currency: "INR",
      createdAt: fresh,
    });
    const result = await reconcilePayments();
    expect(result.inspected).toBe(0);
    expect(hoisted.fetchBox.current).not.toHaveBeenCalled();
  });

  describe("happy path: provider reports captured", () => {
    it("updates payment + order, transitions order to confirmed, backfills providerPaymentId", async () => {
      const { orderId, payId } = seed();
      hoisted.fetchBox.current.mockResolvedValueOnce({
        status: "captured",
        providerPaymentId: "pay_rp_xyz",
      });

      const result = await reconcilePayments();

      expect(result).toEqual({
        inspected: 1,
        captured: 1,
        failed: 0,
        pending: 0,
        errors: 0,
      });
      const pay = paymentsForTest().get(payId)!;
      expect(pay.status).toBe("captured");
      expect(pay.providerPaymentId).toBe("pay_rp_xyz");
      const order = ordersForTest().get(orderId)!;
      expect(order.paymentStatus).toBe("paid");
      expect(order.status).toBe("confirmed");
      expect(hoisted.loggerBox.current.error).not.toHaveBeenCalled();
    });
  });

  describe("provider reports failed", () => {
    it("updates payment status to failed, leaves order status alone", async () => {
      const { orderId, payId } = seed();
      hoisted.fetchBox.current.mockResolvedValueOnce({
        status: "failed",
        providerPaymentId: "pay_rp_fail",
      });

      const result = await reconcilePayments();

      expect(result.failed).toBe(1);
      expect(result.captured).toBe(0);
      const pay = paymentsForTest().get(payId)!;
      expect(pay.status).toBe("failed");
      const order = ordersForTest().get(orderId)!;
      expect(order.status).toBe("pending_payment");
      expect(order.paymentStatus).toBe("pending");
    });
  });

  describe("provider reports still pending (created)", () => {
    it("leaves the payment row untouched, counts as pending", async () => {
      const { payId } = seed();
      hoisted.fetchBox.current.mockResolvedValueOnce({
        status: "created",
      });

      const result = await reconcilePayments();

      expect(result.pending).toBe(1);
      expect(result.captured).toBe(0);
      expect(result.failed).toBe(0);
      const pay = paymentsForTest().get(payId)!;
      expect(pay.status).toBe("created");
    });
  });

  describe("fetchStatusByOrder throws", () => {
    it("logs the error, increments errors, continues to next payment", async () => {
      const a = seed();
      const b = seed();
      hoisted.fetchBox.current
        .mockRejectedValueOnce(new Error("network down"))
        .mockResolvedValueOnce({
          status: "captured",
          providerPaymentId: "pay_rp_b",
        });

      const result = await reconcilePayments();

      expect(result.inspected).toBe(2);
      expect(result.errors).toBe(1);
      expect(result.captured).toBe(1);
      // First payment row unchanged.
      expect(paymentsForTest().get(a.payId)!.status).toBe("created");
      // Second payment row captured.
      expect(paymentsForTest().get(b.payId)!.status).toBe("captured");
      expect(hoisted.loggerBox.current.error).toHaveBeenCalled();
    });
  });

  describe("payment row has no providerOrderId", () => {
    it("skips with a warning, counts as pending", async () => {
      seed({ providerOrderId: undefined });
      const result = await reconcilePayments();
      expect(result.pending).toBe(1);
      expect(result.inspected).toBe(1);
      expect(hoisted.fetchBox.current).not.toHaveBeenCalled();
      expect(hoisted.loggerBox.current.warn).toHaveBeenCalled();
    });
  });

  describe("race: webhook captures the row between query and update", () => {
    it("detects the row is no longer 'created' and skips", async () => {
      const { payId, orderId } = seed();
      // Simulate the webhook landing during the fetchStatusByOrder call:
      // by the time reconcile re-reads the row, it's already captured.
      hoisted.fetchBox.current.mockImplementationOnce(async () => {
        paymentsForTest().get(payId)!.status = "captured";
        return { status: "captured", providerPaymentId: "pay_rp_race" };
      });

      const result = await reconcilePayments();
      expect(result.pending).toBe(1);
      expect(result.captured).toBe(0);
      // Order NOT transitioned.
      expect(ordersForTest().get(orderId)!.status).toBe("pending_payment");
    });
  });

  describe("race: webhook transitions order before our transition()", () => {
    it("catches INVALID_STATE_TRANSITION and treats it as success", async () => {
      const { payId, orderId } = seed();
      hoisted.fetchBox.current.mockResolvedValueOnce({
        status: "captured",
        providerPaymentId: "pay_rp_late",
      });

      // Simulate the webhook firing between our payment-row update and
      // our transition() call: pre-emptively move the order to confirmed
      // BEFORE reconcile runs, so transition()'s findByID sees status
      // 'confirmed' and rejects with INVALID_STATE_TRANSITION.
      ordersForTest().get(orderId)!.status = "confirmed";

      const result = await reconcilePayments();
      expect(result.captured).toBe(1);
      expect(paymentsForTest().get(payId)!.status).toBe("captured");
      expect(hoisted.loggerBox.current.info).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: payId,
          orderId,
        }),
        expect.stringContaining("already past pending_payment"),
      );
    });
  });

  describe("unexpected provider status (e.g. refunded on a created local row)", () => {
    it("skips with a warning, counts as pending", async () => {
      seed();
      hoisted.fetchBox.current.mockResolvedValueOnce({
        status: "refunded",
        providerPaymentId: "pay_rp_weird",
      });
      const result = await reconcilePayments();
      expect(result.pending).toBe(1);
      expect(result.captured).toBe(0);
      expect(result.failed).toBe(0);
      expect(hoisted.loggerBox.current.warn).toHaveBeenCalled();
    });
  });
});
