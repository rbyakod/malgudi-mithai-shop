"use client";

// Audit §06: mithai freshness rendered as a labeled pill instead of the raw
// enum value. Mirrors the storefront's freshness vocabulary.
type Tone = "success" | "gold" | "info";

const MAP: Record<string, { tone: Tone; label: string }> = {
  "made-daily": { tone: "success", label: "Made daily" },
  "made-to-order": { tone: "gold", label: "Made to order" },
  "batch-frozen": { tone: "info", label: "Batch frozen" },
};

export function FreshnessCell({ cellData }: { cellData?: unknown }) {
  if (cellData === null || cellData === undefined || cellData === "") {
    return null;
  }
  const entry = MAP[String(cellData)];
  if (!entry) {
    return <>{String(cellData)}</>;
  }
  return <span className={`mishran-pill mishran-pill--${entry.tone}`}>{entry.label}</span>;
}

export default FreshnessCell;
