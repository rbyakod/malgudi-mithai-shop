// lib/security/hmac.ts
// Razorpay signature verification helper — Task 4.3.
// Razorpay signs payloads with HMAC-SHA256 over `${orderId}|${paymentId}`
// using the key secret. Constant-time comparison is used to avoid timing
// attacks against the signature check.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface RazorpaySignatureInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  secret: string;
}

/**
 * Verify a Razorpay payment signature. Returns true iff the provided
 * signature matches the expected HMAC-SHA256 over
 * `${providerOrderId}|${providerPaymentId}` keyed by `secret`.
 *
 * Constant-time compare guards against timing side-channels. Both buffers
 * are hex strings so length differences are handled by short-circuiting on
 * unequal length before calling timingSafeEqual (which requires equal
 * length).
 */
export function verifyRazorpaySignature(opts: RazorpaySignatureInput): boolean {
  const body = `${opts.providerOrderId}|${opts.providerPaymentId}`;
  const expected = createHmac('sha256', opts.secret).update(body).digest('hex');
  const provided = opts.signature;

  if (expected.length !== provided.length) return false;

  // timingSafeEqual wants equal-length Buffers of identical byte length.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  return timingSafeEqual(expectedBuf, providedBuf);
}
