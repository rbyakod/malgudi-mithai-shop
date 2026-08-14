"use client";
// components/admin/OrdersBoard.tsx
// Ops orders kanban board — Task 5.4 (Mishran Mobile Apps v1).
//
// Client component: fetches orders from the Payload REST API (server-relative
// `/api/orders`) scoped to active fulfillment, renders them in left-to-right
// stage columns, and advances an order by dragging its card onto the next
// column (or clicking the advance button). Each drop POSTs to the admin
// status route (`POST /api/admin/orders/:id/status`) which runs the backend
// state machine + notification fan-out.
//
// Drag-and-drop uses the native HTML5 DnD API (no added dependency). A drop is
// only accepted when `canAdvance` says the transition is legal; illegal drops
// bounce back so the UI never offers a move the API would 409 on.
//
// Full Playwright E2E (seeded Mongo + Payload admin auth) is deferred — this
// component is covered by unit tests on the pure logic in lib/admin/ordersBoard.
import { useCallback, useEffect, useState } from "react";
import {
  BOARD_COLUMNS,
  BLOCKED_STATUSES,
  STATUS_LABEL,
  STATUS_ACCENT,
  columnForStatus,
  canAdvance,
  type BoardColumn,
} from "@/lib/admin/ordersBoard";
import type { OrderStatus } from "@/lib/commerce/types";

interface OrderCard {
  id: string;
  status: OrderStatus;
  totals?: { totalInPaise?: number };
  customerName?: string;
  updatedAt?: string;
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

function bucketOrders(orders: OrderCard[]): Bucket {
  const b: Bucket = { ...EMPTY, confirmed: [], packed: [], dispatched: [], out_for_delivery: [], delivered: [], blocked: [] };
  for (const o of orders) {
    const col = columnForStatus(o.status);
    if (col) b[col].push(o);
  }
  return b;
}

export function OrdersBoard() {
  const [buckets, setBuckets] = useState<Bucket>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders?limit=100&depth=0", { cache: "no-store" });
      if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
      const body = await res.json();
      const docs: OrderCard[] = body?.docs ?? body?.data?.items ?? [];
      setBuckets(bucketOrders(docs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function advance(orderId: string, from: OrderStatus, to: OrderStatus) {
    if (!canAdvance(from, to)) return;
    // Optimistic: move the card immediately; revert on failure.
    setBuckets((prev) => {
      const next: Bucket = { ...prev };
      next[from as BoardColumn] = prev[from as BoardColumn].filter((o) => o.id !== orderId);
      const target = columnForStatus(to) as BoardColumn | "blocked";
      const moved = prev[from as BoardColumn].find((o) => o.id === orderId);
      if (moved && target) next[target] = [...prev[target], { ...moved, status: to }];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newStatus: to }),
      });
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

  if (loading) {
    return <div className="p-8 text-stone-500">Loading orders…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Orders board</h1>
          <p className="text-sm text-stone-500">Drag a card right to advance fulfilment.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

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
          />
        ))}
        {buckets.blocked.length > 0 && (
          <Column
            col="blocked"
            cards={buckets.blocked}
            onDragStartCard={(id) => setDragging(id)}
            onDrop={(e) => e.preventDefault()}
            onAdvance={() => {}}
          />
        )}
      </div>
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
}: {
  col: BoardColumn | "blocked";
  cards: OrderCard[];
  onDragStartCard: (id: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onAdvance: (card: OrderCard) => void;
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
                {card.totals?.totalInPaise != null && (
                  <span className="text-xs font-medium text-stone-700">
                    ₹{((card.totals.totalInPaise as number) / 100).toFixed(0)}
                  </span>
                )}
              </div>
              {card.customerName && (
                <p className="mt-1 truncate text-sm text-stone-800">{card.customerName}</p>
              )}
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
