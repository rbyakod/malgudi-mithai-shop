// Sets body[data-admin-theme] from cookie on first client render.
//
// Original implementation used an inline <script> rendered via RSC, but
// Next.js 16 App Router does NOT execute inline scripts rendered as React
// children inside server components (browser sees them in HTML but never
// runs them). next/script with beforeInteractive only fires from the root
// layout, which Payload owns. The pragmatic fix is a client component that
// runs the same logic in a useEffect on mount. We accept the brief theme
// flash on cold cache (one paint frame) in exchange for reliable execution.
"use client";

import {useEffect} from "react";
import {
  ADMIN_THEME_COOKIE,
  ADMIN_THEMES,
  DEFAULT_ADMIN_THEME,
  type AdminTheme,
} from "./admin-theme";

export function AdminThemeBootScript() {
  useEffect(() => {
    try {
      const match = document.cookie.match(
        new RegExp(`(?:^|;\\s)${ADMIN_THEME_COOKIE}=([^;]+)`),
      );
      const value = match ? decodeURIComponent(match[1]) : DEFAULT_ADMIN_THEME;
      const known: readonly string[] = ADMIN_THEMES;
      const theme: AdminTheme = known.includes(value)
        ? (value as AdminTheme)
        : DEFAULT_ADMIN_THEME;
      document.body.setAttribute("data-admin-theme", theme);
    } catch {
      document.body.setAttribute("data-admin-theme", DEFAULT_ADMIN_THEME);
    }
  }, []);
  return null;
}

export default AdminThemeBootScript;
