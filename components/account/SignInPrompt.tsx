"use client";

// components/account/SignInPrompt.tsx
// Shared signed-out card for customer surfaces (account, track order, and
// later checkout). Links to /sign-in with a `next` deep link so the customer
// lands back where they started after verifying.

import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";

type Props = {
  next: string;
};

export function SignInPrompt({next}: Props) {
  const t = useTranslations("Account");

  return (
    <div className="ms-panel ms-panel--line ms-stack">
      <p className="text-sm italic leading-relaxed text-text-muted">
        {t("signInPrompt")}
      </p>
      <Link
        href={{pathname: "/sign-in", query: {next}}}
        data-testid="sign-in-cta"
        className="mt-5 inline-flex items-center gap-3 border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent"
      >
        {t("signInCta")}
        <span aria-hidden="true" className="text-gold">
          →
        </span>
      </Link>
    </div>
  );
}

export default SignInPrompt;
