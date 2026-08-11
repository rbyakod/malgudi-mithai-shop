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
// - If Payload is unreachable (DB down, build without DB), the whole component
//   silently renders nothing — the layout must never 500 because of analytics.
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

export async function AnalyticsScripts() {
  const settings = await readAnalyticsSettings();
  const ga4Id = settings ? (settings.ga4Id ?? "").trim() : "";
  const pixelId = settings ? (settings.metaPixelId ?? "").trim() : "";

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
