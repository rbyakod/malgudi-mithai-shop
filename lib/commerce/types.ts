export type OrderStatus =
  | "created"
  | "pending_payment"
  | "confirmed"
  | "packed"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "payment_failed"
  | "cancelled"
  | "returned"
  | "failed_delivery"
  | "abandoned";

export type OrderSource = "mobile-android" | "mobile-ios" | "web";

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  /** Pack-size label the line was priced against; null/absent for base-pack lines. */
  packLabel?: string | null;
  unit: string;
  priceInPaise: number;
  image?: string;
}

export interface OrderTotals {
  itemsTotalInPaise: number;
  deliveryFeeInPaise: number;
  taxesInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totals: OrderTotals;
  status: OrderStatus;
  paymentStatus:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded";
  deliveryAddressId: string;
  slot?: { date: string; window: string };
  source: OrderSource;
  razorpayOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ["pending_payment", "cancelled", "abandoned"],
  pending_payment: ["confirmed", "payment_failed", "cancelled", "abandoned"],
  confirmed: ["packed", "cancelled"],
  packed: ["dispatched", "cancelled"],
  dispatched: ["out_for_delivery", "failed_delivery", "cancelled"],
  out_for_delivery: ["delivered", "failed_delivery"],
  delivered: ["returned"],
  payment_failed: ["cancelled"],
  cancelled: [],
  returned: [],
  failed_delivery: ["returned"],
  abandoned: [],
};
