// components/layout/BrandBar.tsx
// Slim utility strip above the main header, on nutmeg: the house promise
// and the WhatsApp number, in Mono capitals.
//
// Server component — reads the WhatsApp number from Payload's
// `analytics-settings` global. Falls back to a placeholder when Payload is
// unavailable (e.g. during build without DB) so the layout never throws.

import {getPayload} from "@/lib/payload-client";
import {isFullWidthLayout, type StorefrontLayoutMode} from "@/lib/storefront-layout";
import {FALLBACK_WHATSAPP, toWaDigits} from "@/lib/whatsapp";

// Build a wa.me link from a +<digits> string.
function toWaLink(raw: string): string {
  const digits = toWaDigits(raw);
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

type Props = {
  layoutMode?: StorefrontLayoutMode;
};

export async function BrandBar({layoutMode = "fixed"}: Props) {
  const whatsapp = (await readWhatsappNumber()) ?? FALLBACK_WHATSAPP;
  const waHref = toWaLink(whatsapp);
  const railClassName = [
    "mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6",
    isFullWidthLayout(layoutMode) ? "max-w-none lg:px-10 2xl:px-14" : "max-w-6xl lg:px-8",
  ].join(" ");

  return (
    <div
      className="brand-bar ms-brandbar"
      role="complementary"
      aria-label="Brand announcements"
    >
      <div className={railClassName}>
        <p className="ms-brandbar-promise">
          Honest Indian mithai <span aria-hidden="true">·</span> From our own dairy in Jhajjar
        </p>
        <a
          href={waHref}
          className="ms-brandbar-link"
          // Open WhatsApp in a new tab; rel follows safe best-practice.
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp {whatsapp}
        </a>
      </div>
    </div>
  );
}

export default BrandBar;
