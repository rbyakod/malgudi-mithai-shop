"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {
  fetchMithaiByFreshness,
  type MithaiFreshnessGroups,
  type MithaiRow,
} from "@/components/payload-admin/lib/dashboard-queries";

type State =
  | {kind: "loading"}
  | {kind: "empty"}
  | {kind: "ready"; groups: MithaiFreshnessGroups}
  | {kind: "error"; message: string};

const COLUMNS = [
  {key: "made-daily" as const, label: "Made daily"},
  {key: "made-to-order" as const, label: "Made to order"},
  {key: "batch-frozen" as const, label: "Batch frozen"},
];

export function MithaiFreshnessBoard() {
  const [state, setState] = useState<State>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchMithaiByFreshness()
      .then(groups => {
        if (cancelled) return;
        const total = COLUMNS.reduce((sum, c) => sum + groups[c.key].length, 0);
        setState(total === 0 ? {kind: "empty"} : {kind: "ready", groups});
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
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
          Mithai freshness
        </h3>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem"}}>
          {Array.from({length: 3}).map((_, i) => (
            <div
              key={i}
              data-testid="skeleton-col"
              className="mishran-skeleton"
              style={{height: "6rem"}}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
          Mithai freshness
        </h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-text-muted)"}}>
          No mithai published yet.
        </p>
        <Link
          href="/admin/collections/mithai-products/create"
          style={{fontSize: "0.75rem", color: "var(--t-primary)"}}
        >
          Create one →
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
          Mithai freshness
        </h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-danger)"}}>
          Couldn&apos;t load mithai. {state.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
        Mithai freshness
      </h3>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem"}}>
        {COLUMNS.map(col => {
          const rows: MithaiRow[] = state.groups[col.key];
          return (
            <Link
              key={col.key}
              href={`/admin/collections/mithai-products?where[and][0][freshnessStatus][equals]=${col.key}`}
              style={{
                textDecoration: "none",
                color: "var(--t-text)",
                padding: "0.75rem",
                background: "var(--t-bg-card)",
                border: "1px solid var(--t-border)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--t-text-muted)",
                }}
              >
                {col.label}
              </span>
              <span style={{fontSize: "1.5rem", fontWeight: 700}}>{rows.length}</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--t-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {rows.slice(0, 3).map(r => r.name).join(", ") || "—"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default MithaiFreshnessBoard;
