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
      <header className="ms-head ms-hub-head">
        <p className="ms-label ms-muted">{t("eyebrow")}</p>
        <h1 id="account-heading" className="ms-headline">{t("title")}</h1>
        <p className="ms-lead">{t("blurb")}</p>
      </header>
      <AccountView />
    </section>
  );
}
