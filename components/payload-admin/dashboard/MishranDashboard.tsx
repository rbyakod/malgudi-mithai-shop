"use client";

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
      style={{paddingBottom: "1.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--t-border)"}}
    >
      <h2 style={{fontFamily: "var(--mishran-font-display)", fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem"}}>
        Shop overview
      </h2>
      <WidgetErrorBoundary name="Ops pulse">
        <OpsPulse />
      </WidgetErrorBoundary>
      <div
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
