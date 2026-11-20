"use client";

// components/layout/SiteHeader.tsx
// Brand layout shell header, the Mishran Design System's SiteHeader: the
// cream-on-maroon lockup, Mono capital nav, locale picker, a CART button that
// says the count in words, and a MENU panel below 1120px. No icons: words.

import {useState, useEffect, useCallback, useRef} from "react";
import Image from "next/image";
import {useTranslations, useLocale} from "next-intl";
import {Link, usePathname} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {
  NAV_LINKS,
  MORE_NAV_LINKS,
  SHOP_NAV_LINKS,
  STORY_NAV_LINKS,
} from "@/components/layout/nav-links";
import {track} from "@/lib/analytics";

// Re-export so callers (and tests) can import NAV_LINKS from the spec-mandated
// path `@/components/layout/SiteHeader`. The constant itself lives in a pure
// data module to keep unit tests free of React/next-intl runtime boot.
export {NAV_LINKS};

export const AVAILABLE_LOCALES = [
  {code: "en", label: "English"},
  {code: "hi", label: "हिन्दी"},
  {code: "kn", label: "ಕನ್ನಡ"},
] as const;

/* ---- Scroll-spy for in-page anchors ---- */
// Maps nav href → section DOM id. The new IA is route-based, so this map is
// empty for now; kept here so future hash anchors (e.g. /mithai#diwali) light
// up correctly without re-architecting isActiveLink.
const HASH_SECTION_MAP: Record<string, string> = {};

function useActiveSection(pathname: string): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Scroll-spy only fires for in-page anchors. With the new route-based IA,
    // there is nothing to observe until HASH_SECTION_MAP is populated, so skip
    // the effect entirely (initial state of `activeId` is already null).
    const sectionIds = Object.values(HASH_SECTION_MAP);
    if (sectionIds.length === 0) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = new Map<string, number>();
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          }
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setActiveId(best);
      },
      {
        rootMargin: "-120px 0px -40% 0px",
        threshold: [0, 0.25, 0.5],
      }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [pathname]);

  return activeId;
}

/* ---- Helpers ---- */

function isActiveLink(
  linkHref: string,
  pathname: string,
  activeSection: string | null
): boolean {
  // Hash anchors: only active on the matching section.
  if (linkHref.startsWith("/#")) {
    const sectionId = HASH_SECTION_MAP[linkHref];
    return sectionId != null && sectionId === activeSection;
  }
  // Route-based links: match by path prefix. Use a segment-aware check so
  // "/stories" does not mark "/stories/farms" active when the user is on the
  // parent route — exact-or-prefix match.
  if (linkHref === "/") {
    return pathname === "/";
  }
  return pathname === linkHref || pathname.startsWith(`${linkHref}/`);
}

/* ---- Component ---- */

export function SiteHeader() {
  const {count} = useCart();
  const t = useTranslations("Header");
  const navT = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(pathname);

  // Mobile nav links close the menu on click — handled via onClick in the
  // link list below. (Previous implementation closed on route change via
  // setState-in-effect, which trips the cascading-render lint rule.)

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Close the mobile menu when the user hits browser back/forward. Without
  // this, the overlay stays open over the previous page after navigation.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [menuOpen]);

  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      if (nextLocale === locale) return;
      track("locale_changed", {from: locale, to: nextLocale});
      // A full page load (not a client-side switch) so the AI team's widget, which reads its
      // wording once per page load, comes back in the new language too. Every URL carries
      // its locale (localePrefix "always"), so the same page is /<locale><path>.
      const path = pathname === "/" ? "" : pathname;
      window.location.assign(`/${nextLocale}${path}${window.location.search}`);
    },
    [locale, pathname]
  );

  return (
    <header className="ms-header sticky top-0 z-20">
      <div className="ms-wrap ms-header-in">
        <Link href="/" className="ms-header-logo" aria-label="Mishran, home">
          {/* The supplied lockup, outlined: the name is never set in type. On phones the
              design system's wordmark (the name without the crest, at the size the name has in
              the 240px lockup) makes room for CART beside MENU. */}
          <Image
            className="ms-logo-full"
            src="/brand/mishran-lockup-cream-on-maroon.svg"
            alt="Mishran"
            width={300}
            height={62}
            unoptimized
            priority
          />
          <Image
            className="ms-logo-word"
            src="/brand/mishran-wordmark-cream-on-maroon.svg"
            alt="Mishran"
            width={184}
            height={25}
            unoptimized
            priority
          />
        </Link>

        <nav aria-label="Main navigation">
          <ul className="ms-nav">
            {SHOP_NAV_LINKS.map((link, i) => {
              const active = isActiveLink(link.href, pathname, activeSection);
              // nav keys are namespaced (e.g. "nav.mithai"); useTranslations
              // takes a namespace, so strip the prefix.
              const label = navT(link.key.replace(/^nav\./, ""));
              // The AI team puts its "AI Team" menu before the item marked nav-end.
              const last = i === SHOP_NAV_LINKS.length - 1;
              return (
                <li key={link.href} data-agent-mount={last ? "nav-end" : undefined}>
                  <Link href={link.href} aria-current={active ? "page" : undefined}>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-header-actions">
          <select
            className="ms-locale"
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            aria-label="Language"
          >
            {AVAILABLE_LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <Link
            href="/cart"
            className="ms-btn ms-btn-on-dark ms-cart-btn"
            aria-label={count > 0 ? `${t("cart")}, ${t("cartCount", {count})}` : undefined}
          >
            {t("cart")}
            {count > 0 ? <span className="ms-count" aria-hidden="true">{count}</span> : null}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="ms-btn ms-btn-on-dark ms-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="ms-mobile-menu"
          >
            {menuOpen ? t("close") : t("menu")}
            {/* Under 360px there is no room for CART: the count rides on MENU instead. */}
            {count > 0 && !menuOpen ? <span className="ms-count ms-menu-count" aria-hidden="true">{count}</span> : null}
          </button>
        </div>
      </div>

      {/* Menu panel: the nav folds here below 1120px. */}
      <div id="ms-mobile-menu" className="ms-menu-panel" hidden={!menuOpen}>
        <nav className="ms-wrap ms-menu-in" aria-label="Mobile navigation">
          {/* Cart and language first: the panel can be taller than a phone screen. */}
          <div className="ms-menu-top">
            <Link
              href="/cart"
              onClick={() => setMenuOpen(false)}
              className="ms-btn ms-btn-on-dark"
            >
              {t("cart")}
              {count > 0 ? ` · ${count}` : ""}
            </Link>
            <select
              className="ms-locale ms-locale--panel"
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              aria-label="Language"
            >
              {AVAILABLE_LOCALES.map((l) => (
                <option key={l.code} value={l.code} lang={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <p className="ms-label">{navT("shop")}</p>
          <ul>
            {SHOP_NAV_LINKS.map((link) => {
              const active = isActiveLink(link.href, pathname, activeSection);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    {navT(link.key.replace(/^nav\./, ""))}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="ms-label">{navT("more")}</p>
          <ul>
            {MORE_NAV_LINKS.map((link) => {
              const active = isActiveLink(link.href, pathname, activeSection);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    {navT(link.key.replace(/^nav\./, ""))}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="ms-label">{navT("learn")}</p>
          <ul>
            {STORY_NAV_LINKS.map((link) => {
              const active = isActiveLink(link.href, pathname, activeSection);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    {navT(link.key.replace(/^nav\./, ""))}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
