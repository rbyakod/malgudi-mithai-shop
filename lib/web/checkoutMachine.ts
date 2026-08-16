// lib/web/checkoutMachine.ts
// The checkout's pure decision layer — everything testable without React
// or a browser lives here:
//
//   1. buildSlotChoices — the fresh-tier delivery slots (today + tomorrow ×
//      morning + evening), mirroring the Android CheckoutViewModel's
//      buildSlotOptions (windows 10:00-14:00 / 16:00-20:00) so both
//      clients present the identical choice set.
//   2. runPayment — the create-order → Razorpay widget → verify sequence,
//      including the failure paths the UI has to speak to (dismissal,
//      payment failure, signature rejection, script load failure, stale
//      snapshot) and the idempotency discipline:
//        - create-order: one uuid per ATTEMPT. A 422 VALIDATION (expired
//          snapshot / no payable total) re-validates the cart once and
//          retries create-order with a FRESH key (errors are cached per
//          key server-side, so reusing the failed key would replay the
//          cached error forever).
//        - once an order IS created, its idempotency key + body are kept
//          in the returned state: a retry after dismissal/dismiss-style
//          failure replays the SAME key + body, which the server
//          short-circuits to the cached success — no duplicate pending
//          order. Only calls that errored get a new key.
//        - verify: fresh uuid per call (verify failures are cached per
//          key the same way).

// ---- Slots -------------------------------------------------------------------

export type SlotWindow = "10:00-14:00" | "16:00-20:00";

export type SlotChoice = {
  /** ISO yyyy-mm-dd in IST. */
  date: string;
  window: SlotWindow;
  /** 0 = today, 1 = tomorrow (labels are the component's i18n problem). */
  offsetDay: 0 | 1;
};

// en-CA yields ISO-style YYYY-MM-DD. IST has no DST, so a fixed 24h offset
// from "now" always lands on the right calendar day (month/year rollovers
// included) — same trick as lib/commerce/pricing.ts.
const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function istDate(now: Date, offsetDays: number): string {
  return istDateFormatter.format(new Date(now.getTime() + offsetDays * 86_400_000));
}

/** Fresh-tier slots: today + tomorrow × morning + evening (Android parity). */
export function buildSlotChoices(now: Date = new Date()): SlotChoice[] {
  return ([0, 1] as const).flatMap((offsetDay) =>
    (["10:00-14:00", "16:00-20:00"] as const).map((window) => ({
      date: istDate(now, offsetDay),
      window,
      offsetDay,
    })),
  );
}

// ---- Payment sequence ----------------------------------------------------------

export type CreateOrderResult = {
  orderId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  keyId: string;
};

export type OpenWidgetInput = {
  keyId: string;
  razorpayOrderId: string;
  amountInPaise: number;
};

export type WidgetOutcome =
  | {kind: "ok"; paymentId: string; signature: string}
  | {kind: "dismissed"}
  | {kind: "failed"; code?: string; description?: string}
  | {kind: "script"};

/** Error shape the machine understands — the component maps ApiClientError
 * (and anything else) onto it so this module stays fetch-free. */
export class CheckoutStepError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "CheckoutStepError";
    this.code = code;
    this.status = status;
  }
}

export type CheckoutDeps = {
  /** POST /payments/razorpay/create-order (throws CheckoutStepError). */
  createOrder(
    input: {snapshotId: string; deliveryAddressId: string},
    idempotencyKey: string,
  ): Promise<CreateOrderResult>;
  /** POST /payments/razorpay/verify (throws CheckoutStepError). */
  verifyPayment(
    input: {orderId: string; razorpayPaymentId: string; signature: string},
    idempotencyKey: string,
  ): Promise<unknown>;
  /** Open the Razorpay widget (script load + popup). */
  openCheckout(input: OpenWidgetInput): Promise<WidgetOutcome>;
  /** Re-run /cart/validate; resolves with the fresh snapshotId. */
  revalidate(): Promise<string>;
  newIdempotencyKey(): string;
};

/** Carried across retries so an already-created order is never duplicated. */
export type PaymentState = {
  snapshotId: string;
  deliveryAddressId: string;
  /** Key that successfully created the order (replayed verbatim on retry). */
  createIdempotencyKey: string | null;
  created: CreateOrderResult | null;
};

export function initialPaymentState(
  snapshotId: string,
  deliveryAddressId: string,
): PaymentState {
  return {
    snapshotId,
    deliveryAddressId,
    createIdempotencyKey: null,
    created: null,
  };
}

export type PaymentOutcome =
  | {kind: "confirmed"; orderId: string; razorpayPaymentId: string}
  | {
      kind: "retryable";
      reason:
        | "dismissed"
        | "payment-failed"
        | "verify-failed"
        | "create-failed"
        | "script";
      message?: string;
    }
  | {kind: "cart-changed"; message?: string};

/** True for the create-order errors that mean "your snapshot went stale —
 * re-validate and try again" (expired snapshot, zero/no payable total). */
function isStaleSnapshotError(err: unknown): boolean {
  return err instanceof CheckoutStepError && err.code === "VALIDATION";
}

async function createWithStaleSnapshotRetry(
  deps: CheckoutDeps,
  state: PaymentState,
): Promise<{created: CreateOrderResult; state: PaymentState}> {
  // Already created on a previous attempt — replay the same key + body so
  // the server's idempotency cache returns THIS order, not a new one.
  if (state.created && state.createIdempotencyKey) {
    return {
      created: await deps.createOrder(
        {
          snapshotId: state.snapshotId,
          deliveryAddressId: state.deliveryAddressId,
        },
        state.createIdempotencyKey,
      ),
      state,
    };
  }

  let key = deps.newIdempotencyKey();
  let snapshotId = state.snapshotId;
  try {
    const created = await deps.createOrder(
      {snapshotId, deliveryAddressId: state.deliveryAddressId},
      key,
    );
    return {
      created,
      state: {...state, snapshotId, created, createIdempotencyKey: key},
    };
  } catch (err) {
    if (!isStaleSnapshotError(err)) throw err;
    // Snapshot expired (10-minute TTL) or pre-pricing zero total — mint a
    // fresh one and retry ONCE. New key: the 422 is cached under the old
    // one server-side.
    try {
      snapshotId = await deps.revalidate();
    } catch (revalidateErr) {
      // The cart itself can no longer be validated (product gone /
      // unpriceable / pincode no longer serviceable) — tagged so the
      // outer handler routes it to "cart-changed", not "retry payment".
      const message =
        revalidateErr instanceof Error ? revalidateErr.message : undefined;
      throw new CheckoutStepError(
        message ?? "Cart could not be re-validated",
        "REVALIDATE_FAILED",
        422,
      );
    }
    key = deps.newIdempotencyKey();
    const created = await deps.createOrder(
      {snapshotId, deliveryAddressId: state.deliveryAddressId},
      key,
    );
    return {
      created,
      state: {...state, snapshotId, created, createIdempotencyKey: key},
    };
  }
}

/**
 * Drive one full payment attempt. Always resolves — never throws — so the
 * component can render every terminal state (the machine has no opinion
 * about what "retry" looks like; it just returns the new state).
 */
export async function runPayment(
  deps: CheckoutDeps,
  state: PaymentState,
): Promise<{state: PaymentState; outcome: PaymentOutcome}> {
  let current = state;

  // 1. create-order (idempotent, with stale-snapshot re-validate).
  try {
    const result = await createWithStaleSnapshotRetry(deps, current);
    current = result.state;
  } catch (err) {
    // A revalidate() failure means the cart itself can no longer be
    // validated (product gone / unpriceable / pincode no longer
    // serviceable) — retrying the payment cannot fix that.
    if (err instanceof CheckoutStepError && err.code === "REVALIDATE_FAILED") {
      return {state: current, outcome: {kind: "cart-changed", message: err.message}};
    }
    const message = err instanceof Error ? err.message : undefined;
    return {
      state: current,
      outcome: {kind: "retryable", reason: "create-failed", message},
    };
  }

  const created = current.created!;

  // 2. Razorpay widget.
  const widget = await deps.openCheckout({
    keyId: created.keyId,
    razorpayOrderId: created.razorpayOrderId,
    amountInPaise: created.amountInPaise,
  });
  if (widget.kind === "dismissed") {
    return {state: current, outcome: {kind: "retryable", reason: "dismissed"}};
  }
  if (widget.kind === "script") {
    return {state: current, outcome: {kind: "retryable", reason: "script"}};
  }
  if (widget.kind === "failed") {
    return {
      state: current,
      outcome: {
        kind: "retryable",
        reason: "payment-failed",
        message: widget.description ?? widget.code,
      },
    };
  }

  // 3. verify — fresh key per call.
  try {
    await deps.verifyPayment(
      {
        orderId: created.orderId,
        razorpayPaymentId: widget.paymentId,
        signature: widget.signature,
      },
      deps.newIdempotencyKey(),
    );
  } catch (err) {
    // Signature rejected / payment failed server-side. The order stays
    // pending; the customer may retry the SAME order (state.created is
    // retained, so step 1 replays the idempotent create).
    const message = err instanceof Error ? err.message : undefined;
    return {
      state: current,
      outcome: {kind: "retryable", reason: "verify-failed", message},
    };
  }

  return {
    state: current,
    outcome: {
      kind: "confirmed",
      orderId: created.orderId,
      razorpayPaymentId: widget.paymentId,
    },
  };
}
