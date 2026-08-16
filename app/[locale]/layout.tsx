// app/[locale]/layout.tsx
import type {Metadata, Viewport} from "next";
import type {ReactNode} from "react";
import {NextIntlClientProvider} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {buildAlternates} from "@/lib/seo";
import {BrandBar} from "@/components/layout/BrandBar";
import {SiteHeader} from "@/components/layout/SiteHeader";
import {SiteFooter} from "@/components/layout/SiteFooter";
import {isFullWidthLayout} from "@/lib/storefront-layout";
import {
  readStorefrontLayoutMode,
  readThemeSwitcherVisibility,
} from "@/lib/storefront-layout-server";

// Static rendering: enumerate the locales so every [locale] route below can
// be prerendered. Without this, dynamic child segments (e.g. mithai/[slug])
// can never resolve a full path — generateStaticParams on the child alone
// produces zero pages, and on-demand renders of the SSG-marked route bail
// out with DYNAMIC_SERVER_USAGE → 500.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

// ISR for every [locale] route: the layout's BrandBar + SiteFooter read
// Payload globals (analytics-settings.whatsappNumber etc.) server-side;
// without this, fully-static children bake those values at build time and
// admin edits never surface until the next deploy. 60s matches the
// convention already used by stories/merch/qsr pages.
export const revalidate = 60;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type Props = {
  children: ReactNode;
  params: Promise<{locale: string}>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return {
    alternates: buildAlternates(""),
    other: {"og:locale": locale},
  };
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Enables static rendering for this layout and everything below it
  // (next-intl resolves the locale from params instead of the request).
  setRequestLocale(locale);

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const [layoutMode, themeSwitcherVisibility] = await Promise.all([
    readStorefrontLayoutMode(),
    readThemeSwitcherVisibility(),
  ]);
  const mainClassName = [
    "mx-auto w-full flex-1 px-4 pb-16 pt-4 sm:px-6",
    isFullWidthLayout(layoutMode) ? "max-w-none lg:px-10 2xl:px-14" : "max-w-6xl lg:px-8",
  ].join(" ");

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* Layout shell — BrandBar (server, reads Payload) + SiteHeader (client,
          owns theme/locale/cart UI) + main content + SiteFooter (server). */}
      <div className="relative z-10 flex min-h-screen flex-col text-text-primary">
        <BrandBar layoutMode={layoutMode} />
        <SiteHeader
          layoutMode={layoutMode}
          themeSwitcherVisibility={themeSwitcherVisibility}
        />
        <main id="main-content" className={mainClassName}>
          {children}
        </main>
        <SiteFooter layoutMode={layoutMode} />
      </div>
    </NextIntlClientProvider>
  );
}
