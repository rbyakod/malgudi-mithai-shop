"use client";

import {useEffect, useState} from "react";
import {fetchPendingStories, type StoryRow} from "@/components/payload-admin/lib/dashboard-queries";
import {formatRelativeTime} from "@/components/payload-admin/lib/relative-time";

type State =
  | {kind: "loading"}
  | {kind: "empty"}
  | {kind: "ready"; rows: StoryRow[]}
  | {kind: "error"; message: string};

export function PendingStories() {
  const [state, setState] = useState<State>({kind: "loading"});

  useEffect(() => {
    let cancelled = false;
    fetchPendingStories(5)
      .then(rows => {
        if (cancelled) return;
        setState(rows.length === 0 ? {kind: "empty"} : {kind: "ready", rows});
      })
      .catch(err => {
        if (cancelled) return;
        setState({kind: "error", message: String(err)});
      });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} data-testid="skeleton-row" className="mishran-skeleton" style={{height: "2rem", marginBottom: "0.5rem"}} />
        ))}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-text-muted)"}}>No pending drafts.</p>
        <a href="/admin/collections/stories/create" style={{fontSize: "0.75rem", color: "var(--t-primary)"}}>Start a new story →</a>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
        <p style={{fontSize: "0.8125rem", color: "var(--t-danger)"}}>Couldn&apos;t load stories. {state.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem"}}>Pending stories</h3>
      <ul style={{listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem"}}>
        {state.rows.map(story => (
          <li key={story.id}>
            <a
              href={`/admin/collections/stories/${story.id}`}
              style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "var(--t-text)"}}
            >
              <span>
                <span style={{display: "block", fontSize: "0.8125rem", fontWeight: 500}}>
                  {story.name || story.title || "Untitled"}
                </span>
                {story.pillar && (
                  <span style={{display: "block", fontSize: "0.6875rem", color: "var(--t-text-muted)"}}>
                    {story.pillar}
                  </span>
                )}
              </span>
              <span style={{fontSize: "0.6875rem", color: "var(--t-text-muted)"}}>
                edited {formatRelativeTime(story.updatedAt)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PendingStories;
