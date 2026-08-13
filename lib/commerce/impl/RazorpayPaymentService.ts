// lib/commerce/impl/RazorpayPaymentService.ts
// Razorpay payment adapter — Task 4.3 (Mishran Mobile Apps v1).
// Adapter pattern: implements the PaymentService interface from ../PaymentService.ts.
// Vendor swap = config + impl change, not a rewrite (see Mishran ADR on adapter pattern).
//
// Razorpay API reference:
//   - Orders:   POST https://api.razorpay.com/v1/orders
//   - Payments: GET  https://api.razorpay.com/v1/payments/:id
//   - Refunds:  POST https://api.razorpay.com/v1/payments/:id/refund
//
// Auth: HTTP Basic with keyId:keySecret base64-encoded. Secrets come from env
// (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) wired by the DI container in a later task.
//
// Error policy: throws raw Error on non-2xx (adapter pattern — caller maps to
// ApiError(PAYMENT_FAILED) at the route boundary; matches Msg91OtpService).
import type { PaymentService, PaymentStatus } from '../PaymentService';
import { verifyRazorpaySignature } from '../../security/hmac';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

const RAZORPAY_BASE = 'https://api.razorpay.com';

export class RazorpayPaymentService implements PaymentService {
  constructor(private readonly deps: RazorpayConfig) {}

  private get authHeader(): string {
    return (
      'Basic ' +
      Buffer.from(`${this.deps.keyId}:${this.deps.keySecret}`).toString('base64')
    );
  }

  async createOrder(opts: {
    amountInPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ providerOrderId: string }> {
    const res = await fetch(`${RAZORPAY_BASE}/v1/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: this.authHeader,
      },
      body: JSON.stringify({
        amount: opts.amountInPaise,
        currency: 'INR',
        receipt: opts.receipt,
        // payment_capture: 1 = auto-capture on successful payment.
        payment_capture: 1,
        notes: opts.notes,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Razorpay create-order failed: ${res.status} ${await res.text()}`,
      );
    }
    const body = (await res.json()) as { id: string };
    return { providerOrderId: body.id };
  }

  async verifySignature(opts: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): Promise<boolean> {
    return verifyRazorpaySignature({
      providerOrderId: opts.providerOrderId,
      providerPaymentId: opts.providerPaymentId,
      signature: opts.signature,
      secret: this.deps.keySecret,
    });
  }

  async fetchStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const res = await fetch(
      `${RAZORPAY_BASE}/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      { headers: { authorization: this.authHeader } },
    );
    if (!res.ok) {
      throw new Error(`Razorpay fetch-status failed: ${res.status}`);
    }
    const body = (await res.json()) as { status: string };
    return mapStatus(body.status);
  }

  /**
   * Look up the authoritative status of an order at Razorpay, used by the
   * reconciliation cron (Task 4.7) to settle orphan payments where the
   * client abandoned before our verify route stored a providerPaymentId.
   *
   * Razorpay exposes payment attempts as a list on the order:
   *   GET /v1/orders/:id/payments  ->  { items: [{ id, status, ... }, ...] }
   *
   * Strategy: pick the most recent attempt and return its normalized status
   * + the payment id (caller backfills the local row). If there are no
   * attempts yet, the order is still "created" from our side — return
   * status 'created' with no providerPaymentId so the caller leaves the
   * row alone and waits for the next cron tick or the webhook.
   *
   * Fail-closed: any non-2xx or unparseable response throws, which the
   * reconcile loop catches per-payment so one bad order doesn't block the
   * rest of the batch.
   */
  async fetchStatusByOrder(
    providerOrderId: string,
  ): Promise<{ status: PaymentStatus; providerPaymentId?: string }> {
    const res = await fetch(
      `${RAZORPAY_BASE}/v1/orders/${encodeURIComponent(providerOrderId)}/payments`,
      { headers: { authorization: this.authHeader } },
    );
    if (!res.ok) {
      throw new Error(
        `Razorpay fetch-status-by-order failed: ${res.status}`,
      );
    }
    const body = (await res.json()) as {
      items?: Array<{ id?: string; status?: string }>;
    };
    const items = body.items ?? [];
    if (items.length === 0) {
      return { status: 'created' };
    }
    // Razorpay returns items newest-first; the first entry is the most
    // recent attempt. Map its status into our normalized enum.
    const latest = items[0];
    const id = latest.id;
    const status = mapStatus(latest.status ?? '');
    return id ? { status, providerPaymentId: id } : { status };
  }

  async refund(opts: {
    providerPaymentId: string;
    amountInPaise: number;
    notes?: Record<string, string>;
  }): Promise<{ providerRefundId: string }> {
    const res = await fetch(
      `${RAZORPAY_BASE}/v1/payments/${encodeURIComponent(opts.providerPaymentId)}/refund`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: this.authHeader,
        },
        body: JSON.stringify({
          amount: opts.amountInPaise,
          notes: opts.notes,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Razorpay refund failed: ${res.status}`);
    }
    const body = (await res.json()) as { id: string };
    return { providerRefundId: body.id };
  }
}

/**
 * Map a Razorpay payment status string into our normalized PaymentStatus.
 *
 * Razorpay status reference (payments):
 *   created              — payment entity created, not attempted yet
 *   attempted            — customer reached the payment stage, no success yet
 *   paid                 — payment succeeded (funds authorized)
 *   captured             — payment captured (settled to merchant)
 *   failed               — payment attempt failed
 *   refunded             — fully refunded
 *   partially_refunded   — some amount refunded
 *
 * `attempted` collapses into `created` (still pending, no funds). Any unknown
 * status defaults to `failed` (fail-closed — callers must never treat an
 * unrecognized status as success).
 */
function mapStatus(s: string): PaymentStatus {
  switch (s) {
    case 'created':
      return 'created';
    case 'attempted':
      return 'created';
    case 'paid':
      return 'captured';
    case 'captured':
      return 'captured';
    case 'failed':
      return 'failed';
    case 'refunded':
      return 'refunded';
    case 'partially_refunded':
      return 'partially_refunded';
    default:
      return 'failed';
  }
}
