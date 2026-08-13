// lib/commerce/DeliveryService.ts
// DeliveryService interface — Task 5.1 (Mishran Mobile Apps v1).
//
// Adapter contract for shipment lifecycle. v1 ships a manual operator-driven
// impl (./impl/ManualDeliveryService.ts) that records shipment stages in the
// Shipments collection without any third-party courier integration. Future
// courier integrations (Shiprocket, Delhivery, etc.) implement this same
// interface — the route layer stays unchanged when a new impl is swapped in
// via the DI container (adapter pattern; see lib/auth/OtpService.ts for the
// reference file layout).
//
// `ShipmentStage` mirrors Shipments.currentStage (see collections/Shipments.ts).
// It's a strict subset of OrderStatus — payment-side stages (created,
// pending_payment, payment_failed, abandoned) have no shipment representation.

export type ShipmentStage =
  | "confirmed"
  | "packed"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "failed_delivery";

export interface ShipmentHistoryEntry {
  at: string;
  stage: ShipmentStage;
  note?: string;
  actor?: string;
}

export interface ShipmentTracking {
  currentStage: ShipmentStage;
  history: ShipmentHistoryEntry[];
}

export interface CreateShipmentOptions {
  orderId: string;
}

export interface CreateShipmentResult {
  /**
   * Provider-side shipment id (e.g. Shiprocket shipment id). The manual
   * operator-driven flow produces no provider id, so this is undefined
   * for ManualDeliveryService — the row in `shipments` is still written.
   */
  providerShipmentId?: string;
}

export interface DeliveryService {
  /**
   * Create a shipment record for the order. Idempotent: if a shipment row
   * already exists for the order, return it without duplicating.
   */
  createShipment(opts: CreateShipmentOptions): Promise<CreateShipmentResult>;

  /**
   * Look up shipment tracking state for an order. Implementations MUST NOT
   * throw when no shipment row exists — return a synthetic
   * `{ currentStage: 'confirmed', history: [] }` instead.
   */
  trackShipment(orderId: string): Promise<ShipmentTracking>;
}
