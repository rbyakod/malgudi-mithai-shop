// components/layout/SiteFooter.tsx
// Brand layout shell footer — server component. Renders link map per IA,
// brand promise, FSSAI placeholder, social, WhatsApp CTA, and legal links.
//
// This supersedes the original components/SiteFooter.tsx (which was a small
// client component using useTranslations/useTheme). The new footer is a
// server component so it can be rendered inside the locale layout without
// pulling client providers into the leaf pages. Static, locale-agnostic copy
// is rendered inline; per-locale copy should be added in a follow-up via
// next-intl's getTranslations once the footer namespace is localised.

import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";
import {FALLBACK_WHATSAPP, toWaDigits} from "@/lib/whatsapp";

// IA link map. Each column groups related routes per the new information
// architecture. Targets may point at routes that don't exist yet (e.g.
// /stories/farms); they will be wired up in subsequent tasks.
const FOOTER_COLUMNS: {heading: string; links: {label: string; href: string}[]}[] = [
  {
    heading: "Shop",
    links: [
      {label: "Mithai", href: "/mithai"},
      {label: "Build a Gift", href: "/build-a-gift"},
      {label: "QSR", href: "/qsr"},
      {label: "Snacks", href: "/snacks"},
      {label: "Merch", href: "/merch"},
    ],
  },
  {
    heading: "Stories",
    links: [
      {label: "Overview", href: "/stories"},
      {label: "Farms", href: "/stories/farms"},
      {label: "Karigars", href: "/stories/karigars"},
      {label: "Journal", href: "/stories/journal"},
    ],
  },
  {
    heading: "Help",
    links: [
      {label: "Cart", href: "/cart"},
      {label: "Shipping & delivery", href: "/help/shipping"},
      {label: "Returns & refunds", href: "/help/returns"},
      {label: "Contact", href: "/help/contact"},
    ],
  },
  {
    heading: "Company",
    links: [
      {label: "About Mishran", href: "/about"},
      {label: "Careers", href: "/careers"},
      {label: "Press", href: "/press"},
      {label: "Wholesale", href: "/wholesale"},
    ],
  },
];

async function readWhatsappNumber(): Promise<string> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "analytics-settings"});
    const value = (global as {whatsappNumber?: unknown}).whatsappNumber;
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    // ignore — fall back below
  }
  return FALLBACK_WHATSAPP;
}

function toWaLink(raw: string): string {
  const digits = toWaDigits(raw);
  return digits ? `https://wa.me/${digits}` : "#";
}

export async function SiteFooter() {
  const whatsapp = await readWhatsappNumber();
  const waHref = toWaLink(whatsapp);
  const year = new Date().getFullYear();

  return (
    <footer
      className="site-footer mt-12 w-full border-t border-border-card bg-bg-darker text-text-light"
      aria-label="Site footer"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {/* Brand column */}
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-gold">
            MALGUDI SWEETS
          </p>
          <p className="max-w-xs text-[11px] leading-relaxed text-text-light-muted">
            Modern Indian mithai, handcrafted in small batches across our
            Bengaluru kitchens. Delivered fresh, packaged with intent.
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-[11px] font-semibold text-text-on-gold transition hover:bg-gold-hover"
          >
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-text-on-gold/70" />
            Chat on WhatsApp
          </a>
        </div>

        {/* Link columns */}
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading} className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light-muted">
              {col.heading}
            </h2>
            <ul className="space-y-1.5 text-xs">
              {col.links.map((link) => (
                <li key={link.href}>
                  {/* Locale prefixing is handled by next-intl middleware for
                      in-app routes. */}
                  <Link
                    href={link.href}
                    className="text-text-light-muted transition-colors hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Legal strip */}
      <div className="border-t border-text-heading/40">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-4 text-[11px] text-text-light-muted sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {year} Mishran. All rights reserved.</span>
            {/* FSSAI placeholder — replace once the licence number is final. */}
            <span
              className="inline-flex items-center gap-1 rounded-full border border-text-light-muted/40 px-2 py-0.5 text-[10px]"
              title="FSSAI licence placeholder"
            >
              FSSAI — pending
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-gold">Privacy</Link>
            <Link href="/terms" className="hover:text-gold">Terms</Link>
            <Link href="/accessibility" className="hover:text-gold">Accessibility</Link>
            <span className="text-text-light-muted/70">Instagram · X · YouTube</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
