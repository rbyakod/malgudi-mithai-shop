"use client";

import {useTranslations} from "next-intl";
import {useTheme} from "@/context/ThemeContext";

export function SiteFooter() {
  const t = useTranslations("Home");
  const {theme} = useTheme();
  const isHeritage2 = theme === "wedding-heritage";

  return (
    <footer
      className={[
        "site-footer mt-4 w-full border-t border-border-card pt-4 text-xs text-text-muted",
        isHeritage2 ? "site-footer--heritage2" : "",
      ].join(" ").trim()}
    >
      <div className="site-footer__inner flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p>
          © {new Date().getFullYear()} Malgudi Sweets. All rights reserved.
        </p>
        <div className="site-footer__meta flex flex-wrap gap-4">
          <span>{t("footerLocation")}</span>
          <a href="tel:+919876543210" className="hover:text-primary">
            +91-98765-43210
          </a>
          <span className="text-text-muted">Instagram</span>
          <span className="text-text-muted">{t("footerPrivacy")}</span>
        </div>
      </div>
    </footer>
  );
}
