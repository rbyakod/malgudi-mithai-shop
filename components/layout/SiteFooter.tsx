// components/layout/SiteFooter.tsx
// Brand layout shell footer — server component. The Mishran Design System's
// SiteFooter on nutmeg: stacked lockup, the shop, link map per IA, and the
// FSSAI licence line on every page.
//
// This supersedes the original components/SiteFooter.tsx (which was a small
// client component using useTranslations/useTheme). The new footer is a
// server component so it can be rendered inside the locale layout without
// pulling client providers into the leaf pages. Static, locale-agnostic copy
// is rendered inline; per-locale copy should be added in a follow-up via
// next-intl's getTranslations once the footer namespace is localised.

import Image from "next/image";
import {Link} from "@/i18n/navigation";
import {ConsentPreferencesLink} from "@/components/consent/ConsentPreferencesLink";
import {getPayload} from "@/lib/payload-client";
import {fullAddress, getPrimaryStore} from "@/lib/store-info";
import {isFullWidthLayout, type StorefrontLayoutMode} from "@/lib/storefront-layout";
import {FALLBACK_WHATSAPP, toWaDigits} from "@/lib/whatsapp";

// IA link map. Each column groups related routes per the new information
// architecture. Targets may point at routes that don't exist yet (e.g.
// /stories/farms); they will be wired up in subsequent tasks.
const FOOTER_COLUMNS: {heading: string; links: {label: string; href: string}[]}[] = [
  {
    heading: "Shop",
    links: [
      {label: "Gifting", href: "/gifts"},
      {label: "Mithai", href: "/mithai"},
      {label: "Build a box", href: "/build-a-gift"},
      {label: "Restaurant", href: "/qsr"},
      {label: "Snacks", href: "/snacks"},
      {label: "Boxes and thalis", href: "/merch"},
    ],
  },
  {
    heading: "The house",
    links: [
      {label: "Our dairy", href: "/stories/farms"},
      {label: "Our karigars", href: "/stories/karigars"},
      {label: "Journal", href: "/stories/journal"},
      {label: "Visit", href: "/visit"},
    ],
  },
  {
    heading: "Help",
    links: [
      {label: "Cart", href: "/cart"},
      {label: "Shipping & delivery", href: "/help/shipping"},
      {label: "Returns & refunds", href: "/help/returns"},
      {label: "Track order", href: "/track-order"},
      {label: "Contact", href: "/help/contact"},
    ],
  },
  {
    heading: "Gifting for",
    links: [
      {label: "Occasions", href: "/occasions"},
      {label: "Weddings", href: "/weddings"},
      {label: "The office", href: "/corporate"},
      {label: "About Mishran", href: "/about"},
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

type Props = {
  layoutMode?: StorefrontLayoutMode;
};

export async function SiteFooter({layoutMode = "fixed"}: Props) {
  const whatsapp = await readWhatsappNumber();
  const store = await getPrimaryStore();
  const waHref = toWaLink(whatsapp);
  const year = new Date().getFullYear();
  const railClassName = [
    "mx-auto w-full px-4 sm:px-6",
    isFullWidthLayout(layoutMode) ? "max-w-none lg:px-10 2xl:px-14" : "max-w-6xl lg:px-8",
  ].join(" ");

  return (
    <footer className="site-footer ms-footer" aria-label="Site footer">
      <div className={`${railClassName} ms-footer-in ms-footer-in--cols`}>
        {/* Brand column: the stacked lockup, the shop, WhatsApp. */}
        <div className="ms-footer-brand">
          <div className="ms-footer-logo">
            <Image
              src="/brand/mishran-stacked-cream-on-nutmeg.svg"
              alt="Mishran"
              width={160}
              height={169}
              unoptimized
            />
          </div>
          <address>
            {store ? fullAddress(store) : "H-4/3, Main Market, Model Town-II, North Delhi, Delhi-110009"}
            {store?.hours ? <span className="block">Hours: {store.hours}</span> : null}
          </address>
          <p>
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              WhatsApp {whatsapp}
            </a>
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h2 className="ms-footer-head">{col.heading}</h2>
            <ul className="ms-footer-links">
              {col.links.map((link) => (
                <li key={`${col.heading}-${link.href}`}>
                  {/* Locale prefixing is handled by next-intl middleware for
                      in-app routes. */}
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Legal strip: the FSSAI licence number is on every page. */}
      <div className={`${railClassName} ms-footer-legal`}>
        <p>© {year} Balanced Brands Private Limited</p>
        <p>FSSAI Lic. No. 13325008000711</p>
        <p className="ms-footer-legal-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/accessibility">Accessibility</Link>
          <ConsentPreferencesLink />
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
