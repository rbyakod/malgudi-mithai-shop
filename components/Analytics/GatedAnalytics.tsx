// components/Analytics/GatedAnalytics.tsx
// Loads Google Analytics 4 and Meta Pixel only after the visitor has accepted the analytics
// category (see lib/consent.ts). Nothing from Google or Meta is requested before that. If consent is
// withdrawn later, tracking is switched off for the rest of the visit and takes full effect on the
// next page load, because a loaded third-party script cannot be unloaded.
//
// Hotjar (session recordings) follows the same consent rule and is never started on pages that show personal or
// payment details (lib/hotjar.ts). If the visitor moves into such a page after it started, the page content is
// marked data-hj-suppress so it is not recorded.
"use client";

import {useEffect, useState, useSyncExternalStore} from "react";
import Script from "next/script";
import {usePathname} from "next/navigation";
import {consentSnapshot, parseConsent, subscribeConsent} from "@/lib/consent";
import {hotjarSnippet, isHotjarExcluded, validHotjarId} from "@/lib/hotjar";

type Props = {ga4Id: string; pixelId: string; hotjarId?: string};

type TrackingWindow = Record<string, unknown> & {fbq?: (...args: unknown[]) => void};

export function GatedAnalytics({ga4Id, pixelId, hotjarId = ""}: Props) {
  const raw = useSyncExternalStore<string | null>(subscribeConsent, consentSnapshot, () => null);
  const granted = raw !== null && parseConsent(raw)?.analytics === true;
  const pathname = usePathname();
  // Only start Hotjar if the page the visit began on is one that may be recorded.
  const [mayStartHotjar] = useState(() => !isHotjarExcluded(pathname));
  const hj = validHotjarId(hotjarId);
  const hotjarOn = granted && Boolean(hj) && mayStartHotjar;
  const onExcludedPage = isHotjarExcluded(pathname);

  useEffect(() => {
    if (!hotjarOn) return;
    document.body.toggleAttribute("data-hj-suppress", onExcludedPage);
  }, [hotjarOn, onExcludedPage]);

  useEffect(() => {
    if (raw === null || granted) return;
    // Consent absent or withdrawn: make sure an already loaded tag stays silent.
    const w = window as unknown as TrackingWindow;
    if (ga4Id) w[`ga-disable-${ga4Id}`] = true;
    if (typeof w.fbq === "function") w.fbq("consent", "revoke");
  }, [raw, granted, ga4Id]);

  if (!granted) return null;

  return (
    <>
      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window['ga-disable-${ga4Id}'] = false;
window.dataLayer = window.dataLayer || [];
// Events pushed by track() before consent stay local; drop them so they are not sent retroactively.
window.dataLayer.length = 0;
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
          </Script>
        </>
      )}
      {hotjarOn && (
        <Script id="hotjar-init" strategy="afterInteractive">
          {hotjarSnippet(hj)}
        </Script>
      )}
      {pixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('consent', 'grant');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}
