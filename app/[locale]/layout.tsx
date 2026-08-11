// app/[locale]/layout.tsx
import type {Metadata} from "next";
import type {ReactNode} from "react";
import {NextIntlClientProvider} from "next-intl";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {buildAlternates} from "@/lib/seo";

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
      {children}
    </NextIntlClientProvider>
  );
}