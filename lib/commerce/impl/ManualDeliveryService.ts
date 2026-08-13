// lib/commerce/impl/ManualDeliveryService.ts
// Manual, operator-driven DeliveryService impl — Task 5.1 (Mishran Mobile Apps v1).
//
// No third-party courier integration in v1. Operators update order status via
// the admin route (app/api/admin/orders/[id]/status/route.ts); OrderService
// mirrors shipment-touching stages into the Shipments row. This impl is the
// create-on-demand + tracking read side of that flow.
//
// Adapter pattern: a future Shiprocket/Delhivery impl will satisfy the same
// DeliveryService interface; the route + DI container stay unchanged.
import { getPayload } from "payload";
import config from "../../../payload.config";
import type {
  CreateShipmentOptions,
  CreateShipmentResult,
  DeliveryService,
  ShipmentTracking,
} from "../DeliveryService";

export class ManualDeliveryService implements DeliveryService {
  /**
   * Create a Shipments row for the order with currentStage='confirmed' and
   * an initial history entry. Idempotent: if a row already exists for the
   * order, return without duplicating.
   */
  async createShipment(
    opts: CreateShipmentOptions,
  ): Promise<CreateShipmentResult> {
    const payload = await getPayload({ config });

    const existing = await payload.find({
      collection: "shipments",
      where: { orderId: { equals: opts.orderId } },
      limit: 1,
    });
    if (existing.docs[0]) {
      // Idempotent — manual flow produces no provider id either way.
      return {};
    }

    const now = new Date().toISOString();
    await payload.create({
      collection: "shipments",
      data: {
        orderId: opts.orderId,
        currentStage: "confirmed",
        history: [
          {
            stage: "confirmed",
            at: now,
            note: "Shipment row created (manual flow)",
          },
        ],
      },
    });

    // Manual operator-driven flow has no provider shipment id.
    return {};
  }

  /**
   * Read the Shipments row for an order. If no row exists, return a synthetic
   * `{ currentStage: 'confirmed', history: [] }` — never throws.
   */
  async trackShipment(orderId: string): Promise<ShipmentTracking> {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "shipments",
      where: { orderId: { equals: orderId } },
      limit: 1,
    });
    const row = result.docs[0] as
      | {
          currentStage?: ShipmentTracking["currentStage"];
          history?: ShipmentTracking["history"];
        }
      | undefined;
    if (!row) {
      return { currentStage: "confirmed", history: [] };
    }
    return {
      currentStage: row.currentStage ?? "confirmed",
      history: row.history ?? [],
    };
  }
}
