// app/[locale]/corporate/page.tsx
// Corporate & bulk orders lead capture. Server component that lays out
// the editorial masthead (eyebrow / display-serif title / blurb) and
// hands the body to <CorporateConfigurator /> — a client component that
// owns the form, TanStack mutation, and toast.

import {getTranslations} from "next-intl/server";
import {CorporateConfigurator} from "@/components/ledger/CorporateConfigurator";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CorporatePage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Leads.corporate");

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8"
    >
      <header className="space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-muted sm:text-base">
          {t("intro")}
        </p>
      </header>

      <CorporateConfigurator />
    </main>
  );
}
