// lib/admin/ordersBoard.ts
// Pure helpers for the ops orders board (Task 5.4) — kept free of React/JSX so
// the column config, transition legality, and status->column bucketing are
// unit-testable without a browser.
//
// The board shows the forward fulfillment pipeline as kanban columns. Side
// states (cancelled / failed_delivery / returned / payment_failed / abandoned)
// are bucketed into a single "blocked" column so ops sees what needs attention
// without losing the happy-path left-to-right flow.
import {
  ORDER_TRANSITIONS,
  type OrderStatus,
} from "../commerce/types";

// Left-to-right fulfillment pipeline. Order matters — it drives the visual flow.
export const BOARD_COLUMNS = [
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
] as const satisfies readonly OrderStatus[];

export type BoardColumn = (typeof BOARD_COLUMNS)[number];

// Pre-payment / terminal failure states grouped for visibility.
export const BLOCKED_STATUSES: OrderStatus[] = [
  "payment_failed",
  "cancelled",
  "failed_delivery",
  "returned",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  created: "Created",
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  packed: "Packed",
  dispatched: "Dispatched",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  returned: "Returned",
  failed_delivery: "Failed delivery",
  abandoned: "Abandoned",
};

// Tailwind color token per column header. Kept as a string the component maps
// to classes (avoids dynamic class-name construction that Tailwind purges).
export const STATUS_ACCENT: Record<BoardColumn | "blocked", string> = {
  confirmed: "amber",
  packed: "blue",
  dispatched: "indigo",
  out_for_delivery: "violet",
  delivered: "emerald",
  blocked: "rose",
};

// Which board bucket an order belongs in. Fulfillment stages map to their own
// column; created/pending_payment wait off-board (not yet actionable by ops);
// everything else (failures) lands in "blocked".
export function columnForStatus(status: OrderStatus): BoardColumn | "blocked" | null {
  if ((BOARD_COLUMNS as readonly string[]).includes(status)) {
    return status as BoardColumn;
  }
  if (BLOCKED_STATUSES.includes(status)) return "blocked";
  // created / pending_payment — not shown on the ops board.
  return null;
}

// Legal drag-and-drop target check. Mirrors the backend state machine so the
// UI can't offer a transition the API would 409 on.
export function canAdvance(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
