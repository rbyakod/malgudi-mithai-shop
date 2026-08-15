"use client";

// components/layout/SiteHeader.tsx
// Brand layout shell header. Mounts the new IA nav (mithai, build-a-gift,
// qsr, snacks, merch, stories, farms, karigars, journal) while preserving the
// behaviour of the legacy Header.tsx: theme switcher, locale picker, cart
// badge with live count, scroll-spy for in-page anchors, and a mobile menu
// overlay with body-scroll lock.

import {useState, useEffect, useCallback, useRef} from "react";
import Image from "next/image";
import {useTranslations, useLocale} from "next-intl";
import {Link, usePathname, useRouter} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {useTheme} from "@/context/ThemeContext";
import {ThemeSwitcher} from "@/components/ThemeSwitcher";
import {
  NAV_LINKS,
  SHOP_NAV_LINKS,
  STORY_NAV_LINKS,
} from "@/components/layout/nav-links";
import {track} from "@/lib/analytics";
import {isFullWidthLayout, type StorefrontLayoutMode} from "@/lib/storefront-layout";

// Re-export so callers (and tests) can import NAV_LINKS from the spec-mandated
// path `@/components/layout/SiteHeader`. The constant itself lives in a pure
// data module to keep unit tests free of React/next-intl runtime boot.
export {NAV_LINKS};

export const AVAILABLE_LOCALES = [
  {code: "en", label: "English"},
  {code: "hi", label: "हिन्दी"},
  {code: "kn", label: "ಕನ್ನಡ"},
] as const;

/* ---- SVG Icons (inline, zero dependencies) ---- */

function CartIcon({className}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function MenuIcon({className}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon({className}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

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

type Props = {
  layoutMode?: StorefrontLayoutMode;
  showThemeSwitcher?: boolean;
};

export function SiteHeader({
  layoutMode = "fixed",
  showThemeSwitcher = false,
}: Props) {
  const {count} = useCart();
  const {theme} = useTheme();
  const t = useTranslations("Header");
  const navT = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(pathname);
  const isHeritage2 = theme === "wedding-heritage";
  const railClassName = [
    "mx-auto px-4 sm:px-6",
    isFullWidthLayout(layoutMode) ? "max-w-none lg:px-10 2xl:px-14" : "max-w-6xl lg:px-8",
  ].join(" ");

  useEffect(() => {
    const threshold = 40;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, {passive: true});
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      router.replace(pathname, {locale: nextLocale});
    },
    [locale, pathname, router]
  );

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={["nav-header", isHeritage2 ? "nav-header--heritage2" : ""].join(" ").trim()}
    >
      <div className={railClassName}>
        {/* Top bar — always visible */}
        <div className="nav-top-bar">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="nav-logo-mark nav-logo-mark--image">
              <Image
                src="/images/mishran-logo-mark.png"
                alt="Mishran sun mark"
                width={56}
                height={56}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <p className="nav-brand-title text-sm font-semibold tracking-wide text-primary">
                MISHRAN
              </p>
              <p className="nav-tagline text-xs text-text-muted">
                {t("tagline")}
              </p>
            </div>
          </Link>

          {/* Desktop right section */}
          <div className="hidden items-center gap-2.5 md:flex">
            {showThemeSwitcher ? <ThemeSwitcher /> : null}

            <Link
              href="/cart"
              className="nav-utility-chip relative flex items-center gap-1.5 rounded-full border border-border-input bg-bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-primary/70 hover:text-primary"
            >
              <CartIcon className="h-3.5 w-3.5" />
              <span>{t("cart")}</span>
              {count > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-text-light">
                  {count}
                </span>
              )}
            </Link>

            <select
              className="nav-locale-select rounded-full border border-border-input bg-bg-card px-2.5 py-1.5 text-xs text-text-secondary"
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              aria-label="Language"
            >
              {AVAILABLE_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>

            <Link
              href="/mithai"
              className="nav-order-button ml-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-text-light shadow-sm transition-colors hover:bg-primary-hover"
            >
              {t("orderNow")}
            </Link>
          </div>

          {/* Mobile right section */}
          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/cart"
              className="nav-utility-chip relative flex items-center gap-1.5 rounded-full border border-border-input bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-secondary"
            >
              <CartIcon className="h-3.5 w-3.5" />
              {count > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-text-light">
                  {count}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="nav-mobile-button flex h-9 w-9 items-center justify-center rounded-full border border-border-input bg-bg-card text-text-secondary transition-colors hover:border-primary/70 hover:text-primary"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <CloseIcon className="h-4 w-4" />
              ) : (
                <MenuIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Desktop nav row */}
        <nav
          className="nav-desktop-row hidden items-center justify-between gap-4 md:flex"
          aria-label="Main navigation"
        >
          <ul className="flex flex-wrap items-center gap-1">
            {SHOP_NAV_LINKS.map((link) => {
              const active = isActiveLink(link.href, pathname, activeSection);
              // nav keys are namespaced (e.g. "nav.mithai"); useTranslations
              // takes a namespace, so strip the prefix.
              const label = navT(link.key.replace(/^nav\./, ""));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={[
                      "nav-link relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "nav-link--active text-primary"
                        : "text-text-secondary hover:text-primary",
                    ].join(" ")}
                  >
                    {label}
                    {active && (
                      <span className="absolute inset-x-1.5 -bottom-[1px] h-[2px] rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden items-center gap-2 border-l border-border-card pl-4 lg:flex">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
              {navT("learn")}
            </span>
            <ul className="flex flex-wrap items-center gap-1">
              {STORY_NAV_LINKS.map((link) => {
                const active = isActiveLink(link.href, pathname, activeSection);
                const label = navT(link.key.replace(/^nav\./, ""));
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={[
                        "nav-link relative rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "text-primary"
                          : "text-text-muted hover:text-primary",
                      ].join(" ")}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>

      {/* Mobile overlay */}
      <div
        className={[
          "nav-mobile-overlay md:hidden",
          menuOpen ? "nav-mobile-overlay--open" : "",
        ].join(" ")}
        aria-hidden={!menuOpen}
      >
        <nav className="flex flex-col gap-1 px-4 pb-6 pt-2" aria-label="Mobile navigation">
          <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
            {navT("shop")}
          </p>
          {SHOP_NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href, pathname, activeSection);
            const label = navT(link.key.replace(/^nav\./, ""));
            return (
              <Link
                key={link.href}
                href={link.href}
                // Close the menu when a mobile nav link is tapped. This
                // replaces the old "close on route change" effect so we
                // avoid setState-in-effect cascading-render warnings.
                onClick={() => setMenuOpen(false)}
                className={[
                  "nav-mobile-link rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "nav-mobile-link--active bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-bg-accent/60 hover:text-primary",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}

          <p className="mt-4 px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
            {navT("learn")}
          </p>
          {STORY_NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href, pathname, activeSection);
            const label = navT(link.key.replace(/^nav\./, ""));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={[
                  "nav-mobile-link rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "nav-mobile-link--active bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-bg-accent/60 hover:text-primary",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}

          <div className="mt-4 flex items-center gap-2">
            {showThemeSwitcher ? <ThemeSwitcher className="flex-1" /> : null}
            <select
              className="nav-locale-select flex-1 rounded-xl border border-border-input bg-bg-card px-3 py-2.5 text-xs text-text-secondary"
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              aria-label="Language"
            >
              {AVAILABLE_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/mithai"
            onClick={() => setMenuOpen(false)}
            className="nav-order-button mt-3 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-text-light shadow-sm transition-colors hover:bg-primary-hover"
          >
            {t("orderNow")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
