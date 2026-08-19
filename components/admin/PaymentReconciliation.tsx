"use client";
// components/admin/PaymentReconciliation.tsx
// Payment reconciliation admin view — Task 5.5 (Mishran Mobile Apps v1).
//
// Matches each `payments` doc (provider: razorpay) against a Razorpay
// settlement export CSV that ops pastes/uploads. Rows are classified:
//   - matched: payment captured + present in settlement
//   - captured_unsettled: captured on our side, missing from settlement (in flight)
//   - orphan_settlement: in settlement but no captured payment doc (investigate)
//
// The CSV parse runs client-side (no file upload round-trip); the payment
// docs are fetched from the Payload REST API. Pure parse + reconciliation
// logic lives in lib/admin/reconcile so it is unit-tested without the browser.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseSettlementCsv, reconcile, type PaymentDoc, type ReconciliationRow } from "@/lib/admin/reconcile";

// Cash to collect — known-gaps B13. COD orders never appear in a Razorpay
// settlement, so the reconciliation view surfaces them separately: the
// outstanding cash (count + amount) links into the orders console where
// staff mark collection.
interface CashRow {
  id: string;
  totalInPaise?: number | null;
  status?: string;
}

export function PaymentReconciliation() {
  const [csv, setCsv] = useState("");
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashRows, setCashRows] = useState<CashRow[] | null>(null);

  const loadCash = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/staff/orders?paymentMethod=cod&paymentStatus=pending&pageSize=100",
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`cash orders fetch failed: ${res.status}`);
      setCashRows(((await res.json()).data?.items ?? []) as CashRow[]);
    } catch {
      // Non-blocking: settlement matching stays usable without it.
      setCashRows([]);
    }
  }, []);

  // The setTimeout hop defers the load out of the effect body — react-hooks
  // v6 flags a direct `void loadCash()` here (setState inside a
  // synchronously-called function) — mirroring the orders console.
  useEffect(() => {
    const id = window.setTimeout(() => void loadCash(), 0);
    return () => window.clearTimeout(id);
  }, [loadCash]);

  const cashTotalInPaise = useMemo(
    () => (cashRows ?? []).reduce((sum, r) => sum + (r.totalInPaise ?? 0), 0),
    [cashRows],
  );

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments?limit=500&depth=0", { cache: "no-store" });
      if (!res.ok) throw new Error(`payments fetch failed: ${res.status}`);
      const body = await res.json();
      setPayments((body?.docs ?? body?.data?.items ?? []) as PaymentDoc[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  const rows: ReconciliationRow[] = useMemo(() => {
    const settlement = parseSettlementCsv(csv);
    if (settlement.length === 0 && payments.length === 0) return [];
    return reconcile(payments, settlement);
  }, [csv, payments]);

  const counts = useMemo(() => {
    const c = { matched: 0, captured_unsettled: 0, orphan_settlement: 0 } as Record<string, number>;
    for (const r of rows) c[r.classification] = (c[r.classification] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-stone-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-stone-900">Payment reconciliation</h1>
        <p className="text-sm text-stone-500">
          Paste a Razorpay settlement export to match against captured payments.
        </p>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-700">1. Load captured payments</h2>
          <button
            onClick={() => void loadPayments()}
            disabled={loading}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Loading…" : `Load payments (${payments.length} cached)`}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-700">2. Settlement CSV</h2>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Razorpay settlement id, amount, status, payment_id, …"
            className="h-40 w-full rounded-md border border-stone-300 p-2 font-mono text-xs"
          />
        </section>
      </div>

      <div className="px-6">
        <div className="flex gap-4 text-sm">
          <Stat label="Matched" value={counts.matched ?? 0} tone="emerald" />
          <Stat label="Captured, unsettled" value={counts.captured_unsettled ?? 0} tone="amber" />
          <Stat label="Orphan settlement" value={counts.orphan_settlement ?? 0} tone="rose" />
          <div className="flex-1 rounded-lg bg-stone-100 px-4 py-3 text-stone-700">
            <div className="text-2xl font-semibold">
              {cashRows == null ? "…" : `₹${(cashTotalInPaise / 100).toFixed(0)}`}
            </div>
            <div className="text-xs font-medium opacity-80">
              Cash to collect
              {cashRows != null && (
                <>
                  {" — "}
                  {cashRows.length} COD order{cashRows.length === 1 ? "" : "s"}
                  {cashRows.length > 0 && (
                    <>
                      {" · "}
                      <Link href="/staff/orders-board" className="underline">
                        collect in console
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
              <tr>
                <th className="py-2 pr-4">Payment ID</th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Amount (₹)</th>
                <th className="py-2 pr-4">Classification</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-stone-100">
                  <td className="py-2 pr-4 font-mono text-xs">{r.providerPaymentId ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.orderId ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {r.amountInPaise != null ? (r.amountInPaise / 100).toFixed(2) : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <ClassBadge classification={r.classification} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-stone-400">
                    Load payments and paste a settlement to reconcile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className={`flex-1 rounded-lg px-4 py-3 ${tones[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}

function ClassBadge({ classification }: { classification: string }) {
  const map: Record<string, string> = {
    matched: "bg-emerald-100 text-emerald-700",
    captured_unsettled: "bg-amber-100 text-amber-700",
    orphan_settlement: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[classification] ?? "bg-stone-100 text-stone-600"}`}>
      {classification.replace(/_/g, " ")}
    </span>
  );
}
