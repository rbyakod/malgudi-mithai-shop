// lib/web/razorpay.ts
// Lazy loader for Razorpay's checkout script + the thinnest possible local
// type surface for the widget (no @types/razorpay dependency — we touch
// exactly four options and two callbacks).
//
// Script discipline (plan risk R3):
//   - The script is injected ONLY when a payment is actually attempted —
//     never on checkout render — and only once per document.
//   - `window.Razorpay` is resolved at call time; load failures resolve
//     null so the checkout can show its WhatsApp fallback instead of a
//     dead spinner.
//   - The key id NEVER lives here — it comes from the create-order
//     response (build-time NEXT_PUBLIC_* inlining would go stale on key
//     rotation; the server response is always current).

// ---- Minimal local types ----------------------------------------------------

export type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayPrefill = {
  name?: string;
  email?: string;
  contact?: string;
};

// checkout.js `config.display` (B14) — used to restrict the widget to one
// payment method (UPI) when the customer chose a specific rail. Key names
// per Razorpay "Configure Payment Methods" sample code (2026-08):
//   https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/sample-code/
// UPI inside the widget is Razorpay-mediated end to end — intent one-tap on
// mobile, QR on desktop (UPI Collect was deprecated 2026-02-28) — so the
// payment still resolves through the same handler → verify → webhook
// pipeline. We never mint raw `upi://pay` links or static-VPA QRs.
export type RazorpayDisplayConfig = {
  display: {
    blocks: Record<string, {name: string; instruments: {method: string}[]}>;
    sequence: string[];
    preferences: {show_default_blocks: boolean};
  };
};

export type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: RazorpayPrefill;
  theme?: {color?: string};
  config?: RazorpayDisplayConfig;
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: {ondismiss?: () => void};
};

export type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (payload: unknown) => void) => void;
};

type RazorpayStatic = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayStatic;
  }
}

// ---- Single-injection lazy loader -------------------------------------------

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// In-flight load only — a FAILED load is not cached, so a customer who
// lost connectivity can retry the payment without a page reload.
let pendingLoad: Promise<RazorpayStatic | null> | null = null;

export function loadRazorpay(): Promise<RazorpayStatic | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (pendingLoad) return pendingLoad;

  pendingLoad = new Promise<RazorpayStatic | null>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(window.Razorpay ?? null));
    script.addEventListener("error", () => resolve(null));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    // A previously-injected tag may have finished loading between the
    // window.Razorpay check above and the listeners attaching.
    if (window.Razorpay) resolve(window.Razorpay);
  }).finally(() => {
    pendingLoad = null;
  });

  return pendingLoad;
}

// ---- Promise wrapper around the widget ---------------------------------------

export type OpenCheckoutInput = {
  /** From the create-order response — never hardcoded (see file header). */
  keyId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  name: string;
  description?: string;
  prefill?: RazorpayPrefill;
  /** Malgudi Blue v2 primary action color. */
  themeColor?: string;
  /**
   * Restrict the widget to a single Razorpay method (B14 UPI rail). The
   * order/handler/verify path is identical — this only shapes the widget.
   */
  restrictToMethod?: "upi";
};

/**
 * Pure builder for a method-only `config.display` block — unit-tested
 * without loading the widget script.
 */
export function methodOnlyDisplayConfig(method: string): RazorpayDisplayConfig {
  return {
    display: {
      blocks: {
        only: {
          name: `Pay via ${method.toUpperCase()}`,
          instruments: [{method}],
        },
      },
      sequence: ["block.only"],
      preferences: {show_default_blocks: false},
    },
  };
}

export type OpenCheckoutResult =
  | {kind: "ok"; response: RazorpayHandlerResponse}
  | {kind: "dismissed"}
  | {kind: "failed"; code?: string; description?: string}
  | {kind: "script"};

/**
 * Open the Razorpay checkout widget and resolve with the customer's
 * outcome. The handler response (payment id + signature) is exactly what
 * POST /payments/razorpay/verify expects.
 */
export async function openRazorpayCheckout(
  input: OpenCheckoutInput,
): Promise<OpenCheckoutResult> {
  const Razorpay = await loadRazorpay();
  if (!Razorpay) return {kind: "script"};

  return await new Promise<OpenCheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: OpenCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = new Razorpay({
      key: input.keyId,
      order_id: input.razorpayOrderId,
      amount: input.amountInPaise,
      currency: "INR",
      name: input.name,
      ...(input.description ? {description: input.description} : {}),
      ...(input.prefill ? {prefill: input.prefill} : {}),
      theme: {color: input.themeColor ?? "#0053E2"},
      ...(input.restrictToMethod
        ? {config: methodOnlyDisplayConfig(input.restrictToMethod)}
        : {}),
      handler: (response) => finish({kind: "ok", response}),
      modal: {
        ondismiss: () => finish({kind: "dismissed"}),
      },
    });

    instance.on("payment.failed", (payload) => {
      const error = (payload as {error?: {code?: string; description?: string}})
        .error;
      finish({kind: "failed", code: error?.code, description: error?.description});
    });

    instance.open();
  });
}
