"use client";

import {useEffect, useState, type CSSProperties} from "react";
import Link from "next/link";
import {
  fetchOrdersPulse,
  fetchPendingReviewCount,
  type OrdersPulse,
} from "@/components/payload-admin/lib/dashboard-queries";

// Audit §07: ops KPI strip. Answers "what needs me right now" in one glance —
// fulfillment queue, COD cash to collect, revenue today / this week, and
// reviews awaiting moderation. Each metric degrades independently to "—".
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

function formatPaise(paise: number | null): string {
  if (paise === null) return "—";
  return paise % 100 === 0 ? inr0.format(paise / 100) : inr2.format(paise / 100);
}

type PulseState =
  | {kind: "loading"}
  | {kind: "ready"; pulse: OrdersPulse; reviews: number | null}
  | {kind: "error"; message: string};

type Tile = {
  label: string;
  value: string;
  href?: string;
  accent?: boolean;
};

const TILE_STYLE: CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  border: "1px solid var(--t-border)",
  borderRadius: "0.75rem",
  padding: "0.75rem 0.875rem",
  background: "var(--t-bg-card)",
};

const LABEL_STYLE: CSSProperties = {
  display: "block",
  fontSize: "0.625rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--t-text-muted)",
  marginBottom: "0.35rem",
};

const VALUE_STYLE: CSSProperties = {
  display: "block",
  fontFamily: "var(--mishran-font-display)",
  fontSize: "1.375rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.2,
};

export function OpsPulse() {
  const [state, setState] = useState<PulseState>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOrdersPulse(), fetchPendingReviewCount()])
      .then(([pulse, reviews]) => {
        if (cancelled) return;
        setState({kind: "ready", pulse, reviews});
      })
      .catch(err => {
        if (cancelled) return;
        setState({kind: "error", message: String(err)});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))",
          gap: "0.75rem",
        }}
      >
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="mishran-skeleton" style={{height: "4.25rem", borderRadius: "0.75rem"}} />
        ))}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <p style={{fontSize: "0.8125rem", color: "var(--t-danger)", margin: 0}}>
        Couldn&apos;t load the ops pulse. {state.message}
      </p>
    );
  }

  const {pulse, reviews} = state;
  const tiles: Tile[] = [
    {
      label: "To fulfill",
      value: pulse.toFulfill === null ? "—" : String(pulse.toFulfill),
      href: "/admin/collections/orders?where[and][0][status][in]=confirmed,packed,dispatched,out_for_delivery&sort=-createdAt",
      accent: (pulse.toFulfill ?? 0) > 0,
    },
    {
      label: "COD cash to collect",
      value: pulse.codPending === null ? "—" : String(pulse.codPending),
      href: "/admin/collections/orders?where[and][0][paymentMethod][equals]=cod&where[and][1][paymentStatus][equals]=pending&sort=-createdAt",
      accent: (pulse.codPending ?? 0) > 0,
    },
    {
      label: "Paid today",
      value: formatPaise(pulse.paidTodayPaise),
      href: "/admin/collections/orders?sort=-createdAt",
    },
    {
      label: "Paid this week",
      value: formatPaise(pulse.paidLast7dPaise),
      href: "/admin/collections/orders?sort=-createdAt",
    },
    {
      label: "Reviews to moderate",
      value: reviews === null ? "—" : String(reviews),
      href: "/admin/collections/reviews?where[status][equals]=pending&sort=-createdAt",
      accent: (reviews ?? 0) > 0,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))",
        gap: "0.75rem",
      }}
    >
      {tiles.map(tile => {
        const tileStyle = tile.accent
          ? {...TILE_STYLE, borderColor: "var(--t-gold)", borderWidth: "1.5px"}
          : TILE_STYLE;
        const body = (
          <>
            <span style={LABEL_STYLE}>{tile.label}</span>
            <span style={tile.accent ? {...VALUE_STYLE, color: "var(--t-primary)"} : VALUE_STYLE}>
              {tile.value}
            </span>
          </>
        );
        return tile.href ? (
          <Link key={tile.label} href={tile.href} style={tileStyle}>
            {body}
          </Link>
        ) : (
          <div key={tile.label} style={tileStyle}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export default OpsPulse;
