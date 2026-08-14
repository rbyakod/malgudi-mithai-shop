// lib/commerce/impl/RazorpayPaymentService.test.ts
// Tests for the Razorpay payment adapter — Task 4.3.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createHmac } from 'node:crypto';
import { RazorpayPaymentService } from './RazorpayPaymentService';

const KEY_ID = 'rzp_test_KEYID';
const KEY_SECRET = 'rzp_test_SECRET';

function svc() {
  return new RazorpayPaymentService({ keyId: KEY_ID, keySecret: KEY_SECRET });
}

describe('RazorpayPaymentService', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe('createOrder', () => {
    it('POSTs to /v1/orders and returns providerOrderId', async () => {
      const body = { amount: 50000, currency: 'INR', receipt: 'rcpt_1', payment_capture: 1 };
      nock('https://api.razorpay.com', {
        reqheaders: {
          authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`,
          'content-type': 'application/json',
        },
      })
        .post('/v1/orders', body)
        .reply(200, { id: 'order_abc', amount: 50000, currency: 'INR', receipt: 'rcpt_1' });

      const res = await svc().createOrder({ amountInPaise: 50000, receipt: 'rcpt_1' });
      expect(res).toEqual({ providerOrderId: 'order_abc' });
      expect(nock.isDone()).toBe(true);
    });

    it('passes notes through when provided', async () => {
      nock('https://api.razorpay.com')
        .post('/v1/orders', /"notes":\s*{"orderId":"o_1"}/)
        .reply(200, { id: 'order_notes' });

      const res = await svc().createOrder({
        amountInPaise: 1000,
        receipt: 'rcpt_2',
        notes: { orderId: 'o_1' },
      });
      expect(res).toEqual({ providerOrderId: 'order_notes' });
    });

    it('throws on non-2xx with status code in message', async () => {
      nock('https://api.razorpay.com').post('/v1/orders').reply(400, {
        error: { code: 'BAD_REQUEST', description: 'amount too small' },
      });

      await expect(
        svc().createOrder({ amountInPaise: 1, receipt: 'rcpt_err' }),
      ).rejects.toThrow(/Razorpay create-order failed: 400/);
    });

    it('throws on 401 auth error', async () => {
      nock('https://api.razorpay.com').post('/v1/orders').reply(401, {
        error: { code: 'BAD_AUTH_ERROR' },
      });

      await expect(
        svc().createOrder({ amountInPaise: 1000, receipt: 'rcpt_x' }),
      ).rejects.toThrow(/Razorpay create-order failed: 401/);
    });
  });

  describe('verifySignature', () => {
    const providerOrderId = 'order_VERIFY';
    const providerPaymentId = 'pay_VERIFY';

    function sign(orderId: string, paymentId: string) {
      return createHmac('sha256', KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    }

    it('returns true for a valid signature', async () => {
      const signature = sign(providerOrderId, providerPaymentId);
      const ok = await svc().verifySignature({
        providerOrderId,
        providerPaymentId,
        signature,
      });
      expect(ok).toBe(true);
    });

    it('returns false for a tampered signature', async () => {
      const ok = await svc().verifySignature({
        providerOrderId,
        providerPaymentId,
        signature: 'tampered_signature_value',
      });
      expect(ok).toBe(false);
    });

    it('returns false when the order id is swapped under the signature', async () => {
      const signature = sign(providerOrderId, providerPaymentId);
      const ok = await svc().verifySignature({
        providerOrderId: 'order_SWAPPED',
        providerPaymentId,
        signature,
      });
      expect(ok).toBe(false);
    });
  });

  describe('fetchStatus', () => {
    const cases: Array<[string, 'created' | 'captured' | 'failed' | 'refunded' | 'partially_refunded']> = [
      ['created', 'created'],
      ['attempted', 'created'],
      ['paid', 'captured'],
      ['captured', 'captured'],
      ['failed', 'failed'],
      ['refunded', 'refunded'],
      ['partially_refunded', 'partially_refunded'],
    ];

    for (const [razorpayStatus, expected] of cases) {
      it(`maps Razorpay "${razorpayStatus}" → "${expected}"`, async () => {
        nock('https://api.razorpay.com')
          .get(`/v1/payments/pay_${razorpayStatus}`)
          .reply(200, { id: `pay_${razorpayStatus}`, status: razorpayStatus });

        const status = await svc().fetchStatus(`pay_${razorpayStatus}`);
        expect(status).toBe(expected);
      });
    }

    it('maps an unknown status to "failed" (fail-closed)', async () => {
      nock('https://api.razorpay.com')
        .get('/v1/payments/pay_unknown')
        .reply(200, { id: 'pay_unknown', status: 'some_new_status' });

      const status = await svc().fetchStatus('pay_unknown');
      expect(status).toBe('failed');
    });

    it('throws on non-2xx', async () => {
      nock('https://api.razorpay.com').get('/v1/payments/pay_err').reply(404, {
        error: { code: 'NOT_FOUND' },
      });

      await expect(svc().fetchStatus('pay_err')).rejects.toThrow(
        /Razorpay fetch-status failed: 404/,
      );
    });
  });

  describe('refund', () => {
    it('POSTs to /v1/payments/:id/refund and returns providerRefundId', async () => {
      nock('https://api.razorpay.com', {
        reqheaders: { 'content-type': 'application/json' },
      })
        .post('/v1/payments/pay_REF/refund', { amount: 5000, notes: undefined })
        .reply(200, { id: 'rfd_123', amount: 5000 });

      const res = await svc().refund({
        providerPaymentId: 'pay_REF',
        amountInPaise: 5000,
      });
      expect(res).toEqual({ providerRefundId: 'rfd_123' });
      expect(nock.isDone()).toBe(true);
    });

    it('passes notes through', async () => {
      nock('https://api.razorpay.com')
        .post('/v1/payments/pay_REF2/refund', /"notes":\s*{"reason":"damaged"}/)
        .reply(200, { id: 'rfd_456' });

      const res = await svc().refund({
        providerPaymentId: 'pay_REF2',
        amountInPaise: 2500,
        notes: { reason: 'damaged' },
      });
      expect(res).toEqual({ providerRefundId: 'rfd_456' });
    });

    it('throws on non-2xx with status code in message', async () => {
      nock('https://api.razorpay.com')
        .post('/v1/payments/pay_REFERR/refund')
        .reply(400, { error: { code: 'BAD_REQUEST' } });

      await expect(
        svc().refund({ providerPaymentId: 'pay_REFERR', amountInPaise: 999999 }),
      ).rejects.toThrow(/Razorpay refund failed: 400/);
    });
  });

  describe('authentication', () => {
    it('sends HTTP Basic auth header derived from keyId:keySecret', async () => {
      const expectedAuth = `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`;
      nock('https://api.razorpay.com', {
        reqheaders: { authorization: expectedAuth },
      })
        .post('/v1/orders')
        .reply(200, { id: 'order_auth_check' });

      const res = await svc().createOrder({ amountInPaise: 1000, receipt: 'rcpt_auth' });
      expect(res).toEqual({ providerOrderId: 'order_auth_check' });
      expect(nock.isDone()).toBe(true);
    });
  });
});
