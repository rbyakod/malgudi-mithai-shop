// components/layout/BrandBar.tsx
// Slim utility strip above the main header. Renders WhatsApp number, store
// count, and freshness promise tagline.
//
// Server component — reads the WhatsApp number from Payload's
// `analytics-settings` global. Falls back to a placeholder when Payload is
// unavailable (e.g. during build without DB) so the layout never throws.

import {getPayload} from "@/lib/payload-client";

// Static fallback used when the global is missing or empty. Same number that
// the legacy footer hard-coded.
const FALLBACK_WHATSAPP = "+91-98765-43210";

// Build a wa.me link from a +<digits> string.
function toWaLink(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

// Best-effort Payload read. Returns null on any error so the layout stays
// resilient during build, migrations, or DB outages.
async function readWhatsappNumber(): Promise<string | null> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "analytics-settings"});
    const value = (global as {whatsappNumber?: unknown}).whatsappNumber;
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  } catch {
    return null;
  }
}

export async function BrandBar() {
  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;
  const waHref = toWaLink(whatsapp);

  return (
    <div
      className="brand-bar w-full border-b border-border-card bg-bg-darker text-text-light"
      role="complementary"
      aria-label="Brand announcements"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-[11px] sm:px-6 lg:px-8">
        <p className="brand-bar__promise font-medium tracking-wide text-gold">
          Handcrafted daily · Delivered fresh across Bengaluru
        </p>
        <div className="brand-bar__meta flex flex-wrap items-center gap-x-4 gap-y-0.5 text-text-light-muted">
          <span className="hidden sm:inline">3 kitchens · 1 promise</span>
          <a
            href={waHref}
            className="inline-flex items-center gap-1.5 font-medium text-text-light transition-colors hover:text-gold"
            // Open WhatsApp in a new tab; rel follows safe best-practice.
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-gold"
            />
            {whatsapp}
          </a>
        </div>
      </div>
    </div>
  );
}

export default BrandBar;
