// app/api/staff/orders/[id]/refund/route.ts
// Ops-initiated refund — admin roadmap Wave 2 (#130).
//
// POST refunds a captured online payment through the PaymentService adapter
// (Razorpay in prod, Fake under PAYMENT_PROVIDER=fake / tests). Full refund
// by default; pass amountInPaise for a partial. Scope guards:
//   - COD order -> 409 (cash refunds settle offline, not via the gateway)
//   - no captured/partially-refunded payment with a providerPaymentId -> 409
//   - amount exceeding the un-refunded remainder -> 409
//
// On success the payment doc accumulates refundedInPaise + a refunds[] audit
// row and flips to refunded/partially_refunded; the order's paymentStatus
// follows. Fulfillment status (cancelled/returned) stays with the existing
// transition route — this route moves money, not boxes.
//
// Failure ordering note: the provider refund runs FIRST; if the local
// persistence then fails, the provider refund is NOT rolled back — the error
// surfaces the provider refund id so ops can reconcile manually.
//
// Path depth: app/api/staff/orders/[id]/refund/ = 6 dirs -> 6 `../`.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { getPayloadAdminUser } from '../../../../../../lib/api/adminAuth';
import { container } from '../../../../../../lib/container';

const Body = z.object({
  amountInPaise: z.number().int().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const user = await getPayloadAdminUser(req);
    if (!user) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Staff auth required');
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid refund body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { amountInPaise, reason } = parsed.data;
    const { id } = await ctx.params;

    const payload = await getPayload({ config });

    let order: Record<string, unknown> | null;
    try {
      order = (await payload.findByID({
        collection: 'orders',
        id,
        overrideAccess: true,
        depth: 0,
      })) as Record<string, unknown>;
    } catch {
      order = null;
    }
    if (!order) {
      throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Order ${id} not found`);
    }
    if ((order.paymentMethod ?? 'razorpay') !== 'razorpay') {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Cash refunds settle offline at the door — gateway refunds apply to prepaid orders only',
      );
    }

    // Latest captured (or partially refunded) online payment for this order.
    const payments = await payload.find({
      collection: 'payments',
      where: {
        and: [
          { orderId: { equals: id } },
          { providerPaymentId: { exists: true } },
          { status: { in: ['captured', 'partially_refunded'] } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const pay = payments.docs[0] as
      | {
          id: string;
          providerPaymentId: string;
          amountInPaise: number;
          refundedInPaise?: number;
          refunds?: unknown[];
        }
      | undefined;
    if (!pay) {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'No captured online payment found for this order',
      );
    }

    const already = pay.refundedInPaise ?? 0;
    const remaining = pay.amountInPaise - already;
    if (remaining <= 0) {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'This payment is already fully refunded',
      );
    }
    const amount = amountInPaise ?? remaining;
    if (amount > remaining) {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Refund of ₹${(amount / 100).toFixed(2)} exceeds the un-refunded remainder of ₹${(remaining / 100).toFixed(2)}`,
      );
    }

    const { providerRefundId } = await container.paymentService.refund({
      providerPaymentId: pay.providerPaymentId,
      amountInPaise: amount,
      notes: {
        orderId: id,
        reason: reason ?? 'ops-initiated',
        by: user.email ?? String(user.id),
      },
    });

    const totalRefunded = already + amount;
    const status =
      totalRefunded >= pay.amountInPaise ? 'refunded' : 'partially_refunded';

    try {
      await payload.update({
        collection: 'payments',
        id: pay.id,
        data: {
          status,
          refundedInPaise: totalRefunded,
          refunds: [
            ...(pay.refunds ?? []),
            {
              providerRefundId,
              amountInPaise: amount,
              reason: reason ?? null,
              refundedBy: user.email ?? String(user.id),
              refundedAt: new Date().toISOString(),
            },
          ],
        },
        overrideAccess: true,
      });
      await payload.update({
        collection: 'orders',
        id,
        data: { paymentStatus: status },
        overrideAccess: true,
      });
    } catch {
      // Provider refund already happened — do not retry it. Surface the id.
      throw new ApiError(
        ErrorCode.INTERNAL,
        `Refund ${providerRefundId} succeeded at the provider but local bookkeeping failed — reconcile the payment doc manually`,
      );
    }

    return jsonResponse(
      {
        paymentId: String(pay.id),
        providerRefundId,
        refundedInPaise: amount,
        totalRefundedInPaise: totalRefunded,
        status,
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
