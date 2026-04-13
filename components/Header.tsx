"use client";

import {useTranslations, useLocale} from "next-intl";
import {Link, usePathname, useRouter} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
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
  {code: "gu", label: "ગુજરાતી"}
];

const NAV_LINKS = [
  {href: "/#menu", key: "menu"},
  {href: "/sweets", key: "allSweets"},
  {href: "/#occasions", key: "occasions"},
  {href: "/#corporate", key: "corporate"}
] as const;

export function Header() {
  const {count} = useCart();
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) return;
    router.replace(pathname, {locale: nextLocale});
  };

  return (
    <header className="sticky top-0 z-20 mb-6 bg-bg-page/80 backdrop-blur">
      <div className="mx-auto max-w-6xl border-b border-border-card px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <Link href="/#top" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-text-light shadow-sm">
                MS
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-primary">
                  MALGUDI SWEETS
                </p>
                <p className="text-xs text-text-muted">
                  {t("tagline")}
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-3 md:flex">
              <ThemeSwitcher />
              <Link
                href="/cart"
                className="relative flex items-center gap-2 rounded-full border border-border-input bg-bg-card px-3 py-2 text-xs hover:border-primary/70"
              >
                <span>{t("cart")}</span>
                {count > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-text-light">
                    {count}
                  </span>
                )}
              </Link>
              <select
                className="rounded-full border border-border-input bg-bg-card px-3 py-2 text-xs text-text-secondary"
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
              >
                {AVAILABLE_LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden items-center justify-between gap-4 md:flex">
            <nav className="flex items-center gap-4 text-sm font-medium text-text-secondary">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-primary">
                  {t(link.key)}
                </Link>
              ))}
            </nav>

            <Link
              href="/sweets"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-text-light shadow-sm transition hover:bg-primary-hover"
            >
              {t("orderNow")}
            </Link>
          </div>

          <div className="space-y-3 md:hidden">
            <ThemeSwitcher className="w-full" />

            <div className="flex items-center gap-2">
              <Link
                href="/cart"
                className="relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-border-input bg-bg-card px-3 py-2 text-xs hover:border-primary/70"
              >
                <span>{t("cart")}</span>
                {count > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-text-light">
                    {count}
                  </span>
                )}
              </Link>

              <select
                className="min-w-[7rem] rounded-full border border-border-input bg-bg-card px-3 py-2 text-xs text-text-secondary"
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
              >
                {AVAILABLE_LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <nav className="flex flex-wrap gap-2 text-xs font-medium text-text-secondary">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-border-input bg-bg-card px-3 py-2 hover:border-primary/70 hover:text-primary"
                >
                  {t(link.key)}
                </Link>
              ))}
              <Link
                href="/sweets"
                className="inline-block rounded-full bg-primary px-4 py-2 font-semibold text-text-light shadow-sm transition hover:bg-primary-hover"
              >
                {t("orderNow")}
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
