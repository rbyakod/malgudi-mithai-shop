"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {
  fetchRecentLeads,
  updateLeadStatus,
  type LeadRow,
  type LeadStatus,
} from "@/components/payload-admin/lib/dashboard-queries";
import {toWaDigits} from "@/lib/whatsapp";

const STATUS_TONE: Record<LeadStatus, "muted" | "primary" | "success" | "gold" | "info"> = {
  new: "gold",
  contacted: "primary",
  qualified: "info",
  won: "success",
  lost: "muted",
};

const ACTIONS: LeadStatus[] = ["contacted", "qualified", "won", "lost"];

type RecentLeadsState =
  | {kind: "loading"}
  | {kind: "empty"}
  | {kind: "ready"; rows: LeadRow[]}
  | {kind: "error"; message: string};

export function RecentLeads() {
  const [state, setState] = useState<RecentLeadsState>({kind: "loading"});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  async function changeStatus(id: string, status: LeadStatus) {
    if (state.kind !== "ready") return;
    const previous = state.rows;
    setUpdatingId(id);
    setState({
      kind: "ready",
      rows: previous.map((row) => row.id === id ? {...row, status} : row),
    });
    try {
      await updateLeadStatus(id, status);
    } catch (error) {
      setState({kind: "ready", rows: previous});
      console.error("[RecentLeads] update failed", error);
    } finally {
      setUpdatingId(null);
    }
  }

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
        <Link
          href="/admin/collections/leads/create"
          style={{fontSize: "0.75rem", color: "var(--t-primary)"}}
        >
          Create the first →
        </Link>
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
          gap: "0.75rem",
        }}
      >
        {state.rows.map(lead => {
          const digits = toWaDigits(lead.phone ?? "");
          const waHref = digits
            ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${lead.name}, this is Mishran following up on your enquiry.`)}`
            : null;
          return (
            <li
              key={lead.id}
              style={{
                border: "1px solid var(--t-border-card)",
                borderRadius: "0.75rem",
                padding: "0.75rem",
              }}
            >
              <div style={{display: "flex", justifyContent: "space-between", gap: "0.75rem"}}>
                <Link
                  href={`/admin/collections/leads/${lead.id}`}
                  style={{textDecoration: "none", color: "var(--t-text)"}}
                >
                  <span style={{display: "block", fontSize: "0.8125rem", fontWeight: 500}}>
                    {lead.name || "Unnamed lead"}
                  </span>
                  <span style={{display: "block", fontSize: "0.6875rem", color: "var(--t-text-muted)"}}>
                    {lead.email ?? lead.phone ?? "No contact"}
                  </span>
                </Link>
                {lead.status ? (
                  <span className={`mishran-pill mishran-pill--${STATUS_TONE[lead.status]}`}>
                    {lead.status}
                  </span>
                ) : null}
              </div>
              <div style={{display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.65rem"}}>
                {waHref ? (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mishran-pill mishran-pill--primary"
                    style={{textDecoration: "none"}}
                  >
                    WhatsApp
                  </a>
                ) : null}
                {ACTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={updatingId === lead.id || lead.status === status}
                    onClick={() => void changeStatus(lead.id, status)}
                    className={`mishran-pill mishran-pill--${STATUS_TONE[status]}`}
                    style={{border: 0, cursor: "pointer", opacity: lead.status === status ? 0.55 : 1}}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RecentLeads;
