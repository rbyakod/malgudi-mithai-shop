// app/api/staff/orders/[id]/packing-slip/route.ts
// Packing slip for one order — admin roadmap Wave 1 (#126).
//
// GET returns the print-ready projection: items with line totals, the
// populated delivery address + customer phone, totals breakdown, delivery
// slot, payment method (COD badge), and coupon. Same staff boundary as the
// console feed — getPayloadAdminUser; a 401 renders the sign-in hint
// client-side.
//
// Path depth: app/api/staff/orders/[id]/packing-slip/ = 6 dirs -> 6 `../`.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { getPayloadAdminUser } from '../../../../../../lib/api/adminAuth';
import { toPackingSlip } from '../../../../../../lib/admin/packingSlip';

export async function GET(
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

    let doc: Record<string, unknown>;
    try {
      doc = (await payload.findByID({
        collection: 'orders',
        id,
        // depth 1 populates customerId + deliveryAddressId for the slip.
        depth: 1,
        overrideAccess: true,
      })) as Record<string, unknown>;
    } catch {
      throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Order ${id} not found`);
    }

    return jsonResponse(toPackingSlip(doc), {
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
