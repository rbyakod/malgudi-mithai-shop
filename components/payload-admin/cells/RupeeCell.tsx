"use client";

// Audit §05/§06: money fields are stored in paise and the raw integer read
// as "225800" is meaningless to a shop owner. This cell renders ₹ with
// Indian digit grouping. Referenced by string path from collection configs
// (Payload's importMap resolves it).
const inr0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function RupeeCell({ cellData }: { cellData?: unknown }) {
  if (cellData === null || cellData === undefined || cellData === "") {
    return null;
  }
  const paise = typeof cellData === "number" ? cellData : Number(cellData);
  if (!Number.isFinite(paise)) {
    return <>{String(cellData)}</>;
  }
  const formatted = paise % 100 === 0 ? inr0.format(paise / 100) : inr2.format(paise / 100);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatted}</span>;
}

export default RupeeCell;
