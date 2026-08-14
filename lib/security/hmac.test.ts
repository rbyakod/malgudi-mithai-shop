// lib/security/hmac.test.ts
// Tests for Razorpay signature verification — Tasks 4.3 + 4.5.
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyRazorpaySignature, verifyRazorpayWebhookSignature } from './hmac';

describe('verifyRazorpaySignature', () => {
  // Fixture: deterministic inputs so the expected signature is stable.
  const secret = 'test_secret_123';
  const providerOrderId = 'order_ABC123';
  const providerPaymentId = 'pay_XYZ789';

  const expectedSig = createHmac('sha256', secret)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest('hex');

  it('returns true for a valid signature (known fixture)', () => {
    expect(
      verifyRazorpaySignature({
        providerOrderId,
        providerPaymentId,
        signature: expectedSig,
        secret,
      }),
    ).toBe(true);
  });

  it('returns true for a freshly computed signature', () => {
    // Independent recomputation — guards against fixture rot.
    const sig = createHmac('sha256', secret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');
    expect(
      verifyRazorpaySignature({
        providerOrderId,
        providerPaymentId,
        signature: sig,
        secret,
      }),
    ).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    // Flip one hex char of a valid signature.
    const tampered =
      expectedSig.slice(0, -1) + (expectedSig.slice(-1) === '0' ? '1' : '0');
    expect(tampered).not.toBe(expectedSig);
    expect(
      verifyRazorpaySignature({
        providerOrderId,
        providerPaymentId,
        signature: tampered,
        secret,
      }),
    ).toBe(false);
  });

  it('returns false for a completely wrong signature', () => {
    expect(
      verifyRazorpaySignature({
        providerOrderId,
        providerPaymentId,
        signature: 'deadbeef',
        secret,
      }),
    ).toBe(false);
  });

  it('returns false when the secret is wrong', () => {
    expect(
      verifyRazorpaySignature({
        providerOrderId,
        providerPaymentId,
        signature: expectedSig,
        secret: 'wrong_secret',
      }),
    ).toBe(false);
  });

  it('returns false when the order id was tampered (signature no longer matches)', () => {
    expect(
      verifyRazorpaySignature({
        providerOrderId: 'order_TAMPERED',
        providerPaymentId,
        signature: expectedSig,
        secret,
      }),
    ).toBe(false);
  });

  it('returns false when the payment id was tampered', () => {
    expect(
      verifyRazorpaySignature({
        providerOrderId,
        providerPaymentId: 'pay_TAMPERED',
        signature: expectedSig,
        secret,
      }),
    ).toBe(false);
  });
});

describe('verifyRazorpayWebhookSignature', () => {
  // Different secret scheme — the webhook uses the dashboard-configured
  // WEBHOOK_SECRET, not the key secret. Body is the raw request payload.
  const secret = 'wh_test_secret_456';
  const rawBody = JSON.stringify({
    entity: 'event',
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_X' } } },
  });

  const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex');

  it('returns true for a valid signature over the raw body', () => {
    expect(
      verifyRazorpayWebhookSignature({
        body: rawBody,
        signature: expectedSig,
        secret,
      }),
    ).toBe(true);
  });

  it('returns true for a freshly recomputed signature', () => {
    const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(
      verifyRazorpayWebhookSignature({ body: rawBody, signature: sig, secret }),
    ).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    const tampered =
      expectedSig.slice(0, -1) + (expectedSig.slice(-1) === '0' ? '1' : '0');
    expect(tampered).not.toBe(expectedSig);
    expect(
      verifyRazorpayWebhookSignature({
        body: rawBody,
        signature: tampered,
        secret,
      }),
    ).toBe(false);
  });

  it('returns false when the body was tampered (different bytes)', () => {
    // Re-serialize with a different value: even though it parses to the
    // same shape, the byte stream differs and the signature must fail.
    const tamperedBody = rawBody.replace('pay_X', 'pay_Y');
    expect(
      verifyRazorpayWebhookSignature({
        body: tamperedBody,
        signature: expectedSig,
        secret,
      }),
    ).toBe(false);
  });

  it('returns false when the secret is wrong', () => {
    expect(
      verifyRazorpayWebhookSignature({
        body: rawBody,
        signature: expectedSig,
        secret: 'wrong_secret',
      }),
    ).toBe(false);
  });

  it('returns false for a signature of the wrong length', () => {
    // Hex digest is always 64 chars; a 4-char header must short-circuit.
    expect(
      verifyRazorpayWebhookSignature({ body: rawBody, signature: 'dead', secret }),
    ).toBe(false);
  });
});
