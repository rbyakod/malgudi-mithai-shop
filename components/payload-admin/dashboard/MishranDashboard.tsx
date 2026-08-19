"use client";

import Link from "next/link";
import {RecentLeads} from "./RecentLeads";
import {MithaiFreshnessBoard} from "./MithaiFreshnessBoard";
import {PendingStories} from "./PendingStories";
import {CatalogCounts} from "./CatalogCounts";
import {OpsPulse} from "./OpsPulse";
import {WidgetErrorBoundary} from "./WidgetErrorBoundary";

// Rendered above Payload's default dashboard via admin.components.beforeDashboard.
// Each widget wrapped in its own error boundary so a single failure doesn't
// kill the rest of the dashboard. Audit §07: the ops KPI strip answers
// "what needs me right now"; the 2×2 grid below is the editorial workspace.
export function MishranDashboard() {
  return (
    <div
      className="mishran-dashboard"
      style={{paddingBottom: "1.75rem", marginBottom: "1.75rem", borderBottom: "1px solid var(--t-border)"}}
    >
      <div className="mishran-dashboard__hero">
        <div>
          <span className="mishran-dashboard__kicker">Mishran command center</span>
          <h1 className="mishran-dashboard__title">Today at Mishran</h1>
          <p className="mishran-dashboard__summary">
            Track orders, payment risk, freshness, catalog health, and storefront work from one place.
          </p>
        </div>
        <div className="mishran-dashboard__actions">
          <Link href="/admin/collections/orders?sort=-createdAt" className="mishran-button mishran-button--primary">
            Review orders
          </Link>
        </div>
      </div>
      <WidgetErrorBoundary name="Ops pulse">
        <OpsPulse />
      </WidgetErrorBoundary>
      <div
        className="mishran-dashboard__grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        <div className="mishran-card">
          <WidgetErrorBoundary name="Recent leads">
            <RecentLeads />
          </WidgetErrorBoundary>
        </div>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Mithai freshness">
            <MithaiFreshnessBoard />
          </WidgetErrorBoundary>
        </div>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Pending stories">
            <PendingStories />
          </WidgetErrorBoundary>
        </div>
        <div className="mishran-card">
          <WidgetErrorBoundary name="Catalog counts">
            <CatalogCounts />
          </WidgetErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default MishranDashboard;
