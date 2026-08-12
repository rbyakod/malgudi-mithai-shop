"use client";

import {useEffect, useState} from "react";
import {fetchRecentLeads, type LeadRow, type LeadStatus} from "@/components/payload-admin/lib/dashboard-queries";

// Tone mapping for lead status pills. Uses tones that exist in custom.scss
// (muted/primary/gold/success/info). `qualified` maps to `info` to distinguish
// it from `lost` (which is `muted`).
const STATUS_TONE: Record<LeadStatus, "muted" | "primary" | "success" | "gold" | "info"> = {
  new: "gold",
  contacted: "primary",
  qualified: "info",
  won: "success",
  lost: "muted",
};

type RecentLeadsState =
  | {kind: "loading"}
  | {kind: "empty"}
  | {kind: "ready"; rows: LeadRow[]}
  | {kind: "error"; message: string};

export function RecentLeads() {
  const [state, setState] = useState<RecentLeadsState>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchRecentLeads(5)
      .then(rows => {
        if (cancelled) return;
        setState(rows.length === 0 ? {kind: "empty"} : {kind: "ready", rows});
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
          Recent leads
        </h3>
        {Array.from({length: 5}).map((_, i) => (
          <div
            key={i}
            data-testid="skeleton-row"
            className="mishran-skeleton"
            style={{height: "2rem", marginBottom: "0.5rem"}}
          />
        ))}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
          Recent leads
        </h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-text-muted)"}}>No leads yet.</p>
        <a
          href="/admin/collections/leads/create"
          style={{fontSize: "0.75rem", color: "var(--t-primary)"}}
        >
          Create the first →
        </a>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
          Recent leads
        </h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-danger)"}}>
          Couldn&apos;t load leads. {state.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>
        Recent leads
      </h3>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {state.rows.map(lead => (
          <li key={lead.id}>
            <a
              href={`/admin/collections/leads/${lead.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                textDecoration: "none",
                color: "var(--t-text)",
              }}
            >
              <span>
                <span style={{display: "block", fontSize: "0.8125rem", fontWeight: 500}}>
                  {lead.name}
                </span>
                {lead.email && (
                  <span
                    style={{display: "block", fontSize: "0.6875rem", color: "var(--t-text-muted)"}}
                  >
                    {lead.email}
                  </span>
                )}
              </span>
              {lead.status && (
                <span className={`mishran-pill mishran-pill--${STATUS_TONE[lead.status]}`}>
                  {lead.status}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RecentLeads;
