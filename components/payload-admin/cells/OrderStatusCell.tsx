"use client";

// Audit §06: order status rendered as a colored pill instead of raw
// snake_case text. Tones reuse the .mishran-pill--* classes from
// app/(payload)/admin/custom.scss.
type Tone = "muted" | "primary" | "gold" | "success" | "danger" | "info";

const TONES: Record<string, Tone> = {
  created: "gold",
  pending_payment: "muted",
  confirmed: "info",
  packed: "primary",
  dispatched: "primary",
  out_for_delivery: "primary",
  delivered: "success",
  payment_failed: "danger",
  cancelled: "muted",
  returned: "muted",
  failed_delivery: "danger",
  abandoned: "muted",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export function OrderStatusCell({ cellData }: { cellData?: unknown }) {
  if (cellData === null || cellData === undefined || cellData === "") {
    return null;
  }
  const raw = String(cellData);
  const tone = TONES[raw] ?? "muted";
  return (
    <span className={`mishran-pill mishran-pill--${tone}`}>{humanize(raw)}</span>
  );
}

export default OrderStatusCell;
