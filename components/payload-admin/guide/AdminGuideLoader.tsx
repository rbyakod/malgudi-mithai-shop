"use client";
// components/payload-admin/guide/AdminGuideLoader.tsx
// Adds the explain-only "Ask the admin guide" panel to every Payload admin page. The widget script is served by
// the agent service (/agent-team/js/admin-guide.js) and talks only to this site's /api/admin-guide route.
import { useEffect } from "react";

export default function AdminGuideLoader() {
  useEffect(() => {
    if (document.getElementById("atg-loader")) return;
    const s = document.createElement("script");
    s.id = "atg-loader";
    s.src = "/agent-team/js/admin-guide.js";
    s.defer = true;
    s.setAttribute("data-endpoint", "/api/admin-guide");
    s.setAttribute("data-label", "Ask the admin guide");
    s.setAttribute("data-color", "#7b1e2c");
    s.setAttribute("data-title", "Mishran admin guide");
    s.setAttribute("data-hint", "Explains what each setting does and what changes if you alter it. It cannot change anything or see your orders.");
    document.body.appendChild(s);
  }, []);
  return null;
}
