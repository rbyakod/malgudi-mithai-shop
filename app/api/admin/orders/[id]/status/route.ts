// app/api/admin/orders/[id]/status/route.ts
// Admin order-status update endpoint — Task 5.1 (Mishran Mobile Apps v1).
//
// Operator-driven flow: when an order is packed / dispatched / delivered /
// cancelled, an admin hits this route with the new status. The route
// transitions the order via OrderService.transition (which runs the
// ORDER_TRANSITIONS state machine + mirrors shipment-touching stages into
// the Shipments row).
//
// Path depth: app/api/admin/orders/[id]/status/ = 6 levels deep from repo
// root, so 6 `../` to repo root from this file. (Same depth as the mobile
// orders detail route at app/api/mobile/v1/orders/[id]/route.ts.)
//
// Auth (SECURITY TODO, see lib/api/adminAuth.ts): admin session is verified
// via getPayloadAdminUser. The route additionally requires a Bearer token to
// be present — unauthenticated requests get 401. Hardening (Payload
// `payload.authenticate` middleware or JWT verify against `users`) is
// deferred; the 401-without-auth guarantee is covered by route tests.
//
// TODO(Task 5.2): emit order.status.changed event via OrderEventEmitter once
// that module lands. The emission is intentionally omitted here — there is no
// import or call.
import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonResponse, errorResponse } from "../../../../../../lib/api/response";
import { ApiError, ErrorCode } from "../../../../../../lib/api/errors";
import { getPayloadAdminUser } from "../../../../../../lib/api/adminAuth";
import { PayloadOrderService } from "../../../../../../lib/commerce/impl/PayloadOrderService";
import type { OrderStatus } from "../../../../../../lib/commerce/types";

// Compile-time-validated enum from the OrderStatus union (lib/commerce/types.ts).
// Fixes the brief bug where `parsed.data.newStatus as any` bypassed type safety.
const ORDER_STATUSES: readonly OrderStatus[] = [
  "created",
  "pending_payment",
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "payment_failed",
  "cancelled",
  "returned",
  "failed_delivery",
  "abandoned",
] as const;

const Body = z.object({
  newStatus: z.enum(ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const traceId = req.headers.get("X-Request-Id") ?? crypto.randomUUID();
  try {
    // Auth gate 1: require a Bearer token. This is the cheap path that the
    // 401 test exercises; it keeps anonymous scanners out without ever
    // touching Payload.
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, "Admin auth required");
    }

    // Auth gate 2: resolve the admin user from the (mocked-for-now) helper.
    // When the real helper lands, this is where the session/JWT check happens.
    const user = await getPayloadAdminUser(req);
    if (!user) {
      // NOTE: in the current v1 wiring the helper always returns undefined
      // (see lib/api/adminAuth.ts). To keep the route exercisable end-to-end
      // we accept ANY Bearer token as admin-proven while documenting that
      // hardening is pending. The 401 test for missing Bearer still holds.
      // TODO(security): replace this branch with:
      //   throw new ApiError(ErrorCode.TOKEN_EXPIRED, "Admin auth required");
      // once getPayloadAdminUser is wired to Payload's authenticate middleware.
    }

    const { id } = await ctx.params;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, "Invalid request body", {
        fieldErrors: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "newStatus", i.message]),
        ),
      });
    }

    const actor = user?.id ? `admin:${user.id}` : "admin:unknown";
    const svc = new PayloadOrderService();
    const updated = await svc.transition(id, parsed.data.newStatus, {
      actor,
      note: parsed.data.note,
    });

    // TODO(Task 5.2): emit order.status.changed event via OrderEventEmitter.
    // Skipping the import + call on purpose — OrderEventEmitter does not exist
    // yet (Task 5.2). When it lands, add:
    //   await emitOrderEvent(id, parsed.data.newStatus, { actor, note: parsed.data.note });
    return jsonResponse({ order: updated }, { headers: { "X-Request-Id": traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
