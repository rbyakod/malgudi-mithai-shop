// app/api/mobile/v1/orders/[id]/route.ts
// Order detail endpoint — Task 4.6 (Mishran Mobile Apps v1).
//
// Customer-scoped. Authentication required. Returns a single order by id.
// The service layer's getById returns null both when the order is missing
// AND when it belongs to a different customer — so we never leak the
// existence of another customer's order. Either case maps to a 404
// ORDER_NOT_FOUND here.
//
// Path depth: app/api/mobile/v1/orders/[id]/ = 6 dirs under app/ -> 7 `../` to root.
import { NextRequest } from 'next/server';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { PayloadOrderService } from '../../../../../../lib/commerce/impl/PayloadOrderService';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const { id } = await ctx.params;
    const svc = new PayloadOrderService();
    const order = await svc.getById(id, customerId);
    if (!order) {
      throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Order ${id} not found`);
    }
    return jsonResponse(order, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
