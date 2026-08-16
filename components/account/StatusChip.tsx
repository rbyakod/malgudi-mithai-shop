"use client";

// components/account/StatusChip.tsx
// Order status chip — quiet uppercase tracked label with a state dot
// (gold while in flight, green once delivered, muted for failures).
// Shared by the orders list and the order detail island.

import {useTranslations} from "next-intl";

export type OrderStatusValue =
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

const DONE: ReadonlySet<OrderStatusValue> = new Set(["delivered"]);
const FAILURE: ReadonlySet<OrderStatusValue> = new Set([
  "payment_failed",
  "cancelled",
  "returned",
  "failed_delivery",
  "abandoned",
]);

function dotClass(status: OrderStatusValue): string {
  if (DONE.has(status)) return "bg-green-500";
  if (FAILURE.has(status)) return "bg-text-muted";
  return "bg-gold";
}

export function StatusChip({status}: {status: OrderStatusValue}) {
  const t = useTranslations("Orders.status");
  return (
    <span
      data-testid="order-status"
      className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-text-secondary"
    >
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass(status)}`}
      />
      {t(status)}
    </span>
  );
}

export default StatusChip;
