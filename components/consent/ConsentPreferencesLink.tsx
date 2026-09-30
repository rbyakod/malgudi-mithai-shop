// components/consent/ConsentPreferencesLink.tsx
// Footer control that reopens the consent banner so a visitor can change or withdraw a choice.
"use client";

import {useTranslations} from "next-intl";
import {openConsentPreferences} from "@/lib/consent";

export function ConsentPreferencesLink({className}: {className?: string}) {
  const t = useTranslations("Consent");
  return (
    <button type="button" onClick={() => openConsentPreferences()} className={className}>
      {t("manage")}
    </button>
  );
}
