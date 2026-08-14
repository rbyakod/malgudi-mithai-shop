// lib/security/hmac.ts
// Razorpay signature verification helpers — Tasks 4.3 + 4.5.
//
// Two signature schemes:
//   1. Client-side payment signature (Task 4.3): HMAC-SHA256 over
//      `${orderId}|${paymentId}` with the key secret. Used by the verify
//      route after the Razorpay checkout widget posts a signature back to
//      the client.
//   2. Webhook signature (Task 4.5): HMAC-SHA256 over the RAW request
//      body bytes with a SEPARATE webhook secret configured in the
//      Razorpay dashboard. Used by the webhook route which receives the
//      raw bytes straight off the socket.
//
// Both use constant-time compare to avoid timing side-channels.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface RazorpaySignatureInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  secret: string;
}

export interface RazorpayWebhookSignatureInput {
  /** Raw request body bytes exactly as received. */
  body: string;
  /** Value of the `x-razorpay-signature` header. */
  signature: string;
  /** `RAZORPAY_WEBHOOK_SECRET` from env. */
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

/**
 * Verify a Razorpay WEBHOOK signature. Returns true iff `signature`
 * matches HMAC-SHA256(rawBody, secret). Razorpay signs the verbatim
 * request bytes, so callers MUST pass the exact body string they read
 * from the socket (no re-serialization, no JSON round-trip).
 *
 * Length-difference short-circuit is REQUIRED: timingSafeEqual throws
 * `RangeError: Input buffers must have the same byte length` when fed
 * unequal-length buffers. The hex digest is always 64 chars, so any
 * header shorter or longer is trivially invalid.
 */
export function verifyRazorpayWebhookSignature(
  opts: RazorpayWebhookSignatureInput,
): boolean {
  const expected = createHmac('sha256', opts.secret).update(opts.body).digest('hex');
  const provided = opts.signature;

  if (expected.length !== provided.length) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  return timingSafeEqual(expectedBuf, providedBuf);
}
