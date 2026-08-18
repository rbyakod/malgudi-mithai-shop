// lib/commerce/impl/PayloadOrderService.ts
// Payload 3.x implementation of OrderService — Task 4.2 (Mishran Mobile Apps v1).
//
// Brief fixes applied vs task-4.2-brief.md:
//  1. Shipment update: brief used `payload.update({ collection:'shipments', where, data })`
//     which does NOT exist in Payload 3.x. Replaced with find-by-orderId then
//     update-by-id. When no shipment row exists yet, we skip (shipment row is
//     created lazily by a later fulfillment task; order transition still succeeds).
//  2. Shipment `currentStage` cast to the Shipments collection's narrower enum
//     (excludes created/pending_payment/payment_failed/abandoned). The cast
//     preserves type safety at the boundary; transitions that would land on a
//     non-shipment stage are short-circuited (no shipment row touched).
import { getPayload } from "payload";
import config from "../../../payload.config";
import type { Order, OrderStatus } from "../types";
import { ORDER_TRANSITIONS } from "../types";
import type { OrderCreateSnapshot, OrderService } from "../OrderService";
import { ApiError, ErrorCode } from "../../api/errors";

// Shipments.currentStage enum (see collections/Shipments.ts). Stages that
// belong purely to the payment lifecycle are NOT mirrored to the shipment row.
const SHIPMENT_STAGES = new Set<OrderStatus>([
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "failed_delivery",
]);

export class PayloadOrderService implements OrderService {
  async createFromSnapshot(
    snapshot: OrderCreateSnapshot,
    customerId: string,
    source: "mobile-android" | "mobile-ios" | "web",
  ): Promise<Order> {
    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: "orders",
      data: {
        customerId,
        // Copy snapshot items through explicitly so packLabel (the exact
        // pack a reorder must re-add, `${productId}:${packLabel}`) survives
        // the Orders.items schema rather than being stripped as unknown.
        items: snapshot.items.map((item) => ({
          productId: item.productId,
          slug: item.slug,
          name: item.name,
          quantity: item.quantity,
          packLabel: item.packLabel ?? null,
          unit: item.unit,
          priceInPaise: item.priceInPaise,
          image: item.image ?? null,
        })),
        totals: snapshot.totals,
        status: "pending_payment",
        paymentStatus: "pending",
        // Coupon stamped on the snapshot by /cart/validate (B7).
        couponCode: snapshot.couponCode ?? null,
        deliveryAddressId: snapshot.deliveryAddressId,
        slot: snapshot.slot,
        source,
        cartSnapshotId: snapshot.snapshotId,
      },
    });

    // Burn the coupon (B7): usedCount is incremented exactly once per order
    // created with the code — this is its ONLY writer; /cart/validate reads
    // the counters on every call but consumes nothing. Both the razorpay
    // path (today) and the COD path (B12) funnel through here, so a code
    // is charged the same redemption either way.
    //
    // Cancellations deliberately do NOT decrement: usedCount is lifetime
    // redemptions, and a cancelled order keeps the customer's
    // per-customer slot too (guards code-share abuse; staff can correct a
    // miscount by hand). The read-modify-write race (two concurrent orders
    // both reading N and writing N+1) is accepted for v1 — the limit check
    // at validate time reads the same slightly-lagging counter anyway.
    if (snapshot.couponCode) {
      const couponDocs = await payload.find({
        collection: "coupons",
        where: { code: { equals: snapshot.couponCode } },
        limit: 1,
      });
      const couponDoc = couponDocs.docs[0] as
        | { id: string; usedCount?: number }
        | undefined;
      if (couponDoc) {
        await payload.update({
          collection: "coupons",
          id: couponDoc.id,
          data: { usedCount: (couponDoc.usedCount ?? 0) + 1 },
        });
      }
    }

    return this.mapDoc(created);
  }

  async getById(id: string, customerId: string): Promise<Order | null> {
    const payload = await getPayload({ config });
    try {
      // overrideAccess: true (the local-API default we rely on everywhere
      // else here) because the orders collection has no public read
      // access config — with overrideAccess: false the anonymous local
      // read is denied and EVERY getById returned null (verify 404s,
      // GET /orders/[id] 404s). Authorization is the customerId check
      // below. depth: 0 keeps the customerId relation an id string.
      const doc = await payload.findByID({
        collection: "orders",
        id,
        overrideAccess: true,
        depth: 0,
      });
      if (!doc) return null;
      if ((doc as { customerId?: string }).customerId !== customerId) return null;
      return this.mapDoc(doc);
    } catch {
      return null;
    }
  }

  async listForCustomer(customerId: string, page: number, pageSize: number) {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "orders",
      where: { customerId: { equals: customerId } },
      page,
      limit: pageSize,
      sort: "-createdAt",
    });
    return {
      items: result.docs.map((d) => this.mapDoc(d)),
      total: result.totalDocs,
    };
  }

  async transition(
    orderId: string,
    newStatus: OrderStatus,
    opts: { actor: string; note?: string },
  ): Promise<Order> {
    const payload = await getPayload({ config });
    // Payload's findByID throws (statusCode 404) when the doc is missing.
    // Convert either outcome (null return or thrown 404) into ORDER_NOT_FOUND
    // so callers see a consistent ApiError.
    let doc: Record<string, unknown> | null;
    try {
      doc = (await payload.findByID({
        collection: "orders",
        id: orderId,
      })) as Record<string, unknown> | null;
    } catch {
      throw new ApiError(
        ErrorCode.ORDER_NOT_FOUND,
        `Order ${orderId} not found`,
      );
    }
    if (!doc) {
      throw new ApiError(
        ErrorCode.ORDER_NOT_FOUND,
        `Order ${orderId} not found`,
      );
    }
    const current = doc.status as OrderStatus;
    const allowed = ORDER_TRANSITIONS[current];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new ApiError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot transition ${current} -> ${newStatus}`,
      );
    }

    const updated = await payload.update({
      collection: "orders",
      id: orderId,
      data: { status: newStatus },
    });

    // Shipment row is only touched when the new stage is one the Shipments
    // collection models. Payment-side stages (pending_payment, payment_failed,
    // abandoned, created) have no shipment representation.
    if (SHIPMENT_STAGES.has(newStatus)) {
      const shipmentQuery = await payload.find({
        collection: "shipments",
        where: { orderId: { equals: orderId } },
        limit: 1,
      });
      const existing = shipmentQuery.docs[0] as
        | { id: string; history?: Array<Record<string, unknown>> }
        | undefined;
      if (existing) {
        await payload.update({
          collection: "shipments",
          id: existing.id,
          data: {
            currentStage: newStatus,
            history: [
              ...(existing.history ?? []),
              {
                stage: newStatus,
                at: new Date().toISOString(),
                note: opts.note,
                actor: opts.actor,
              },
            ],
          },
        });
      }
      // If no shipment row exists yet, skip silently — a later fulfillment
      // task owns shipment-row creation. Order transition already succeeded.
    }

    return this.mapDoc(updated);
  }

  private mapDoc(doc: unknown): Order {
    const d = doc as Record<string, unknown>;
    return {
      id: d.id as string,
      customerId: d.customerId as string,
      items: d.items as Order["items"],
      totals: d.totals as Order["totals"],
      status: d.status as OrderStatus,
      paymentStatus: d.paymentStatus as Order["paymentStatus"],
      deliveryAddressId: d.deliveryAddressId as string,
      slot: d.slot as Order["slot"],
      source: d.source as Order["source"],
      couponCode: (d.couponCode as string | null | undefined) ?? null,
      razorpayOrderId: d.razorpayOrderId as string | undefined,
      createdAt: d.createdAt as string,
      updatedAt: d.updatedAt as string,
    };
  }
}
