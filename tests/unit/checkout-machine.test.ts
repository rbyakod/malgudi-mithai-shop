// tests/unit/checkout-machine.test.ts
// The checkout's decision layer (lib/web/checkoutMachine) — the payment
// sequence create-order → widget → verify and every failure path the UI
// has to speak to, plus the fresh-tier slot ladder (Android
// CheckoutViewModel parity) and the idempotency discipline:
//   - stale snapshot (422 VALIDATION) → revalidate once → create retried
//     with a FRESH key (server caches responses per key),
//   - once created, the create key + body are replayed on retry so the
//     idempotency cache returns the SAME order (no duplicate pendings),
//   - verify always gets a fresh key.

import {describe, it, expect} from "vitest";
import {
  buildSlotChoices,
  initialPaymentState,
  runPayment,
  CheckoutStepError,
  type CheckoutDeps,
  type CreateOrderResult,
  type PaymentState,
  type WidgetOutcome,
} from "@/lib/web/checkoutMachine";

const CREATED: CreateOrderResult = {
  orderId: "order-1",
  razorpayOrderId: "order_rzp_1",
  amountInPaise: 115800,
  keyId: "rzp_test_keyid",
};

const WIDGET_OK: WidgetOutcome = {
  kind: "ok",
  paymentId: "pay_123",
  signature: "sig_123",
};

type Calls = {
  create: Array<{input: unknown; key: string}>;
  verify: Array<{input: unknown; key: string}>;
  opens: number;
  revalidates: number;
};

function makeDeps(overrides?: {
  create?: CheckoutDeps["createOrder"];
  widget?: () => WidgetOutcome;
  verify?: CheckoutDeps["verifyPayment"];
  revalidate?: CheckoutDeps["revalidate"];
}): {deps: CheckoutDeps; calls: Calls} {
  const calls: Calls = {create: [], verify: [], opens: 0, revalidates: 0};
  let keySeq = 0;
  const deps: CheckoutDeps = {
    createOrder: overrides?.create ?? (async (input, key) => {
      calls.create.push({input, key});
      return CREATED;
    }),
    verifyPayment: overrides?.verify ?? (async (input, key) => {
      calls.verify.push({input, key});
      return {order: {}};
    }),
    openCheckout: async () => {
      calls.opens += 1;
      return overrides?.widget ? overrides.widget() : WIDGET_OK;
    },
    revalidate: overrides?.revalidate ?? (async () => {
      calls.revalidates += 1;
      return "snapshot-2";
    }),
    newIdempotencyKey: () => `key-${++keySeq}`,
  };
  return {deps, calls};
}

function validationError(): CheckoutStepError {
  // Expired snapshot / no payable total — the two create-order 422s.
  return new CheckoutStepError("Cart snapshot has expired", "VALIDATION", 422);
}

describe("buildSlotChoices", () => {
  it("returns today + tomorrow × morning + evening in Android's windows", () => {
    const choices = buildSlotChoices(new Date("2026-08-16T02:30:00Z"));
    expect(choices).toHaveLength(4);
    expect(choices.map((c) => [c.date, c.window, c.offsetDay])).toEqual([
      ["2026-08-16", "10:00-14:00", 0],
      ["2026-08-16", "16:00-20:00", 0],
      ["2026-08-17", "10:00-14:00", 1],
      ["2026-08-17", "16:00-20:00", 1],
    ]);
  });

  it("rolls the IST calendar day across month boundaries", () => {
    // 2026-12-31 20:30 UTC = 2027-01-01 02:00 IST — "today" is Jan 1.
    const choices = buildSlotChoices(new Date("2026-12-31T20:30:00Z"));
    expect(choices[0]!.date).toBe("2027-01-01");
    expect(choices[2]!.date).toBe("2027-01-02");
  });
});

describe("runPayment", () => {
  it("happy path: create → widget → verify → confirmed", async () => {
    const {deps, calls} = makeDeps();
    const {state, outcome} = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );

    expect(outcome).toEqual({
      kind: "confirmed",
      orderId: "order-1",
      razorpayPaymentId: "pay_123",
    });
    expect(calls.create).toHaveLength(1);
    expect(calls.create[0]!.input).toEqual({
      snapshotId: "snapshot-1",
      deliveryAddressId: "addr-1",
    });
    // Verify posts the widget's payment id + signature with its own key.
    expect(calls.verify[0]!.input).toEqual({
      orderId: "order-1",
      razorpayPaymentId: "pay_123",
      signature: "sig_123",
    });
    expect(calls.verify[0]!.key).not.toBe(calls.create[0]!.key);
    // State remembers the created order for retries.
    expect(state.created).toEqual(CREATED);
    expect(state.createIdempotencyKey).toBe(calls.create[0]!.key);
  });

  it("stale snapshot: revalidates once and retries create with a FRESH key", async () => {
    let createAttempts = 0;
    const {deps, calls} = makeDeps({
      create: async (input, key) => {
        createAttempts += 1;
        calls.create.push({input, key});
        if (createAttempts === 1) throw validationError();
        return CREATED;
      },
    });

    const {outcome} = await runPayment(
      deps,
      initialPaymentState("snapshot-stale", "addr-1"),
    );

    expect(outcome.kind).toBe("confirmed");
    expect(calls.revalidates).toBe(1);
    expect(calls.create).toHaveLength(2);
    expect(calls.create[1]!.input).toEqual({
      snapshotId: "snapshot-2",
      deliveryAddressId: "addr-1",
    });
    // New key on the retry — the 422 is cached under the failed key.
    expect(calls.create[1]!.key).not.toBe(calls.create[0]!.key);
  });

  it("revalidate failure surfaces as cart-changed (not retry-payment)", async () => {
    const {deps} = makeDeps({
      create: async () => {
        throw validationError();
      },
      revalidate: async () => {
        throw new CheckoutStepError(
          "Kaju Katli is not priced for online ordering",
          "VALIDATION",
          422,
        );
      },
    });

    const {outcome} = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );
    expect(outcome.kind).toBe("cart-changed");
  });

  it("dismissal keeps the created order and does NOT create a duplicate on retry", async () => {
    const {deps, calls} = makeDeps({
      widget: () => ({kind: "dismissed"}),
    });

    const first = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );
    expect(first.outcome).toEqual({kind: "retryable", reason: "dismissed"});
    expect(first.state.created).toEqual(CREATED);

    // Customer hits "Try payment again" — the machine replays the SAME
    // create key + body (server idempotency cache returns this order).
    const second = await runPayment(deps, first.state);
    expect(second.outcome).toEqual({kind: "retryable", reason: "dismissed"});
    expect(calls.create).toHaveLength(2);
    expect(calls.create[1]!.key).toBe(calls.create[0]!.key);
    expect(calls.create[1]!.input).toEqual(calls.create[0]!.input);
  });

  it("payment.failed event maps to retryable payment-failed", async () => {
    const {deps} = makeDeps({
      widget: () => ({
        kind: "failed",
        code: "BAD_REQUEST_ERROR",
        description: "Payment failed",
      }),
    });
    const {outcome} = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );
    expect(outcome).toEqual({
      kind: "retryable",
      reason: "payment-failed",
      message: "Payment failed",
    });
  });

  it("script load failure maps to retryable script", async () => {
    const {deps} = makeDeps({widget: () => ({kind: "script"})});
    const {outcome} = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );
    expect(outcome).toEqual({kind: "retryable", reason: "script"});
  });

  it("verify rejection keeps the order for an idempotent retry", async () => {
    let verifyAttempts = 0;
    const {deps, calls} = makeDeps({
      verify: async (input, key) => {
        verifyAttempts += 1;
        calls.verify.push({input, key});
        if (verifyAttempts === 1) {
          throw new CheckoutStepError(
            "Signature verification failed",
            "PAYMENT_FAILED",
            402,
          );
        }
        return {order: {}};
      },
    });

    const first = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );
    expect(first.outcome).toEqual({
      kind: "retryable",
      reason: "verify-failed",
      message: "Signature verification failed",
    });
    expect(first.state.created).toEqual(CREATED);

    // Retry: create replays the cached success (same key) and verify runs
    // again under a FRESH key (its failure was cached under the old one).
    const second = await runPayment(deps, first.state);
    expect(second.outcome.kind).toBe("confirmed");
    expect(calls.create[1]!.key).toBe(calls.create[0]!.key);
    expect(calls.verify).toHaveLength(2);
    expect(calls.verify[1]!.key).not.toBe(calls.verify[0]!.key);
  });

  it("non-VALIDATION create errors are retryable create-failed (no revalidate)", async () => {
    const {deps, calls} = makeDeps({
      create: async () => {
        throw new CheckoutStepError("Razorpay down", "INTERNAL", 500);
      },
    });
    const {outcome} = await runPayment(
      deps,
      initialPaymentState("snapshot-1", "addr-1"),
    );
    expect(outcome).toEqual({
      kind: "retryable",
      reason: "create-failed",
      message: "Razorpay down",
    });
    expect(calls.revalidates).toBe(0);
  });

  it("an explicit prior state with created order skips a fresh create", async () => {
    const {deps, calls} = makeDeps();
    const prior: PaymentState = {
      snapshotId: "snapshot-1",
      deliveryAddressId: "addr-1",
      createIdempotencyKey: "key-prior",
      created: CREATED,
    };
    const {outcome} = await runPayment(deps, prior);
    expect(outcome.kind).toBe("confirmed");
    expect(calls.create).toHaveLength(1);
    expect(calls.create[0]!.key).toBe("key-prior");
  });
});
