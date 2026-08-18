// app/api/mobile/v1/orders/cod/route.ts
// Cash-on-delivery order creation — known-gaps campaign B12.
//
// Mirrors Razorpay create-order's checks verbatim (requireCustomer,
// snapshot ownership + expiry + payable-total) but mints the order
// DIRECTLY — no provider order, no payments row, razorpayOrderId stays
// null so the webhook / verify / reconcile paths never see it. The order
// is born status=confirmed / paymentStatus=pending / paymentMethod=cod
// (a confirmed sale with cash pending at the door); staff mark cash
// collected (paymentStatus → paid) from the orders console (B13).
//
// Soft abuse guard: COD is refused while the customer has ≥2 prior COD
// orders with cash still pending at delivered/failed_delivery. This is
// an ops guard (stop the runaway tab), not fraud protection — the
// console is the real lever for chasing cash.
//
// Idempotency: the body is wrapped in withIdempotency like the Razorpay
// route, so a replayed request with the same Idempotency-Key + body
// short-circuits before the order is created.
//
// Path depth: app/api/mobile/v1/orders/cod/ = 6 dirs -> 6 `../` to root.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { withIdempotency } from '../../../../../../lib/idempotency/idempotency';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { PayloadOrderService } from '../../../../../../lib/commerce/impl/PayloadOrderService';
import { emitOrderEvent } from '../../../../../../lib/notifications/OrderEventEmitter';
import type { OrderCreateSnapshot } from '../../../../../../lib/commerce/OrderService';
import type { OrderSource } from '../../../../../../lib/commerce/types';

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

// Cash from COD orders that reached the doorstep (or failed to) but was
// never collected. Delivered rows that got marked paid drop out of the
// count; in-flight orders (confirmed/packed/…) do not count either — cash
// for those is expected to arrive with delivery.
const UNCOLLECTED_STATUSES = ['delivered', 'failed_delivery'] as const;

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const key = req.headers.get('Idempotency-Key');
  const raw = await req.text();

  return withIdempotency(key, raw, async () => {
    try {
      const { customerId } = await requireCustomer(req);
      const parsed = Body.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new ApiError(ErrorCode.VALIDATION, 'Invalid COD create-order body', {
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
        });
      }

      const source = resolveSource(req);
      const payload = await getPayload({ config });

      // Soft abuse guard — see file header.
      const uncollected = await payload.find({
        collection: 'orders',
        where: {
          and: [
            { customerId: { equals: customerId } },
            { paymentMethod: { equals: 'cod' } },
            { paymentStatus: { equals: 'pending' } },
            { status: { in: [...UNCOLLECTED_STATUSES] } },
          ],
        },
        limit: 1,
        depth: 0,
      });
      if (uncollected.totalDocs >= 2) {
        throw new ApiError(
          ErrorCode.VALIDATION,
          'Cash on delivery is unavailable while 2 or more cash orders await collection. ' +
            'Please pay online or contact support.',
        );
      }

      // Server-trust: re-read the persisted snapshot. Must belong to this
      // customer and must not be expired (same checks as Razorpay
      // create-order; see that route's notes on overrideAccess/depth).
      let snapshotDoc: { id: string; customerId?: string; items?: unknown; totals?: unknown; slot?: unknown; couponCode?: string | null; expiresAt?: string } | null;
      try {
        snapshotDoc = (await payload.findByID({
          collection: 'snapshots',
          id: parsed.data.snapshotId,
          overrideAccess: true,
          depth: 0,
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

      const snapshot: OrderCreateSnapshot = {
        snapshotId: String(snapshotDoc.id),
        items: snapshotDoc.items as OrderCreateSnapshot['items'],
        totals: snapshotDoc.totals as OrderCreateSnapshot['totals'],
        deliveryAddressId: parsed.data.deliveryAddressId,
        slot: snapshotDoc.slot as OrderCreateSnapshot['slot'],
        couponCode: snapshotDoc.couponCode ?? null,
      };

      // A zero-total snapshot has nothing to collect at the door.
      if (!snapshot.totals || !(snapshot.totals.totalInPaise > 0)) {
        throw new ApiError(
          ErrorCode.VALIDATION,
          'Cart snapshot has no payable total — re-validate the cart',
          { fieldErrors: { snapshotId: parsed.data.snapshotId } },
        );
      }

      // Born confirmed / cash pending / cod. No provider order, no
      // payments row (nothing for webhook or reconcile to pick up).
      const orderService = new PayloadOrderService();
      const order = await orderService.createFromSnapshot(snapshot, customerId, source, {
        paymentMethod: 'cod',
      });

      // Same confirmed notification the verified-payment path fires —
      // COD orders never pass through verify/webhook, so this is the only
      // emission point. The confirmed template copy ("We've received your
      // order #{id}") is payment-neutral; emitOrderEvent swallows channel
      // failures so this can never block the order.
      await emitOrderEvent(order.id, 'confirmed');

      return jsonResponse(order, { headers: { 'X-Request-Id': traceId } });
    } catch (err) {
      return errorResponse(err, traceId);
    }
  });
}
