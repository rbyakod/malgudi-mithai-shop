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
// Loading strategy: `afterInteractive` (the next/script default) — scripts
// load early but after page hydration so they don't block LCP.
//
// TODO: consent gate. Currently fires PageView on load. Wire a CMP/consent
// check before pushing if/when GDPR or regional consent requires it.

import Script from "next/script";
import {getPayload} from "@/lib/payload-client";

type AnalyticsGlobal = {
  ga4Id?: string | null;
  metaPixelId?: string | null;
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

  const hasGa4 = isPresent(ga4Id);
  const hasPixel = isPresent(pixelId);

  if (!hasGa4 && !hasPixel) return null;

  return (
    <>
      {hasGa4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
          </Script>
        </>
      )}

      {hasPixel && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
          </Script>
        </>
      )}
    </>
  );
}
