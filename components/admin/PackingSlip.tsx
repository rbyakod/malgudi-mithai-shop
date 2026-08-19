"use client";
// components/admin/PackingSlip.tsx
// Printable packing slip — admin roadmap Wave 1 (#126).
//
// Rendered through a portal as a direct <body> child (.slip-portal) and
// flagged via body.slip-open, so the print stylesheet in app/globals.css
// can print ONLY the slip no matter where in the console tree it was
// opened from. Fetches /api/staff/orders/:id/packing-slip on open;
// Escape or Close dismisses; Print calls window.print().
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { slipRupees, type PackingSlipData } from "@/lib/admin/packingSlip";

export function PackingSlip({
  orderId,
  onClose,
  onAuthError,
}: {
  orderId: string | null;
  onClose: () => void;
  onAuthError: () => void;
}) {
  // Fetched state is keyed by the order it belongs to and filtered through
  // that key at render, so opening a different order shows "Loading…"
  // without needing synchronous resets inside the effect.
  const [slip, setSlip] = useState<PackingSlipData | null>(null);
  const [err, setErr] = useState<{ forId: string; message: string } | null>(null);
  const open = orderId != null;
  const current = slip && slip.id === orderId ? slip : null;
  const error = err?.forId === orderId ? err.message : null;

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/staff/orders/${orderId}/packing-slip`, {
          cache: "no-store",
        });
        if (!alive) return;
        if (res.status === 401) {
          onAuthError();
          return;
        }
        if (!res.ok) throw new Error(`slip fetch failed: ${res.status}`);
        const body = (await res.json()).data as PackingSlipData;
        if (alive) setSlip(body);
      } catch (e) {
        if (alive)
          setErr({
            forId: orderId,
            message: e instanceof Error ? e.message : "failed to load slip",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, onAuthError]);

  // Body flag drives the print stylesheet; Escape closes.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("slip-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("slip-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="slip-portal fixed inset-0 z-[100] overflow-y-auto bg-stone-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Packing slip"
    >
      <div className="packing-slip mx-auto max-w-[148mm] rounded-xl bg-white p-6 shadow-xl">
        <header className="flex items-start justify-between border-b-2 border-stone-900 pb-3">
          <div>
            <p className="font-serif text-2xl font-semibold tracking-tight text-stone-900">
              Mishran
            </p>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
              Sweets &amp; Snacks · Packing slip
            </p>
          </div>
          <div className="text-right text-xs text-stone-600">
            <p className="font-mono text-sm font-semibold text-stone-900">
              #{current ? current.shortId : "…"}
            </p>
            <p>
              {current?.placedAt
                ? new Date(current.placedAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </p>
          </div>
        </header>

        {error && (
          <p className="mt-4 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {!current && !error && <p className="mt-8 text-center text-stone-500">Loading slip…</p>}

        {current && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Customer
                </p>
                <p className="mt-0.5 font-medium text-stone-900">{current.customerName ?? "—"}</p>
                <p className="text-stone-600">{current.phone ?? ""}</p>
                {current.slotWindow && (
                  <p className="mt-1 text-stone-600">
                    Slot: {current.slotWindow}
                    {current.slotDate
                      ? ` · ${new Date(current.slotDate).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}`
                      : ""}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Deliver to
                </p>
                {current.address ? (
                  <p className="mt-0.5 leading-snug text-stone-700">
                    {current.address.line1}
                    {current.address.line2 ? `, ${current.address.line2}` : ""}
                    <br />
                    {current.address.city}, {current.address.state} {current.address.pincode}
                  </p>
                ) : (
                  <p className="mt-0.5 text-stone-500">No address on file</p>
                )}
              </div>
            </div>

            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-[0.65rem] uppercase tracking-[0.14em] text-stone-500">
                  <th scope="col" className="py-1.5">Item</th>
                  <th scope="col" className="py-1.5 text-center">Qty</th>
                  <th scope="col" className="py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((line, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-1.5 text-stone-800">
                      {line.name}
                      {line.packLabel && (
                        <span className="text-stone-500"> · {line.packLabel}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center text-stone-700">
                      {line.quantity} {line.unit}
                    </td>
                    <td className="py-1.5 text-right text-stone-800">
                      {slipRupees(line.lineTotalInPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 ml-auto w-full max-w-[16rem] space-y-0.5 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Items</span>
                <span>{slipRupees(current.itemsTotalInPaise)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Delivery</span>
                <span>{slipRupees(current.deliveryFeeInPaise)}</span>
              </div>
              {current.discountInPaise != null && current.discountInPaise > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Discount{current.couponCode ? ` (${current.couponCode})` : ""}</span>
                  <span>−{slipRupees(current.discountInPaise)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-stone-300 pt-1 text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{slipRupees(current.totalInPaise)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3">
              {current.paymentMethod === "cod" ? (
                <p className="rounded bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                  Cash on delivery — collect {slipRupees(current.totalInPaise)}
                </p>
              ) : (
                <p className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Paid online{current.paymentStatus === "paid" ? "" : ` · ${current.paymentStatus ?? ""}`}
                </p>
              )}
              <p className="text-[0.7rem] text-stone-400">
                Order {current.id}
              </p>
            </div>

            <div className="packing-slip__no-print mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                disabled={!current}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
              >
                Print
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
