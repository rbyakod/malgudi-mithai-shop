// components/Analytics/AnalyticsScripts.tsx
// Server component that reads the `analytics-settings` Payload global at
// request time and inlines the GA4 + Meta Pixel bootstrap scripts.
//
// Mounted in app/layout.tsx as a sibling to the client providers. Stays a
// server component because it touches Payload (DB) at request time and must
// not be in the client bundle.
//
// Behavior:
// - If an ID is empty/missing, the matching script is skipped (no broken
//   injection).
// - If Payload is unreachable (DB down, build without DB), the component
//   falls back to NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_META_PIXEL_ID env vars
//   so a misconfigured Payload global doesn't silently break tracking.
// - If neither the global nor the env vars yield an ID, the whole component
//   renders nothing — the layout must never 500 because of analytics.
//
// Hotjar (recordings) is included with the same consent rule; see GatedAnalytics and lib/hotjar.ts.
//
// Loading strategy: `afterInteractive` once consent exists, so scripts never block LCP.
//
// Consent: nothing is loaded until the visitor accepts the analytics category in the sitewide
// consent banner. GatedAnalytics (client) does the gating; see lib/consent.ts.

import {GatedAnalytics} from "@/components/Analytics/GatedAnalytics";
import {getPayload} from "@/lib/payload-client";
import {validHotjarId} from "@/lib/hotjar";

type AnalyticsGlobal = {
  ga4Id?: string | null;
  metaPixelId?: string | null;
  hotjarId?: string | null;
};

// Best-effort Payload read. Returns null on any error so the layout stays
// resilient during build, migrations, or DB outages.
async function readAnalyticsSettings(): Promise<AnalyticsGlobal | null> {
  try {
    const payload = await getPayload();
    const g = (await payload.findGlobal({slug: "analytics-settings"})) as AnalyticsGlobal;
    return g ?? null;
  } catch {
    return null;
  }
}

function isPresent(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// One-shot warn so operators notice when the env-var fallback fires. Without
// this, a silent fallback could mask a broken Payload global indefinitely.
let warnedFallback = false;
function warnFallback(which: "ga4" | "pixel" | "both"): void {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(
    `[analytics] Payload global unreadable or empty — falling back to NEXT_PUBLIC_* env vars for ${which}. ` +
      "Set the analytics-settings global in Payload to silence this.",
  );
}

export async function AnalyticsScripts() {
  const settings = await readAnalyticsSettings();
  const payloadGa4 = settings ? (settings.ga4Id ?? "").trim() : "";
  const payloadPixel = settings ? (settings.metaPixelId ?? "").trim() : "";

  // Env-var fallback chain. The Payload global is the source of truth; env
  // vars only fire when Payload returns nothing useful. Documented in
  // docs/deployment.md §Analytics IDs.
  const ga4Id = isPresent(payloadGa4)
    ? payloadGa4
    : (process.env.NEXT_PUBLIC_GA4_ID ?? "").trim();
  const pixelId = isPresent(payloadPixel)
    ? payloadPixel
    : (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();

  // If we used any env-var fallbacks, surface a one-time warning so the
  // operator notices the global isn't configured.
  const usedGa4Fallback = !isPresent(payloadGa4) && isPresent(ga4Id);
  const usedPixelFallback = !isPresent(payloadPixel) && isPresent(pixelId);
  if (usedGa4Fallback || usedPixelFallback) {
    warnFallback(usedGa4Fallback && usedPixelFallback ? "both" : usedGa4Fallback ? "ga4" : "pixel");
  }

  // Hotjar: the admin's Analytics Settings, else NEXT_PUBLIC_HOTJAR_ID. Numbers only (it goes into a script).
  const hotjarId = validHotjarId(settings?.hotjarId) || validHotjarId(process.env.NEXT_PUBLIC_HOTJAR_ID);

  const hasGa4 = isPresent(ga4Id);
  const hasPixel = isPresent(pixelId);

  if (!hasGa4 && !hasPixel && !hotjarId) return null;

  // Scripts load only after the visitor accepts the analytics category (GatedAnalytics).
  return <GatedAnalytics ga4Id={hasGa4 ? ga4Id : ""} pixelId={hasPixel ? pixelId : ""} hotjarId={hotjarId} />;
}
