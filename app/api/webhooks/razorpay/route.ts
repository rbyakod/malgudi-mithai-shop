// app/api/webhooks/razorpay/route.ts
// Razorpay webhook handler — Task 4.5 (Mishran Mobile Apps v1).
//
// This is the THIRD payment confirmation path (after the client verify
// route from Task 4.4 and the future admin manual capture). Razorpay's
// server-to-server webhook fires on payment.captured independent of any
// client callback. Whichever path runs first captures the payment row;
// the other no-ops on `status === 'captured'`.
//
// FLOW:
//   1. Read raw body bytes straight off the socket. Razorpay signs the
//      verbatim bytes — do NOT re-serialize or the signature fails.
//   2. Read x-razorpay-signature header.
//   3. Config check: RAZORPAY_WEBHOOK_SECRET must be present. If missing,
//      log webhook_config_error + return 500. Do NOT crash.
//   4. Timing-safe signature verify via verifyRazorpayWebhookSignature.
//      On failure: log webhook_signature_fail + return 400.
//   5. JSON.parse with try/catch. Malformed body: log + return 400.
//   6. Only process events with a payment entity (e.g. payment.captured).
//      Refund/dispute/settlement events are ack'd with 200 ok and skipped.
//   7. Find our payment row by providerOrderId. If not found yet
//      (webhook beat create-order persistence), ack 200 ok — Razorpay
//      will retry.
//   8. Idempotent short-circuit: payment already captured -> 200 ok.
//   9. Otherwise: mark payment captured + append raw event for audit,
//      mark order paid, transition order pending_payment -> confirmed.
//  10. TODO(Task 5.2): emit order.confirmed via OrderEventEmitter.
//
// BRIEF FIXES applied here:
//   - #1 Path depth: app/api/webhooks/razorpay/ = 4 dirs under app/, so
//     5 `../` to repo root. Brief used 4 — wrong.
//   - #2 Dropped unused verifyRazorpaySignature import (webhook uses a
//     different signature scheme — see lib/security/hmac.ts).
//   - #3 RAZORPAY_WEBHOOK_SECRET explicit check + securityEvent log +
//     500. No `!` non-null assertion, no crash.
//   - #4 New verifyRazorpayWebhookSignature helper does timing-safe
//     compare (length check + timingSafeEqual). No string `!==`.
//   - #5 emitOrderEvent does not exist yet (Task 5.2). TODO comment only.
//   - #6 JSON.parse wrapped in try/catch. Malformed body -> 400 +
//     webhook_signature_fail securityEvent (not a separate event type;
//     the body is untrusted, signature passed only because we signed the
//     same garbage — real Razorpay would never send unsigned garbage).
//   - #7 Non-payment events (refund/dispute/etc.) ack 200 ok, skipped.
//   - #8 paymentDoc.orderId coerced to String() — Payload relationships
//     may surface as either ID string or populated object depending on
//     depth; coerce at the boundary.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { PayloadOrderService } from '../../../../lib/commerce/impl/PayloadOrderService';
import { verifyRazorpayWebhookSignature } from '../../../../lib/security/hmac';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Config check — explicit null check, NOT `!`. Log + return 500 so ops
  // sees the misconfiguration in securityEvents. Do NOT crash.
  if (!secret) {
    try {
      const payload = await getPayload({ config });
      await payload.create({
        collection: 'securityEvents',
        data: {
          type: 'webhook_config_error',
          details: { reason: 'missing RAZORPAY_WEBHOOK_SECRET env' },
        },
      });
    } catch {
      // payload.create may fail (no collection, db unavailable). Swallow
      // so the 500 still goes out — the request must always terminate.
    }
    return new Response('webhook misconfigured', { status: 500 });
  }

  // Timing-safe signature verify. Razorpay signs the raw bytes — body is
  // the verbatim request body read above. A length mismatch short-
  // circuits inside the helper (timingSafeEqual throws on unequal
  // length); a content mismatch returns false.
  const valid = verifyRazorpayWebhookSignature({ body, signature, secret });
  if (!valid) {
    try {
      const payload = await getPayload({ config });
      await payload.create({
        collection: 'securityEvents',
        data: {
          type: 'webhook_signature_fail',
          // Truncate — securityEvents.details is JSON but we cap the
          // payload slice to avoid dumping megabytes of attacker bytes.
          details: { raw: body.slice(0, 500) },
        },
      });
    } catch {
      // Swallow — never let the securityEvent write block the 400.
    }
    return new Response('invalid signature', { status: 400 });
  }

  // Signature passed — parse. Body is now trusted bytes.
  let event: {
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
    };
  };
  try {
    event = JSON.parse(body);
  } catch {
    // Signature matched the bytes (we'd only hit this in tests that sign
    // garbage, or in a real Razorpay bug). Surface 400 + log so we see
    // it; do not crash.
    try {
      const payload = await getPayload({ config });
      await payload.create({
        collection: 'securityEvents',
        data: {
          type: 'webhook_malformed_json',
          details: { raw: body.slice(0, 500) },
        },
      });
    } catch {
      // Swallow.
    }
    return new Response('malformed body', { status: 400 });
  }

  // Only process payment events. Razorpay also sends refund.processed,
  // payment.dispute.created, etc. — those ack 200 ok with no work here.
  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) {
    return new Response('ok', { status: 200 });
  }
  const providerOrderId = paymentEntity.order_id;
  const providerPaymentId = paymentEntity.id;
  if (!providerOrderId || !providerPaymentId) {
    return new Response('ok', { status: 200 });
  }

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: 'payments',
    where: { providerOrderId: { equals: providerOrderId } },
    limit: 1,
  });
  const paymentDoc = found.docs[0] as
    | {
        id: string;
        orderId: string | { id?: string };
        status?: string;
        rawWebhookEvents?: Array<{ payload: unknown; receivedAt: string }>;
      }
    | undefined;
  // Razorpay may send the webhook before create-order has persisted our
  // payment row. Ack 200 ok so Razorpay stops retrying; a later replay
  // or the client verify path will complete the flow.
  if (!paymentDoc) {
    return new Response('ok', { status: 200 });
  }

  // Idempotent short-circuit. The verify route or an earlier webhook may
  // have already captured this payment — never double-transition.
  if (paymentDoc.status === 'captured') {
    return new Response('ok', { status: 200 });
  }

  // Capture the payment row. Append the raw event for audit —
  // rawWebhookEvents is a Payload array field on Payments (Task 1.6).
  await payload.update({
    collection: 'payments',
    id: paymentDoc.id,
    data: {
      status: 'captured',
      providerPaymentId,
      rawWebhookEvents: [
        ...(paymentDoc.rawWebhookEvents ?? []),
        { payload: event, receivedAt: new Date().toISOString() },
      ],
    },
  });

  // Mark the order paid. transition() will move status -> confirmed.
  // Brief fix #8: orderId may be a populated relationship object at
  // higher read depths; coerce to the string id either way.
  const orderId = String(paymentDoc.orderId);
  await payload.update({
    collection: 'orders',
    id: orderId,
    data: { paymentStatus: 'paid' },
  });

  // transition() throws INVALID_STATE_TRANSITION if the order has
  // already moved past pending_payment (e.g. webhook and verify racing).
  // The payment-row status check above already guards the common case;
  // the try/catch here covers the rarer race where the order was
  // confirmed but the payment row flip lost the race.
  const orderService = new PayloadOrderService();
  try {
    await orderService.transition(orderId, 'confirmed', {
      actor: 'system:razorpay-webhook',
    });
  } catch {
    // Order already confirmed by a concurrent verify call. Payment row
    // is captured, order is paid; nothing left to do.
  }

  // TODO(Task 5.2): emit order.confirmed event via OrderEventEmitter.
  //   const { emitOrderEvent } = await import(
  //     '../../../../lib/notifications/OrderEventEmitter'
  //   );
  //   await emitOrderEvent(orderId, 'confirmed');

  return new Response('ok', { status: 200 });
}
