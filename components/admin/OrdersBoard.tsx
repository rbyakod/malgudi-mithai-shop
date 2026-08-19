"use client";
// components/admin/OrdersBoard.tsx
// Ops orders console — Task 5.4, upgraded in the known-gaps campaign (B13).
//
// Two views over one staff-gated feed (GET /api/staff/orders):
//   - Board: the original kanban — left-to-right fulfillment columns with
//     drag-to-advance (native HTML5 DnD, no dependency). A drop is only
//     accepted when `canAdvance` says the transition is legal; each drop
//     POSTs to the hardened admin status route which runs the backend state
//     machine + notification fan-out.
//   - All orders: the full console table (components/admin/OrdersTable) —
//     every order with filters, phone/id search, status transitions, and
//     COD cash-collected.
//
// Auth: the server routes are the boundary. On a 401 the console renders a
// sign-in hint linking to /admin (Payload's login) instead of a bare error —
// staff sessions live in the payload-token cookie the fetches carry.
//
// Full Playwright E2E (seeded Mongo + Payload admin auth) is deferred — both
// views are covered by unit tests on the pure logic in lib/admin/ordersBoard
// plus route tests on the feed/collect endpoints.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BOARD_COLUMNS,
  STATUS_LABEL,
  STATUS_ACCENT,
  columnForStatus,
  canAdvance,
  type BoardColumn,
} from "@/lib/admin/ordersBoard";
import { OrdersTable, type StaffOrderRow } from "@/components/admin/OrdersTable";
import { PackingSlip } from "@/components/admin/PackingSlip";
import type { OrderStatus } from "@/lib/commerce/types";

interface OrderCard {
  id: string;
  status: OrderStatus;
  totalInPaise?: number | null;
  customerName?: string | null;
}

type Bucket = Record<BoardColumn | "blocked", OrderCard[]>;

const EMPTY: Bucket = {
  confirmed: [],
  packed: [],
  dispatched: [],
  out_for_delivery: [],
  delivered: [],
  blocked: [],
};

const ACCENT_CLASSES: Record<string, { bar: string; chip: string; ring: string }> = {
  amber: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-700", ring: "ring-amber-200" },
  blue: { bar: "bg-blue-500", chip: "bg-blue-50 text-blue-700", ring: "ring-blue-200" },
  indigo: { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700", ring: "ring-indigo-200" },
  violet: { bar: "bg-violet-500", chip: "bg-violet-50 text-violet-700", ring: "ring-violet-200" },
  emerald: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", ring: "ring-emerald-200" },
  rose: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700", ring: "ring-rose-200" },
};

function bucketOrders(rows: StaffOrderRow[]): Bucket {
  const b: Bucket = { ...EMPTY, confirmed: [], packed: [], dispatched: [], out_for_delivery: [], delivered: [], blocked: [] };
  for (const o of rows) {
    const col = columnForStatus(o.status);
    if (col) b[col].push({ id: o.id, status: o.status, totalInPaise: o.totalInPaise, customerName: o.customerName });
  }
  return b;
}

export function OrdersBoard() {
  const [view, setView] = useState<"board" | "table">("table");
  const [authError, setAuthError] = useState(false);
  const [buckets, setBuckets] = useState<Bucket>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  // Packing slip (#126): one modal for both views; null = closed.
  const [slipId, setSlipId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/orders?pageSize=100", { cache: "no-store" });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
      const rows = ((await res.json()).data?.items ?? []) as StaffOrderRow[];
      setBuckets(bucketOrders(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  // setTimeout hop — react-hooks v6 flags a direct `void refresh()` in
  // the effect body (setState inside a synchronously-called function).
  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  async function advance(orderId: string, from: OrderStatus, to: OrderStatus) {
    if (!canAdvance(from, to)) return;
    // Optimistic: move the card immediately; revert on failure.
    setBuckets((prev) => {
      const next: Bucket = { ...prev };
      next[from as BoardColumn] = prev[from as BoardColumn].filter((o) => o.id !== orderId);
      const target = columnForStatus(to) as BoardColumn | "blocked";
      const moved = prev[from as BoardColumn].find((o) => o.id === orderId);
      if (moved && target) next[target] = [...next[target], { ...moved, status: to }];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newStatus: to }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) throw new Error(`status update failed: ${res.status}`);
    } catch {
      // Revert by refetching the canonical state.
      void refresh();
    }
  }

  function onDrop(e: React.DragEvent, targetCol: BoardColumn) {
    e.preventDefault();
    const orderId = dragging;
    setDragging(null);
    if (!orderId) return;
    // Find the card + its current status.
    for (const col of [...BOARD_COLUMNS, "blocked"] as const) {
      const card = buckets[col].find((o) => o.id === orderId);
      if (card) {
        void advance(card.id, card.status, targetCol);
        break;
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Orders console</h1>
          <p className="text-sm text-stone-500">
            {view === "board"
              ? "Drag a card right to advance fulfilment."
              : "Every order — filter, search, transition, and collect COD cash."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-stone-300 bg-white p-0.5" role="tablist" aria-label="Console view">
            <button
              role="tab"
              aria-selected={view === "table"}
              onClick={() => setView("table")}
              className={`rounded px-3 py-1 text-sm font-medium ${view === "table" ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"}`}
            >
              All orders
            </button>
            <button
              role="tab"
              aria-selected={view === "board"}
              onClick={() => setView("board")}
              className={`rounded px-3 py-1 text-sm font-medium ${view === "board" ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"}`}
            >
              Board
            </button>
          </div>
          <button
            onClick={() => void refresh()}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {authError && (
        <div className="mx-6 mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Staff sign-in required.{" "}
          <Link href="/admin" className="font-medium underline">
            Sign in at the admin panel
          </Link>{" "}
          and reload this page.
        </div>
      )}

      {error && !authError && (
        <div className="mx-6 mt-4 rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {view === "table" ? (
        <OrdersTable onAuthError={() => setAuthError(true)} onOpenSlip={setSlipId} />
      ) : loading ? (
        <div className="p-8 text-stone-500">Loading orders…</div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {BOARD_COLUMNS.map((col) => (
            <Column
              key={col}
              col={col}
              cards={buckets[col]}
              onDragStartCard={(id) => setDragging(id)}
              onDrop={(e) => onDrop(e, col)}
              onAdvance={(card) => {
                const next = nextStage(col);
                if (next) void advance(card.id, card.status, next);
              }}
              onOpenSlip={setSlipId}
            />
          ))}
          {buckets.blocked.length > 0 && (
            <Column
              col="blocked"
              cards={buckets.blocked}
              onDragStartCard={(id) => setDragging(id)}
              onDrop={(e) => e.preventDefault()}
              onAdvance={() => {}}
              onOpenSlip={setSlipId}
            />
          )}
        </div>
      )}

      <PackingSlip
        orderId={slipId}
        onClose={() => setSlipId(null)}
        onAuthError={() => setAuthError(true)}
      />
    </div>
  );
}

function nextStage(col: BoardColumn): OrderStatus | null {
  const idx = BOARD_COLUMNS.indexOf(col);
  return idx >= 0 && idx < BOARD_COLUMNS.length - 1
    ? (BOARD_COLUMNS[idx + 1] as OrderStatus)
    : null;
}

function Column({
  col,
  cards,
  onDragStartCard,
  onDrop,
  onAdvance,
  onOpenSlip,
}: {
  col: BoardColumn | "blocked";
  cards: OrderCard[];
  onDragStartCard: (id: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onAdvance: (card: OrderCard) => void;
  onOpenSlip: (id: string) => void;
}) {
  const accent = ACCENT_CLASSES[STATUS_ACCENT[col]];
  const label = col === "blocked" ? "Blocked" : STATUS_LABEL[col];
  return (
    <section
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex w-72 shrink-0 flex-col rounded-xl bg-stone-50 ring-1 ring-stone-200"
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className={`h-2.5 w-2.5 rounded-full ${accent.bar}`} />
        <h2 className="text-sm font-semibold text-stone-800">{label}</h2>
        <span className={`ml-auto rounded-full px-2 text-xs font-medium ${accent.chip}`}>
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {cards.length === 0 && (
          <p className="px-1 py-2 text-xs text-stone-400">No orders.</p>
        )}
        {cards.map((card) => {
          const next = col === "blocked" ? null : nextStage(col as BoardColumn);
          return (
            <article
              key={card.id}
              draggable
              onDragStart={() => onDragStartCard(card.id)}
              className={`cursor-grab rounded-lg bg-white p-3 shadow-sm ring-1 ${accent.ring} active:cursor-grabbing`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-stone-500">
                  #{card.id.slice(-6)}
                </span>
                {card.totalInPaise != null && (
                  <span className="text-xs font-medium text-stone-700">
                    ₹{((card.totalInPaise as number) / 100).toFixed(0)}
                  </span>
                )}
              </div>
              {card.customerName && (
                <p className="mt-1 truncate text-sm text-stone-800">{card.customerName}</p>
              )}
              <button
                onClick={() => onOpenSlip(card.id)}
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Packing slip
              </button>
              {next && (
                <button
                  onClick={() => onAdvance(card)}
                  className="mt-2 w-full rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-700"
                >
                  Advance → {STATUS_LABEL[next]}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
