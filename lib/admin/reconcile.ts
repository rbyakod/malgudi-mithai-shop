// lib/admin/reconcile.ts
// Pure payment-reconciliation logic — Task 5.5.
//
// Razorpay's settlement export is a CSV whose columns vary by report, but it
// always includes a payment id column and an amount in paise (or rupees with
// a decimal). We parse defensively: scan the header for the best-matching
// column for payment id and amount, coerce values, and join against our
// captured `payments` docs by providerPaymentId.
//
// Classification:
//   matched            — captured payment doc AND present in settlement
//   captured_unsettled — captured payment doc, NOT in settlement (in flight)
//   orphan_settlement  — in settlement, NO captured payment doc (investigate)
//
// Kept free of React/fetch so it is unit-testable in isolation.

export interface PaymentDoc {
  id: string;
  orderId?: string;
  providerPaymentId?: string;
  status?: string;
  amountInPaise?: number;
}

export interface SettlementEntry {
  providerPaymentId: string;
  amountInPaise: number;
}

export type ReconciliationClass =
  | "matched"
  | "captured_unsettled"
  | "orphan_settlement";

export interface ReconciliationRow {
  key: string;
  providerPaymentId?: string;
  orderId?: string;
  amountInPaise?: number;
  classification: ReconciliationClass;
}

// Parse a Razorpay settlement CSV into normalized entries. Tolerant of:
//   - leading/trailing whitespace, BOM, CRLF
//   - header columns named pay_id / payment_id / id
//   - amount in rupees (decimal) OR paise (integer); we detect by decimal point
export function parseSettlementCsv(csv: string): SettlementEntry[] {
  const text = csv.replace(/^﻿/, "").trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return []; // need header + at least one row

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const payCol = pickColumn(headers, ["payment id", "pay_id", "payment_id", "id"]);
  const amtCol = pickColumn(headers, ["amount", "amount (in inr)", "amount_in_paise", "settlement_amount"]);
  if (payCol === -1) return [];

  const out: SettlementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const rawId = (cells[payCol] ?? "").trim();
    if (!rawId) continue;
    const rawAmt = amtCol >= 0 ? (cells[amtCol] ?? "").trim() : "";
    out.push({ providerPaymentId: rawId, amountInPaise: parseAmountToPaise(rawAmt) });
  }
  return out;
}

function pickColumn(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  // Loose contains-match fallback.
  for (let i = 0; i < headers.length; i++) {
    if (candidates.some((c) => headers[i].includes(c))) return i;
  }
  return -1;
}

// Minimal CSV line splitter: handles quoted fields with embedded commas.
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseAmountToPaise(raw: string): number {
  const clean = raw.replace(/[^0-9.]/g, "");
  if (!clean) return 0;
  const n = Number(clean);
  if (!Number.isFinite(n)) return 0;
  // If it has a decimal, assume rupees -> paise. Else assume already paise.
  return clean.includes(".") ? Math.round(n * 100) : Math.round(n);
}

export function reconcile(
  payments: PaymentDoc[],
  settlement: SettlementEntry[],
): ReconciliationRow[] {
  const settlementIds = new Set(settlement.map((s) => s.providerPaymentId));
  const paymentIds = new Set(
    payments.filter((p) => p.status === "captured" && p.providerPaymentId).map((p) => p.providerPaymentId!),
  );
  const rows: ReconciliationRow[] = [];

  for (const p of payments) {
    if (p.status !== "captured") continue;
    const inSettlement = p.providerPaymentId ? settlementIds.has(p.providerPaymentId) : false;
    rows.push({
      key: `pay-${p.id}`,
      providerPaymentId: p.providerPaymentId,
      orderId: p.orderId != null ? String(p.orderId) : undefined,
      amountInPaise: p.amountInPaise,
      classification: inSettlement ? "matched" : "captured_unsettled",
    });
  }

  for (const s of settlement) {
    if (!paymentIds.has(s.providerPaymentId)) {
      rows.push({
        key: `set-${s.providerPaymentId}`,
        providerPaymentId: s.providerPaymentId,
        amountInPaise: s.amountInPaise,
        classification: "orphan_settlement",
      });
    }
  }

  return rows;
}
