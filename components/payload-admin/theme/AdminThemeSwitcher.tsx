"use client";

import {useCallback, useSyncExternalStore} from "react";
import {
  ADMIN_THEMES,
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_MAX_AGE,
  DEFAULT_ADMIN_THEME,
  isAdminTheme,
  type AdminTheme,
} from "./admin-theme";

const LABELS: Record<AdminTheme, string> = {
  "mishran-admin": "Mishran (cream)",
  "mishran-midnight": "Mishran Midnight",
  "mishran-monsoon": "Mishran Monsoon",
};

// Rendered in the admin sidebar below the nav links (afterNavLinks).
// Writes a 1-year cookie so SSR reads theme on the next load — no flash.
//
// Audit D4 + D2 hardening: the theme lives on document.body (an external
// store owned by the server-side boot script), so the select reads it via
// useSyncExternalStore with a server snapshot pinned to the default. The
// server HTML always matches the first client render; the real value
// (from the boot script's data attribute) takes over after hydration
// without a mismatch.
const listeners = new Set<() => void>();

function readBodyTheme(): AdminTheme {
  const fromBody = document.body.dataset.adminTheme;
  return isAdminTheme(fromBody) ? fromBody : DEFAULT_ADMIN_THEME;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function AdminThemeSwitcher() {
  const value = useSyncExternalStore(
    subscribe,
    readBodyTheme,
    () => DEFAULT_ADMIN_THEME,
  );

  const onChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as AdminTheme;
    document.body.dataset.adminTheme = next;
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; Max-Age=${ADMIN_THEME_MAX_AGE}; Path=/; SameSite=Lax`;
    for (const listener of listeners) listener();
  }, []);

  return (
    <div style={{padding: "0.75rem 0.5rem 0.25rem"}}>
      <label
        htmlFor="mishran-admin-theme-select"
        style={{
          display: "block",
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "0.3rem",
          // Nav-rail tokens — this control lives on the dark sidebar field
          // (see --t-nav-* in custom.scss), not the page canvas.
          color: "var(--t-nav-muted)",
        }}
      >
        Admin theme
      </label>
      <select
        id="mishran-admin-theme-select"
        value={value}
        onChange={onChange}
        aria-label="Admin theme"
        style={{
          width: "100%",
          padding: "0.375rem 0.5rem",
          borderRadius: "6px",
          border: "1px solid var(--t-nav-border)",
          background: "var(--t-nav-hover-bg)",
          color: "var(--t-nav-text)",
          fontSize: "0.8125rem",
          cursor: "pointer",
        }}
      >
        {ADMIN_THEMES.map(t => (
          <option key={t} value={t}>{LABELS[t]}</option>
        ))}
      </select>
    </div>
  );
}

export default AdminThemeSwitcher;
