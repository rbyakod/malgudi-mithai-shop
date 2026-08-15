// lib/analytics.ts
// Isomorphic analytics event helper. Call from any client component, server
// component, route handler, or helper module:
//
//   import { track } from "@/lib/analytics";
//   track("product_viewed", { id: "kaju-katli" });
//
// On the client it pushes to `window.dataLayer` (GA4) and forwards to
// `window.fbq` (Meta Pixel custom event). On the server it is a no-op so
// server-side call sites can call `track()` unconditionally without branching.
//
// TODO: consent gate. Currently fires unconditionally on first party event.
// Wire a CMP/consent check before pushing if/when GDPR or regional consent
// requirements mandate it.

// Canonical event names used across the Mishran storefront. Keep this list in
// sync with any consumer (search, gift builder, lead form, locale switcher,
// theme switcher, missing-translation fallback, hero rotator).
export type EventName =
  | "product_viewed"
  | "story_viewed"
  | "karigar_viewed"
  | "packaging_viewed"
  | "gift_builder_started"
  | "gift_builder_completed"
  | "add_to_cart"
  | "buy_now"
  | "external_retailer_clicked"
  | "hero_slide_view"
  | "hero_add_to_cart"
  | "lead_submitted"
  | "whatsapp_clicked"
  | "search_used"
  | "draft_saved"
  | "locale_changed"
  | "theme_changed"
  | "missing_translation";

type AnalyticsWindow = typeof globalThis & {
  dataLayer?: Record<string, unknown>[];
  fbq?: (...args: unknown[]) => void;
};

export function track(
  event: EventName,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...payload });
  if (typeof w.fbq === "function") {
    w.fbq("trackCustom", event, payload);
  }
}
