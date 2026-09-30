// components/consent/ConsentBanner.tsx
// Sitewide consent banner (DPDP-aligned). Optional storage and third-party scripts stay off until
// the visitor chooses. "Accept all" and "Essential only" have equal weight, nothing is pre-ticked,
// and the choice can be reopened from the footer. See lib/consent.ts for the storage contract.
"use client";

import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {
  ACCEPT_ALL,
  CONSENT_OPEN_EVENT,
  ESSENTIAL_ONLY,
  consentSnapshot,
  parseConsent,
  subscribeConsent,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent";

const buttonBase =
  "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const buttonPrimary = `${buttonBase} border border-primary bg-primary text-text-light hover:bg-primary-hover`;
const buttonSecondary = `${buttonBase} border border-border-input bg-bg-control text-text-primary hover:bg-bg-accent`;

export function ConsentBanner() {
  const t = useTranslations("Consent");
  // null = server render and first client render (unknown), so hydration never mismatches.
  const raw = useSyncExternalStore<string | null>(subscribeConsent, consentSnapshot, () => null);
  const stored = raw === null ? null : parseConsent(raw);
  const [reopened, setReopened] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ConsentChoice>(ESSENTIAL_ONLY);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const current = parseConsent(consentSnapshot());
      setDraft(current ? {analytics: current.analytics, assistant: current.assistant} : ESSENTIAL_ONLY);
      // A visitor who tried to chat only needs the assistant question, not the whole preferences panel.
      const reason = (event as CustomEvent<{reason?: string}>).detail?.reason;
      setAssistantPrompt(reason === "assistant");
      setExpanded(reason !== "assistant");
      setReopened(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  // Reopened from the footer: move focus into the dialog so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (reopened) titleRef.current?.focus();
  }, [reopened]);

  if (raw === null) return null;
  if (stored && !reopened) return null;

  const save = (choice: ConsentChoice) => {
    writeConsent(choice);
    setReopened(false);
    setExpanded(false);
    setAssistantPrompt(false);
  };
  const current = stored ? {analytics: stored.analytics, assistant: stored.assistant} : ESSENTIAL_ONLY;
  // "Not now": keep whatever was chosen before; a first-time visitor who declines is recorded as essential only.
  const declineAssistant = () => (stored ? (setReopened(false), setAssistantPrompt(false), setExpanded(false)) : save(ESSENTIAL_ONLY));

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      data-testid="consent-banner"
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:p-0"
    >
      <div className="max-h-[85dvh] overflow-y-auto rounded-2xl border border-border-card bg-bg-card p-4 text-text-primary shadow-2xl">
        <h2 id="consent-title" ref={titleRef} tabIndex={-1} className="font-display text-lg font-semibold text-text-heading outline-none">
          {assistantPrompt ? t("assistantPromptTitle") : t("title")}
        </h2>
        <p id="consent-desc" className="mt-1 text-sm text-text-secondary">
          {assistantPrompt ? t("assistantPromptBody") : t("description")}{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-text-primary">
            {t("privacyLink")}
          </Link>
        </p>

        {assistantPrompt ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonPrimary} onClick={() => save({...current, assistant: true})}>
              {t("allowAssistant")}
            </button>
            <button type="button" className={buttonSecondary} onClick={declineAssistant}>
              {t("notNow")}
            </button>
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => {
                setDraft({...current, assistant: true});
                setAssistantPrompt(false);
                setExpanded(true);
              }}
            >
              {t("choose")}
            </button>
          </div>
        ) : expanded ? (
          <fieldset className="mt-3 space-y-3">
            <legend className="sr-only">{t("categoriesLabel")}</legend>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="mt-1 size-4 accent-primary" />
              <span>
                <span className="block font-semibold">{t("essentialTitle")}</span>
                <span className="block text-text-secondary">{t("essentialBody")}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.analytics}
                onChange={(e) => setDraft({...draft, analytics: e.target.checked})}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block font-semibold">{t("analyticsTitle")}</span>
                <span className="block text-text-secondary">{t("analyticsBody")}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.assistant}
                onChange={(e) => setDraft({...draft, assistant: e.target.checked})}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block font-semibold">{t("assistantTitle")}</span>
                <span className="block text-text-secondary">{t("assistantBody")}</span>
              </span>
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" className={buttonPrimary} onClick={() => save(draft)}>
                {t("save")}
              </button>
              <button type="button" className={buttonSecondary} onClick={() => save(ESSENTIAL_ONLY)}>
                {t("essentialOnly")}
              </button>
            </div>
          </fieldset>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonPrimary} onClick={() => save(ACCEPT_ALL)}>
              {t("acceptAll")}
            </button>
            <button type="button" className={buttonSecondary} onClick={() => save(ESSENTIAL_ONLY)}>
              {t("essentialOnly")}
            </button>
            <button type="button" className={buttonSecondary} onClick={() => setExpanded(true)}>
              {t("choose")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
