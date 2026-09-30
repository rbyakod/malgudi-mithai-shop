// lib/hotjar.ts
// Hotjar (session recordings and heatmaps), loaded only after the visitor accepts the analytics category, like GA4
// and the Meta Pixel (components/Analytics/GatedAnalytics.tsx). The site ID comes from the admin's Analytics Settings.
//
// Privacy: recordings capture what is on screen, so pages that show personal or payment details are never recorded,
// and Hotjar's own keystroke suppression stays on (its default).

/** A Hotjar site ID is a number. Anything else is refused because the ID is written into an inline script. */
export function validHotjarId(value: unknown): string {
  const v = typeof value === "string" ? value.trim() : "";
  return /^\d{4,10}$/.test(v) ? v : "";
}

// Locale prefix first (/en, /hi, /kn), then the path. Pages that show personal or payment details, and the admin.
const EXCLUDED_PREFIXES = ["/checkout", "/account", "/sign-in", "/track-order", "/staff", "/admin"];

export function isHotjarExcluded(pathname: string | null | undefined): boolean {
  const path = (pathname ?? "").split(/[?#]/)[0].replace(/^\/(en|hi|kn)(?=\/|$)/, "") || "/";
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Hotjar's standard loader for a validated ID (digits only, so nothing can break out of the script). */
export function hotjarSnippet(id: string): string {
  const safe = validHotjarId(id);
  if (!safe) return "";
  return `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${safe},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`;
}
