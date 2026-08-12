"use client";

import {useState} from "react";
import {
  ADMIN_THEMES,
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_MAX_AGE,
  DEFAULT_ADMIN_THEME,
  type AdminTheme,
} from "./admin-theme";

const LABELS: Record<AdminTheme, string> = {
  "mishran-admin": "Mishran (default)",
  "mishran-midnight": "Mishran Midnight",
  "mishran-monsoon": "Mishran Monsoon",
};

// Injected into the admin settings popup (gear icon above logout).
// Writes a 1-year cookie so SSR reads theme on next load — eliminates flash.
export function AdminThemeSwitcher() {
  const initial = readCurrentTheme();
  const [value, setValue] = useState<AdminTheme>(initial);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as AdminTheme;
    setValue(next);
    document.body.dataset.adminTheme = next;
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; Max-Age=${ADMIN_THEME_MAX_AGE}; Path=/; SameSite=Lax`;
  };
  return (
    <div style={{padding: "0.5rem 0"}}>
      <label
        htmlFor="mishran-admin-theme-select"
        style={{display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "var(--t-text-muted)"}}
      >
        Admin theme
      </label>
      <select
        id="mishran-admin-theme-select"
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          padding: "0.375rem 0.5rem",
          borderRadius: "6px",
          border: "1px solid var(--t-border)",
          background: "var(--t-bg-card)",
          color: "var(--t-text)",
        }}
      >
        {ADMIN_THEMES.map(t => (
          <option key={t} value={t}>{LABELS[t]}</option>
        ))}
      </select>
    </div>
  );
}

function readCurrentTheme(): AdminTheme {
  if (typeof document === "undefined") return DEFAULT_ADMIN_THEME;
  const fromBody = document.body.dataset.adminTheme;
  if (fromBody && (ADMIN_THEMES as readonly string[]).includes(fromBody)) {
    return fromBody as AdminTheme;
  }
  return DEFAULT_ADMIN_THEME;
}

export default AdminThemeSwitcher;
