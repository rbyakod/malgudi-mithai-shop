"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {fetchCatalogCounts, type CatalogCounts as Counts} from "@/components/payload-admin/lib/dashboard-queries";

const COLLECTIONS = [
  {slug: "mithai-products", label: "Mithai"},
  {slug: "qsr-menu-items", label: "QSR Menu"},
  {slug: "snack-products", label: "Snacks"},
  {slug: "merch-products", label: "Merch"},
  {slug: "gift-boxes", label: "Gift Boxes"},
] as const;

type State =
  | {kind: "loading"}
  | {kind: "ready"; counts: Counts};

export function CatalogCounts() {
  const [state, setState] = useState<State>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchCatalogCounts()
      .then(counts => {
        if (cancelled) return;
        setState({kind: "ready", counts});
      })
      .catch(() => {
        // fetchCatalogCounts swallows per-collection errors and returns null.
        // Reach here only if all fail catastrophically — render whatever we have.
        if (cancelled) return;
        setState({kind: "ready", counts: {
          "mithai-products": null,
          "qsr-menu-items": null,
          "snack-products": null,
          "merch-products": null,
          "gift-boxes": null,
        }});
      });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Catalog</h3>
        <div className="mishran-catalog-counts">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} data-testid="skeleton-card" className="mishran-skeleton" style={{height: "5rem"}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Catalog</h3>
      <div className="mishran-catalog-counts">
        {COLLECTIONS.map(coll => {
          const count = state.counts[coll.slug];
          return (
            <Link
              key={coll.slug}
              href={`/admin/collections/${coll.slug}`}
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
              <span style={{fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t-text-muted)"}}>
                {coll.label}
              </span>
              <span style={{fontSize: "1.5rem", fontWeight: 700}}>
                {count === null || count === undefined ? "—" : count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default CatalogCounts;
