// app/api/staff/orders/[id]/collect-cash/route.ts
// COD cash-collected action — known-gaps campaign B13.
//
// POST marks a cash-on-delivery order's paymentStatus pending -> paid once
// staff have the cash in hand. This is the ONLY writer of paymentStatus for
// COD orders (they are born pending and never pass through the Razorpay
// verify/webhook/reconcile paths). Scope guards:
//   - non-COD order -> 409 (online payments settle via Razorpay, not here)
//   - paymentStatus already paid -> 409 (no double-collect)
//
// Order *fulfillment* status is untouched — advancing confirmed -> packed ->
// delivered goes through the existing transition route.
//
// Path depth: app/api/staff/orders/[id]/collect-cash/ = 6 dirs -> 6 `../`.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { getPayloadAdminUser } from '../../../../../../lib/api/adminAuth';

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

    const { id } = await ctx.params;
    const payload = await getPayload({ config });

    let doc: Record<string, unknown> | null;
    try {
      doc = (await payload.findByID({
        collection: 'orders',
        id,
        overrideAccess: true,
        depth: 0,
      })) as Record<string, unknown>;
    } catch {
      doc = null;
    }
    if (!doc) {
      throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Order ${id} not found`);
    }

    const method = doc.paymentMethod ?? 'razorpay';
    if (method !== 'cod') {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Cash collection applies to COD orders only',
      );
    }
    if (doc.paymentStatus === 'paid') {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Cash already collected for this order',
      );
    }
    if (doc.paymentStatus !== 'pending') {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot collect cash while payment is ${String(doc.paymentStatus)}`,
      );
    }

    const updated = (await payload.update({
      collection: 'orders',
      id,
      data: { paymentStatus: 'paid' },
      overrideAccess: true,
    })) as Record<string, unknown>;

    // Minimal response — the console refreshes the row from the list feed.
    return jsonResponse(
      {
        id: String(updated.id),
        paymentStatus: updated.paymentStatus,
        paymentMethod: updated.paymentMethod,
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
