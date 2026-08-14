// app/api/mobile/v1/payments/razorpay/create-order/route.ts
// Razorpay create-order — Task 4.4 (Mishran Mobile Apps v1).
//
// Flow:
//   1. Authn (requireCustomer).
//   2. Validate body (snapshotId, deliveryAddressId).
//   3. Fetch the persisted cart snapshot by id, scoped to the customer.
//   4. Reject if missing or expired (server-trust property).
//   5. Create the order in our DB (status=pending_payment) via
//      PayloadOrderService.createFromSnapshot.
//   6. Create the Razorpay order via the PaymentService adapter.
//   7. Stamp razorpayOrderId on the order + create a payments row.
//   8. Return the public Razorpay key id + amount so the client can open
//      the Razorpay checkout widget.
//
// IDEMPOTENCY:
//   The entire body is wrapped in withIdempotency so a replay with the
//   same Idempotency-Key + body short-circuits BEFORE any side effect
//   (no duplicate orders / Razorpay orders / payment rows). Note this
//   also caches error responses (4xx/5xx) per the helper's contract —
//   a flaky client that retries with the same key after a transient
//   500 will keep getting the cached 500 back until the key expires.
//   Callers that want a fresh attempt after a failure MUST use a new
//   Idempotency-Key.
//
// BRIEF FIXES applied here (see task-4.4-brief.md + controller notes):
//   - #1 withIdempotency wraps the WHOLE handler (not just the response).
//   - #3 snapshot fetched from persisted `snapshots` collection.
//   - #5 path depth is 7 `../` (verified), not 8 as the brief shows.
//   - #7 source derived from X-Client-Source header, validated.
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
import type { OrderCreateSnapshot } from '../../../../../../../lib/commerce/OrderService';
import type { OrderSource } from '../../../../../../../lib/commerce/types';

const Body = z.object({
  snapshotId: z.string().min(1),
  deliveryAddressId: z.string().min(1),
});

const VALID_SOURCES: ReadonlySet<string> = new Set(['mobile-android', 'mobile-ios', 'web']);

function resolveSource(req: NextRequest): OrderSource {
  const raw = req.headers.get('X-Client-Source') ?? 'mobile-android';
  if (!VALID_SOURCES.has(raw)) {
    throw new ApiError(ErrorCode.VALIDATION, `Unsupported X-Client-Source "${raw}"`);
  }
  return raw as OrderSource;
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const key = req.headers.get('Idempotency-Key');
  const raw = await req.text();

  // Wrap the whole route body so idempotent replays short-circuit before
  // any side effect (order/payment/Razorpay call). See file header.
  return withIdempotency(key, raw, async () => {
    try {
      const { customerId } = await requireCustomer(req);
      const parsed = Body.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new ApiError(ErrorCode.VALIDATION, 'Invalid create-order body', {
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
        });
      }

      const source = resolveSource(req);

      const payload = await getPayload({ config });
      const payment = container.paymentService;
      const orderService = new PayloadOrderService();

      // Server-trust: re-read the persisted snapshot. Must belong to this
      // customer and must not be expired.
      let snapshotDoc: { id: string; customerId?: string; items?: unknown; totals?: unknown; slot?: unknown; expiresAt?: string } | null;
      try {
        snapshotDoc = (await payload.findByID({
          collection: 'snapshots',
          id: parsed.data.snapshotId,
          overrideAccess: false,
        })) as typeof snapshotDoc;
      } catch {
        snapshotDoc = null;
      }
      if (!snapshotDoc || snapshotDoc.customerId !== customerId) {
        throw new ApiError(
          ErrorCode.SNAPSHOT_NOT_FOUND,
          `Cart snapshot ${parsed.data.snapshotId} not found`,
        );
      }
      const expiresAtMs = snapshotDoc.expiresAt ? Date.parse(snapshotDoc.expiresAt) : NaN;
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        throw new ApiError(ErrorCode.VALIDATION, 'Cart snapshot has expired');
      }

      // Map persisted snapshot -> OrderCreateSnapshot. Items/totals are
      // stored as json; cast through the OrderCreateSnapshot boundary.
      const snapshot: OrderCreateSnapshot = {
        snapshotId: String(snapshotDoc.id),
        items: snapshotDoc.items as OrderCreateSnapshot['items'],
        totals: snapshotDoc.totals as OrderCreateSnapshot['totals'],
        deliveryAddressId: parsed.data.deliveryAddressId,
        slot: snapshotDoc.slot as OrderCreateSnapshot['slot'],
      };

      // Create order in our DB.
      const order = await orderService.createFromSnapshot(snapshot, customerId, source);

      // Create Razorpay order via adapter. Failure here surfaces as a
      // 500 (raw Error from the adapter -> errorResponse maps non-ApiError
      // to INTERNAL). The order row is left in pending_payment; a later
      // reconciliation job or a fresh create-order call (new idempotency
      // key) will retry.
      const { providerOrderId } = await payment.createOrder({
        amountInPaise: order.totals.totalInPaise,
        receipt: order.id,
      });

      // Persist providerOrderId on the order + create the payments row.
      // These two writes are not atomic today; a crash between them
      // leaves an order with razorpayOrderId set and no payments row.
      // Acceptable for v1 — the verify route creates no payment row, so
      // the missing row is observable but not fatal. TODO: wrap in a
      // transaction once Payload 3.x transaction support is wired.
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { razorpayOrderId: providerOrderId },
      });
      await payload.create({
        collection: 'payments',
        data: {
          orderId: order.id,
          provider: 'razorpay',
          providerOrderId,
          status: 'created',
          amountInPaise: order.totals.totalInPaise,
          currency: 'INR',
        },
      });

      return jsonResponse({
        orderId: order.id,
        razorpayOrderId: providerOrderId,
        amountInPaise: order.totals.totalInPaise,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      });
    } catch (err) {
      return errorResponse(err, traceId);
    }
  });
}
