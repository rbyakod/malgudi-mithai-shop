"use client";

import {useState, useEffect, useCallback, useRef} from "react";
import {useTranslations, useLocale} from "next-intl";
import {Link, usePathname, useRouter} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {useTheme} from "@/context/ThemeContext";
import {ThemeSwitcher} from "@/components/ThemeSwitcher";

const AVAILABLE_LOCALES = [
  {code: "en", label: "English"},
  {code: "es", label: "Español"},
  {code: "fr", label: "Français"},
  {code: "hi", label: "हिन्दी"},
  {code: "kn", label: "ಕನ್ನಡ"},
  {code: "ta", label: "தமிழ்"},
  {code: "te", label: "తెలుగు"},
  {code: "bn", label: "বাংলা"},
  {code: "mr", label: "मराठी"},
  {code: "gu", label: "ગુજરાતী"}
];

const NAV_LINKS = [
  {href: "/#menu", key: "menu"},
  {href: "/sweets", key: "allSweets"},
  {href: "/#occasions", key: "occasions"},
  {href: "/#corporate", key: "corporate"}
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

/* ---- Scroll-spy for homepage hash anchors ---- */

// Maps nav href → section DOM id
const HASH_SECTION_MAP: Record<string, string> = {
  "/#menu": "menu",
  "/#occasions": "occasions",
  "/#corporate": "corporate",
};

function useActiveSection(pathname: string): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Only run scroll-spy on the homepage
    if (pathname !== "/") {
      setActiveId(null);
      return;
    }

    const sectionIds = Object.values(HASH_SECTION_MAP);
    const visible = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        // Pick the section with the highest visibility
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
        // Root margin accounts for sticky header height (~120px)
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
  // Page routes (e.g. /sweets) match by path prefix
  if (!linkHref.startsWith("/#")) {
    const base = linkHref.split("#")[0];
    return base !== "/" && pathname.startsWith(base);
  }
  // Hash anchors light up when their section is in view on the homepage
  if (pathname !== "/") return false;
  const sectionId = HASH_SECTION_MAP[linkHref];
  return sectionId != null && sectionId === activeSection;
}

/* ---- Component ---- */

export function Header() {
  const {count} = useCart();
  const {theme} = useTheme();
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useActiveSection(pathname);
  const isHeritage2 = theme === "heritage-2";

  useEffect(() => {
    const threshold = 40;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, {passive: true});
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      if (nextLocale === locale) return;
      router.replace(pathname, {locale: nextLocale});
    },
    [locale, pathname, router]
  );

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={["nav-header", isHeritage2 ? "nav-header--heritage2" : ""].join(" ").trim()}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Top bar — always visible */}
        <div className="nav-top-bar">
          <Link href="/#top" className="flex items-center gap-2.5">
            <div className="nav-logo-mark">MS</div>
            <div>
              <p className="nav-brand-title text-sm font-semibold tracking-wide text-primary">
                MALGUDI SWEETS
              </p>
              <p
                className="nav-tagline text-xs text-text-muted"
              >
                {t("tagline")}
              </p>
            </div>
          </Link>

          {/* Desktop right section */}
          <div className="hidden items-center gap-2.5 md:flex">
            <ThemeSwitcher />

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
              href="/sweets"
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
          className="nav-desktop-row hidden items-center justify-between md:flex"
          aria-label="Main navigation"
        >
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = isActiveLink(link.href, pathname, activeSection);
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
                    {t(link.key)}
                    {active && (
                      <span className="absolute inset-x-1.5 -bottom-[1px] h-[2px] rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
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
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href, pathname, activeSection);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "nav-mobile-link rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "nav-mobile-link--active bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-bg-accent/60 hover:text-primary",
                ].join(" ")}
              >
                {t(link.key)}
              </Link>
            );
          })}

          <div className="mt-4 flex items-center gap-2">
            <ThemeSwitcher className="flex-1" />
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
            href="/sweets"
            className="nav-order-button mt-3 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-text-light shadow-sm transition-colors hover:bg-primary-hover"
          >
            {t("orderNow")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
