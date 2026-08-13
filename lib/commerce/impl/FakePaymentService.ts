// lib/commerce/impl/FakePaymentService.ts
// In-memory PaymentService fake for tests — Task 4.3.
// Implements the adapter interface with happy-path defaults so downstream
// tests (order creation flow, idempotency, route integration) don't need
// to mock Razorpay HTTP. Tests that need to assert on payment failure /
// signature mismatch should use RazorpayPaymentService with nock instead,
// or override these methods on the fake instance.
import type { PaymentService } from '../PaymentService';

export class FakePaymentService implements PaymentService {
  /** Override in a test to make verifySignature return false. */
  verifySignatureResult: boolean = true;
  /** Override in a test to change the status returned by fetchStatus / fetchStatusByOrder. */
  statusResult: 'created' | 'captured' | 'failed' | 'refunded' | 'partially_refunded' = 'captured';
  /** Override in a test to make fetchStatusByOrder return a specific providerPaymentId. */
  statusByOrderProviderPaymentId: string | undefined = 'pay_fake_1';
  /** Set to an Error to make createOrder throw. */
  createOrderError: Error | null = null;

  async createOrder(_opts: {
    amountInPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ providerOrderId: string }> {
    if (this.createOrderError) throw this.createOrderError;
    return { providerOrderId: 'order_fake_' + Math.random().toString(36).slice(2, 10) };
  }

  async verifySignature(_opts: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): Promise<boolean> {
    return this.verifySignatureResult;
  }

  async fetchStatus(_providerPaymentId: string) {
    return this.statusResult;
  }

  async fetchStatusByOrder(_providerOrderId: string) {
    return {
      status: this.statusResult,
      providerPaymentId: this.statusByOrderProviderPaymentId,
    };
  }

  async refund(_opts: {
    providerPaymentId: string;
    amountInPaise: number;
    notes?: Record<string, string>;
  }): Promise<{ providerRefundId: string }> {
    return { providerRefundId: 'rfd_fake_' + Math.random().toString(36).slice(2, 10) };
  }
}
