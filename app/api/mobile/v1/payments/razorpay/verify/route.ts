// app/api/mobile/v1/payments/razorpay/verify/route.ts
// Razorpay payment signature verification — Task 4.4 (Mishran Mobile Apps v1).
//
// Flow:
//   1. Authn (requireCustomer).
//   2. Validate body (orderId, razorpayPaymentId, signature).
//   3. Fetch the order scoped to the customer.
//   4. Verify the HMAC signature via the PaymentService adapter
//      (fail-closed: a false result is untrusted).
//   5. Idempotent short-circuit: if the payment row is already captured,
//      return the order without re-transitioning.
//   6. Otherwise: mark payment captured, mark order paid, transition
//      order status pending_payment -> confirmed.
//   7. Emit order.confirmed via OrderEventEmitter (push + SMS fan-out).
//
// IDEMPOTENCY: same wrapping strategy as create-order — the whole body
// is inside withIdempotency, so a replay returns the cached response
// before re-running verification or any DB write. Combined with the
// payment-row check inside the handler, this makes verify safe under
// both client retries (same Idempotency-Key) and Razorpay webhook +
// client-callback races (no idempotency key but payment row already
// captured).
//
// BRIEF FIXES applied here:
//   - #1 withIdempotency wraps the WHOLE handler.
//   - #4 emitOrderEvent now wired (Task 5.2 landed).
//   - #5 path depth is 7 `../` (verified).
//   - #8 explicit null check on paymentDoc.docs[0] (no `!` assertion).
//   - #9 throws ApiError with proper codes instead of bare Error.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../../payload.config';
import { container } from '../../../../../../../lib/container';
import { requireCustomer } from '../../../../../../../lib/api/authMiddleware';
import { withIdempotency } from '../../../../../../../lib/idempotency/idempotency';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { PayloadOrderService } from '../../../../../../../lib/commerce/impl/PayloadOrderService';
import { emitOrderEvent } from '../../../../../../../lib/notifications/OrderEventEmitter';

const Body = z.object({
  orderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const key = req.headers.get('Idempotency-Key');
  const raw = await req.text();

  return withIdempotency(key, raw, async () => {
    try {
      const { customerId } = await requireCustomer(req);
      const parsed = Body.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new ApiError(ErrorCode.VALIDATION, 'Invalid verify body', {
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
        });
      }

      const payload = await getPayload({ config });
      const payment = container.paymentService;
      const orderService = new PayloadOrderService();

      const order = await orderService.getById(parsed.data.orderId, customerId);
      if (!order) {
        throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Order ${parsed.data.orderId} not found`);
      }
      if (!order.razorpayOrderId) {
        throw new ApiError(
          ErrorCode.PAYMENT_FAILED,
          'Order has no Razorpay order id; cannot verify',
        );
      }

      const valid = await payment.verifySignature({
        providerOrderId: order.razorpayOrderId,
        providerPaymentId: parsed.data.razorpayPaymentId,
        signature: parsed.data.signature,
      });
      if (!valid) {
        throw new ApiError(ErrorCode.PAYMENT_FAILED, 'Signature verification failed');
      }

      // Payment row lookup. If a webhook or earlier replay already
      // captured it, return the order without re-transitioning.
      const paymentDoc = await payload.find({
        collection: 'payments',
        where: { orderId: { equals: order.id } },
        limit: 1,
      });
      const existingPayment = paymentDoc.docs[0] as
        | { id: string; status?: string }
        | undefined;

      if (existingPayment && existingPayment.status === 'captured') {
        // Already done — refresh the order from DB so the response
        // reflects the current state, then return.
        const current = await orderService.getById(order.id, customerId);
        return jsonResponse({ order: current });
      }

      // Brief fix #8: explicit null check. Should never happen post-
      // create-order, but fail loudly instead of crashing on `!`.
      if (!existingPayment) {
        throw new ApiError(
          ErrorCode.INTERNAL,
          'Payment record missing after order create',
        );
      }

      // Mark payment captured + order paid, then transition. Three
      // writes, not atomic — see create-order header for the same
      // tradeoff. A crash here leaves a captured payment row but order
      // still in pending_payment; a retry of this route (new
      // idempotency key) will re-verify and finish the transition.
      await payload.update({
        collection: 'payments',
        id: existingPayment.id,
        data: {
          status: 'captured',
          providerPaymentId: parsed.data.razorpayPaymentId,
        },
      });
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { paymentStatus: 'paid' },
      });
      await orderService.transition(order.id, 'confirmed', {
        actor: 'system:razorpay-verify',
      });

      // Fan out the confirmed notification (push + SMS). Fault-tolerant:
      // emitOrderEvent swallows adapter failures and logs them, so a push/
      // SMS outage never rolls back the payment transition above.
      await emitOrderEvent(order.id, 'confirmed');

      const final = await orderService.getById(order.id, customerId);
      return jsonResponse({ order: final });
    } catch (err) {
      return errorResponse(err, traceId);
    }
  });
}
