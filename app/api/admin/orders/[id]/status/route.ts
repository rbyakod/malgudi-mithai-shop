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
// Auth (hardened in known-gaps B13, see lib/api/adminAuth.ts): the session is
// verified server-side via getPayloadAdminUser — Payload's payload.auth
// resolves the `payload-token` cookie / Authorization JWT against the
// `users` collection. A cheap Bearer-presence gate sits in front so
// anonymous scanners never touch Payload. Unauthenticated or non-staff
// requests get 401; covered by route tests.
//
// Notifications (Task 5.2): after a successful transition, emitOrderEvent
// fans the new status out to push + SMS. No-ops on non-customer-facing
// stages; fault-tolerant (never rolls back the transition).
import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonResponse, errorResponse } from "../../../../../../lib/api/response";
import { ApiError, ErrorCode } from "../../../../../../lib/api/errors";
import { getPayloadAdminUser } from "../../../../../../lib/api/adminAuth";
import { PayloadOrderService } from "../../../../../../lib/commerce/impl/PayloadOrderService";
import { emitOrderEvent } from "../../../../../../lib/notifications/OrderEventEmitter";
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

    // Auth gate 2: resolve the staff user from the Payload session. No
    // staff user -> 401 (the accept-any-Bearer v1 shortcut is gone).
    const user = await getPayloadAdminUser(req);
    if (!user) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, "Admin auth required");
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

    const actor = `admin:${user.id}`;
    const svc = new PayloadOrderService();
    const updated = await svc.transition(id, parsed.data.newStatus, {
      actor,
      note: parsed.data.note,
    });

    // Fan out the notification for the new status. emitOrderEvent no-ops on
    // stages with no template (created, pending_payment, payment_failed,
    // cancelled, etc.) — only customer-facing delivery stages push/SMS.
    // Fault-tolerant: a notification outage never rolls back the transition.
    await emitOrderEvent(id, parsed.data.newStatus);
    return jsonResponse({ order: updated }, { headers: { "X-Request-Id": traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
