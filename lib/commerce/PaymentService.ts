// lib/commerce/PaymentService.ts
// PaymentService interface — Task 4.3 (Mishran Mobile Apps v1).
// Adapter pattern: concrete impls (Razorpay, Fake) live in ./impl/*PaymentService.ts.
// Wired into the DI container in a later task.

/**
 * Normalized payment lifecycle status. Mirrors the downstream order/shipment
 * state machine; Razorpay-specific statuses are mapped into this set by the
 * impl (see RazorpayPaymentService.mapStatus).
 *
 * `create_failed` is order-level (order could not be created at provider);
 * the remaining statuses are payment-level.
 */
export type PaymentStatus =
  | 'created'
  | 'create_failed'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface PaymentService {
  /**
   * Create an order at the payment provider. `amountInPaise` is the smallest
   * currency unit (1 INR = 100 paise). Returns the provider-side order id
   * which the caller stores on the Order record.
   */
  createOrder(opts: {
    amountInPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ providerOrderId: string }>;

  /**
   * Verify the HMAC signature Razorpay sends on payment webhooks / checkout
   * callbacks. Returns true only if the signature matches. Fail-closed:
   * callers must treat `false` as an untrusted payload.
   */
  verifySignature(opts: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): Promise<boolean>;

  /**
   * Fetch the current status of a payment from the provider. Used by the
   * reconciliation / webhook fallback path.
   */
  fetchStatus(providerPaymentId: string): Promise<PaymentStatus>;

  /**
   * Fetch the authoritative status of an ORDER at the payment provider,
   * used by the reconciliation cron (Task 4.7) when the only stable handle
   * we have is the provider order id — typical for orphan payments where
   * the client abandoned before verify wrote a providerPaymentId locally.
   *
   * Returns the normalized status of the latest payment attempt on the
   * order, plus the providerPaymentId of that attempt when one exists
   * (caller backfills the local payment row). When the order has no
   * payment attempts yet (client never even opened the widget), returns
   * status 'created' with no providerPaymentId.
   */
  fetchStatusByOrder(
    providerOrderId: string,
  ): Promise<{ status: PaymentStatus; providerPaymentId?: string }>;

  /**
   * Refund a captured payment (full or partial). Returns the provider-side
   * refund id.
   */
  refund(opts: {
    providerPaymentId: string;
    amountInPaise: number;
    notes?: Record<string, string>;
  }): Promise<{ providerRefundId: string }>;
}
