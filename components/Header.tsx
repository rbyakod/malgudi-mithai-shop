"use client";

import {useTranslations, useLocale} from "next-intl";
import {usePathname, useRouter} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";

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
    <header className="sticky top-0 z-20 mb-6 bg-[#fdf7f0]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between border-b border-[#f0d7bf] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b94b4b] text-sm font-semibold text-[#fdf7f0]">
            MS
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-[#b94b4b]">
              MALGUDI SWEETS
            </p>
            <p className="text-xs text-[#7a4f42]">
              {t("tagline")}
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-4 text-sm font-medium text-[#5c372c] md:flex">
          <a href="/#menu" className="hover:text-[#b94b4b]">
            {t("menu")}
          </a>
          <a href="/sweets" className="hover:text-[#b94b4b]">
            {t("allSweets")}
          </a>
          <a href="/#occasions" className="hover:text-[#b94b4b]">
            {t("occasions")}
          </a>
          <a href="/#corporate" className="hover:text-[#b94b4b]">
            {t("corporate")}
          </a>
          <button className="rounded-full bg-[#b94b4b] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#fdf7f0] shadow-sm transition hover:bg-[#a23f3f]">
            {t("orderNow")}
          </button>
          <a
            href="/cart"
            className="relative flex items-center gap-2 rounded-full border border-[#e5cbb2] bg-[#fefaf5] px-3 py-1.5 text-xs hover:border-[#b94b4b]/70"
          >
            <span>{t("cart")}</span>
            {count > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#b94b4b] text-[10px] font-semibold text-[#fdf7f0]">
                {count}
              </span>
            )}
          </a>
          <select
            className="rounded-full border border-[#e5cbb2] bg-[#fefaf5] px-2 py-1 text-xs text-[#5c372c]"
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
          >
            {AVAILABLE_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </nav>
      </div>
    </header>
  );
}