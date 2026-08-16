// app/[locale]/account/page.tsx
// Account — the signed-in customer home. Server shell (masthead) wrapping
// the <AccountView /> client island (profile + sign-out, address book with
// serviceability badges, recent orders). noindex: personal pages have no
// search intent. Signed-out visitors see a sign-in prompt with a deep link
// back to /account.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {AccountView} from "@/components/account/AccountView";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Account",
  robots: {index: false, follow: false},
};

export default async function AccountPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("Account");

  return (
    <section
      aria-labelledby="account-heading"
      className="mx-auto w-full max-w-4xl flex-1 pb-20 pt-10 sm:pt-14"
    >
      <header className="grid gap-6 border-b border-border-card pb-10 lg:grid-cols-[0.45fr_0.55fr] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {t("eyebrow")}
          </p>
          <h1
            id="account-heading"
            className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
          >
            {t("title")}
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          {t("blurb")}
        </p>
      </header>
      <AccountView />
    </section>
  );
}
