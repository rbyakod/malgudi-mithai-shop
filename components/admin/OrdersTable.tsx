"use client";
// components/admin/OrdersTable.tsx
// All-orders table console — known-gaps campaign B13.
//
// Fetches /api/staff/orders (the staff-gated feed; a 401 surfaces a
// sign-in-at-/admin hint instead of a bare error), with filter selects
// (status / payment method / payment status / source), date bounds, free
// text (phone or order id), pagination, and 20 s background polling that
// pauses when the tab is hidden.
//
// Row actions:
//   - status change: a select of the ORDER_TRANSITIONS-legal next stages,
//     posting to /api/admin/orders/:id/status (the hardened transition route)
//   - Cash collected: COD rows with payment still pending, posting to
//     /api/staff/orders/:id/collect-cash behind a confirm prompt
import { useCallback, useEffect, useRef, useState } from "react";
import {
  STATUS_LABEL,
  isCashToCollect,
} from "@/lib/admin/ordersBoard";
import { ORDER_TRANSITIONS, type OrderStatus } from "@/lib/commerce/types";

export interface StaffOrderRow {
  id: string;
  createdAt?: string;
  status: OrderStatus;
  paymentStatus?: string;
  paymentMethod?: string;
  source?: string;
  couponCode?: string | null;
  totalInPaise?: number | null;
  customerName?: string | null;
  phone?: string | null;
}

interface Feed {
  items: StaffOrderRow[];
  page: number;
  pageSize: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage?: boolean;
}

const ALL_STATUSES: OrderStatus[] = [
  "created",
  "pending_payment",
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "payment_failed",
  "cancelled",
  "returned",
  "failed_delivery",
  "abandoned",
];

const FILTER_CLASS =
  "rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700";

function rupees(paise: number | null | undefined): string {
  return paise == null ? "—" : `₹${(paise / 100).toFixed(0)}`;
}

export function OrdersTable({
  onAuthError,
}: {
  onAuthError: () => void;
}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Filters. Empty string = no filter (the route treats "" as absent).
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  // Bump to refetch without changing filters (after actions / poll tick).
  const [tick, setTick] = useState(0);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "50" });
        if (status) params.set("status", status);
        if (paymentMethod) params.set("paymentMethod", paymentMethod);
        if (paymentStatus) params.set("paymentStatus", paymentStatus);
        if (source) params.set("source", source);
        if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
        if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/staff/orders?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          onAuthError();
          return;
        }
        if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
        setFeed((await res.json()).data as Feed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to load orders");
      } finally {
        if (!silent) setLoading(false);
        firstLoad.current = false;
      }
    },
    [page, status, paymentMethod, paymentStatus, source, from, to, q, onAuthError],
  );

  // Fetch on mount / filter / page / action tick.
  useEffect(() => {
    void load(false);
  }, [load, tick]);

  // Background poll every 20 s; skip while hidden or a row action is busy.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden && !busyId) void load(true);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [load, busyId]);

  function refresh() {
    setTick((t) => t + 1);
  }

  async function transition(row: StaffOrderRow, to: OrderStatus) {
    if (!ORDER_TRANSITIONS[row.status]?.includes(to)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/orders/${row.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newStatus: to }),
      });
      if (res.status === 401) {
        onAuthError();
        return;
      }
      if (!res.ok) throw new Error(`status update failed: ${res.status}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "status update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function collectCash(row: StaffOrderRow) {
    const ok = window.confirm(
      `Mark ₹${((row.totalInPaise ?? 0) / 100).toFixed(0)} cash collected for order #${row.id.slice(-6)}?`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/staff/orders/${row.id}/collect-cash`, {
        method: "POST",
      });
      if (res.status === 401) {
        onAuthError();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `collect failed: ${res.status}`);
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "collect failed");
    } finally {
      setBusyId(null);
    }
  }

  const rows = feed?.items ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by status" className={FILTER_CLASS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select aria-label="Filter by payment method" className={FILTER_CLASS} value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}>
          <option value="">All methods</option>
          <option value="razorpay">Online</option>
          <option value="cod">Cash on delivery</option>
        </select>
        <select aria-label="Filter by payment status" className={FILTER_CLASS} value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}>
          <option value="">Any payment state</option>
          <option value="pending">Payment pending</option>
          <option value="paid">Payment paid</option>
        </select>
        <select aria-label="Filter by source" className={FILTER_CLASS} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          <option value="web">Web</option>
          <option value="mobile-android">Android</option>
          <option value="mobile-ios">iOS</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-stone-600">
          From
          <input aria-label="Orders from date" type="date" className={FILTER_CLASS} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </label>
        <label className="flex items-center gap-1 text-sm text-stone-600">
          To
          <input aria-label="Orders to date" type="date" className={FILTER_CLASS} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </label>
        <form
          className="ml-auto flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            refresh();
          }}
        >
          <input
            aria-label="Search by phone or order id"
            placeholder="Phone or order id"
            className={`${FILTER_CLASS} w-44`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700">
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl ring-1 ring-stone-200">
        <table className="w-full min-w-[900px] border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-3 py-2">Order</th>
              <th scope="col" className="px-3 py-2">Placed</th>
              <th scope="col" className="px-3 py-2">Customer</th>
              <th scope="col" className="px-3 py-2">Source</th>
              <th scope="col" className="px-3 py-2">Method</th>
              <th scope="col" className="px-3 py-2">Payment</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2 text-right">Total</th>
              <th scope="col" className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-stone-500">Loading orders…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-stone-500">No orders match these filters.</td>
              </tr>
            )}
            {rows.map((row) => {
              const nextStages = ORDER_TRANSITIONS[row.status] ?? [];
              const cash = isCashToCollect(row);
              const busy = busyId === row.id;
              return (
                <tr key={row.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-stone-600" title={row.id}>
                    #{row.id.slice(-6)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-600">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-stone-800">{row.customerName ?? "—"}</div>
                    <div className="text-xs text-stone-500">{row.phone ?? ""}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-600">
                    {row.source === "web" ? "Web" : row.source === "mobile-ios" ? "iOS" : row.source === "mobile-android" ? "Android" : row.source ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.paymentMethod === "cod" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      {row.paymentMethod === "cod" ? "COD" : "Online"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`text-xs font-medium ${row.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                      {row.paymentStatus === "paid" ? "Paid" : row.paymentStatus === "pending" ? "Pending" : row.paymentStatus ?? "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-700">
                    {STATUS_LABEL[row.status] ?? row.status}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-stone-800">
                    {rupees(row.totalInPaise)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      {nextStages.length > 0 && (
                        <select
                          aria-label={`Move order ${row.id.slice(-6)} to a new status`}
                          className={`${FILTER_CLASS} text-xs`}
                          value=""
                          disabled={busy}
                          onChange={(e) => {
                            const to = e.target.value as OrderStatus;
                            if (to) void transition(row, to);
                          }}
                        >
                          <option value="">Move to…</option>
                          {nextStages.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      )}
                      {cash && (
                        <button
                          onClick={() => void collectCash(row)}
                          disabled={busy}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Cash collected
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>
          {feed ? `${feed.totalDocs} order${feed.totalDocs === 1 ? "" : "s"} · page ${feed.page} of ${Math.max(feed.totalPages, 1)}` : ""}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!feed || feed.page <= 1}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!feed?.hasNextPage}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
