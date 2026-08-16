// app/[locale]/sign-in/page.tsx
// Sign-in — phone + OTP. Server shell (masthead) wrapping the
// <SignInForm /> client island. noindex: an auth wall has no search intent.
// Deep-link support: /sign-in?next=/checkout returns there after sign-in.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {SignInForm} from "@/components/auth/SignInForm";

type Props = {
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  title: "Sign in",
  robots: {index: false, follow: false},
};

export default async function SignInPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  const t = await getTranslations("SignIn");

  return (
    <section
      aria-labelledby="sign-in-heading"
      className="mx-auto w-full max-w-lg flex-1 pb-20 pt-10 sm:pt-14"
    >
      <header className="border-b border-border-card pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("eyebrow")}
        </p>
        <h1
          id="sign-in-heading"
          className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
          {t("blurb")}
        </p>
      </header>
      <div className="mt-10">
        <SignInForm />
      </div>
    </section>
  );
}
