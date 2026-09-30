// lib/consent.ts
// Visitor consent for optional storage and third-party scripts (DPDP-aligned).
//
// Categories:
//   essential  - always on (cart, sign-in, language, theme); not stored here
//   analytics  - Google Analytics 4 and Meta Pixel
//   assistant  - the AI assistant chat (stores a private visitor id and the conversation)
//
// The choice lives in one first-party cookie, `mishran_consent`, so it survives across tabs and can
// be read by any script without a framework. Other scripts (the AI assistant widget) follow this
// public contract and need no import from this file:
//   - cookie  mishran_consent = encodeURIComponent(JSON.stringify({v, analytics, assistant, ts}))
//   - event   window "mishran:consent"  (detail = the stored choice) fires after every change
//   - event   window "mishran:consent-open"  asks the banner to reopen the preferences
//             (detail.reason = "assistant" when a visitor tried to chat without allowing the assistant)
//
// Nothing here runs on the server: every function is a safe no-op without `document`.

export const CONSENT_COOKIE = "mishran_consent";
export const CONSENT_EVENT = "mishran:consent";
export const CONSENT_OPEN_EVENT = "mishran:consent-open";
// Bump when categories change so returning visitors are asked again.
export const CONSENT_VERSION = 1;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type ConsentChoice = {analytics: boolean; assistant: boolean};
export type StoredConsent = ConsentChoice & {v: number; ts: number};

export const ESSENTIAL_ONLY: ConsentChoice = {analytics: false, assistant: false};
export const ACCEPT_ALL: ConsentChoice = {analytics: true, assistant: true};

// Returns null for missing, malformed or out-of-date (older version) values.
export function parseConsent(raw: string | null | undefined): StoredConsent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<StoredConsent> | null;
    if (!value || typeof value !== "object") return null;
    if (value.v !== CONSENT_VERSION) return null;
    if (typeof value.analytics !== "boolean" || typeof value.assistant !== "boolean") return null;
    return {
      v: CONSENT_VERSION,
      analytics: value.analytics,
      assistant: value.assistant,
      ts: typeof value.ts === "number" ? value.ts : 0,
    };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice, now: number = Date.now()): string {
  const stored: StoredConsent = {v: CONSENT_VERSION, analytics: choice.analytics, assistant: choice.assistant, ts: now};
  return encodeURIComponent(JSON.stringify(stored));
}

export function readConsent(): StoredConsent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match ? match.slice(CONSENT_COOKIE.length + 1) : null);
}

export function writeConsent(choice: ConsentChoice): StoredConsent {
  const stored = parseConsent(serializeConsent(choice)) as StoredConsent;
  if (typeof document === "undefined") return stored;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(choice, stored.ts)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<StoredConsent>(CONSENT_EVENT, {detail: stored}));
  return stored;
}

export function subscribeConsent(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_EVENT, listener);
  // Other tabs change the cookie without an event; re-check when this tab regains focus.
  window.addEventListener("focus", listener);
  return () => {
    window.removeEventListener(CONSENT_EVENT, listener);
    window.removeEventListener("focus", listener);
  };
}

// Stable snapshot for useSyncExternalStore: the raw cookie string, so equal choices compare equal.
export function consentSnapshot(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return match ? match.slice(CONSENT_COOKIE.length + 1) : "";
}

// `reason` (optional) says why it was opened: "assistant" means a visitor tried to use the AI assistant
// and needs to allow it first; the banner then asks only that question.
export function openConsentPreferences(reason?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT, {detail: reason ? {reason} : {}}));
}
