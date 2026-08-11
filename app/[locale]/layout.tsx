// app/[locale]/layout.tsx
import type {Metadata, Viewport} from "next";
import type {ReactNode} from "react";
import {NextIntlClientProvider} from "next-intl";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {buildAlternates} from "@/lib/seo";
import {BrandBar} from "@/components/layout/BrandBar";
import {SiteHeader} from "@/components/layout/SiteHeader";
import {SiteFooter} from "@/components/layout/SiteFooter";

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

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* Layout shell — BrandBar (server, reads Payload) + SiteHeader (client,
          owns theme/locale/cart UI) + main content + SiteFooter (server). */}
      <div className="relative z-10 flex min-h-screen flex-col text-text-primary">
        <BrandBar />
        <SiteHeader />
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          {children}
        </main>
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
