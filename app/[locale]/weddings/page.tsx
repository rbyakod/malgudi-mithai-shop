// app/[locale]/weddings/page.tsx
// Weddings & bulk gifting lead capture. Server component that lays out
// the editorial masthead (eyebrow / display-serif title / blurb) and
// hands the body of the page to <WeddingConfigurator /> — a client
// component that owns the form, TanStack mutation, and toast.

import {getTranslations} from "next-intl/server";
import {WeddingConfigurator} from "@/components/ledger/WeddingConfigurator";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function WeddingPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Leads.weddings");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <header className="ms-head ms-hub-head">
        <p className="ms-label ms-muted">{t("eyebrow")}</p>
        <h1 className="ms-headline">{t("title")}</h1>
        <p className="ms-lead">{t("intro")}</p>
      </header>

      <WeddingConfigurator />
    </div>
  );
}
