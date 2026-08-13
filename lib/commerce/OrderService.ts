// lib/commerce/OrderService.ts
// OrderService interface — Task 4.2 (Mishran Mobile Apps v1).
// Concrete impl (PayloadOrderService) lives in ./impl/PayloadOrderService.ts.
// Wired into the DI container in a later task.
import type { Order, OrderStatus } from "./types";

/**
 * Cart snapshot shape passed to createFromSnapshot. Loose-typed here to
 * avoid coupling the interface to the cart module; the impl only reads
 * known keys (items, totals, deliveryAddressId, slot, snapshotId).
 */
export interface OrderCreateSnapshot {
  snapshotId: string;
  items: Order["items"];
  totals: Order["totals"];
  deliveryAddressId: string;
  slot?: { date: string; window: string };
}

export interface OrderListResult {
  items: Order[];
  total: number;
}

export interface TransitionOptions {
  actor: string;
  note?: string;
}

export interface OrderService {
  createFromSnapshot(
    snapshot: OrderCreateSnapshot,
    customerId: string,
    source: "mobile-android" | "mobile-ios" | "web",
  ): Promise<Order>;
  getById(id: string, customerId: string): Promise<Order | null>;
  listForCustomer(
    customerId: string,
    page: number,
    pageSize: number,
  ): Promise<OrderListResult>;
  transition(
    orderId: string,
    newStatus: OrderStatus,
    opts: TransitionOptions,
  ): Promise<Order>;
}
