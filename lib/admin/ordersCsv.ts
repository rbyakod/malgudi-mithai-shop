// lib/admin/ordersCsv.ts
// Orders CSV export (#128) — pure mapping from the staff orders feed rows
// to an RFC 4180 CSV string. Kept free of React/fetch so it is unit-testable
// in isolation (same pattern as lib/admin/reconcile.ts).
//
// Money is emitted in rupees with 2 decimals (accounting-safe; the feed
// carries paise). Dates stay ISO-8601 UTC so spreadsheets parse and sort
// them deterministically.

export interface CsvOrderRow {
  id: string;
  createdAt?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  source?: string;
  couponCode?: string | null;
  totalInPaise?: number | null;
  customerName?: string | null;
  phone?: string | null;
}

const HEADERS = [
  "Order ID",
  "Short ID",
  "Placed at (UTC)",
  "Customer",
  "Phone",
  "Source",
  "Payment method",
  "Payment status",
  "Coupon",
  "Status",
  "Total (INR)",
];

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function ordersToCsv(rows: CsvOrderRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    const rupees =
      row.totalInPaise != null ? (row.totalInPaise / 100).toFixed(2) : "";
    const cells = [
      row.id,
      row.id.slice(-6),
      row.createdAt ?? "",
      row.customerName ?? "",
      row.phone ?? "",
      row.source ?? "",
      row.paymentMethod === "cod" ? "COD" : "Online",
      row.paymentStatus ?? "",
      row.couponCode ?? "",
      row.status ?? "",
      rupees,
    ].map(escapeCell);
    lines.push(cells.join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Blob-safe filename for an export bounded by the given ISO dates. */
export function exportFileName(from?: string, to?: string): string {
  const compact = (iso?: string) => iso?.replace(/[^0-9]/g, "").slice(0, 14);
  const f = compact(from) ?? "";
  const t = compact(to) ?? "";
  if (f && t) return `mishran-orders-${f}-to-${t}.csv`;
  if (f) return `mishran-orders-from-${f}.csv`;
  if (t) return `mishran-orders-to-${t}.csv`;
  return `mishran-orders-all.csv`;
}
