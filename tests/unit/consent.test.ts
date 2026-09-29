import {describe, it, expect, beforeEach, vi} from "vitest";
import {
  ACCEPT_ALL,
  CONSENT_COOKIE,
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  CONSENT_VERSION,
  ESSENTIAL_ONLY,
  consentSnapshot,
  openConsentPreferences,
  parseConsent,
  readConsent,
  serializeConsent,
  subscribeConsent,
  writeConsent,
} from "@/lib/consent";

const clearCookie = () => {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
};

describe("consent storage", () => {
  beforeEach(clearCookie);

  it("round-trips a choice through serialize and parse", () => {
    const raw = serializeConsent({analytics: true, assistant: false}, 1234);
    expect(parseConsent(raw)).toEqual({v: CONSENT_VERSION, analytics: true, assistant: false, ts: 1234});
  });

  it("rejects missing, malformed, wrong-version and wrong-type values", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("not-json")).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({v: 999, analytics: true, assistant: true})))).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({v: CONSENT_VERSION, analytics: "yes", assistant: true})))).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify(null)))).toBeNull();
  });

  it("returns null when no choice has been made", () => {
    expect(readConsent()).toBeNull();
    expect(consentSnapshot()).toBe("");
  });

  it("writes a cookie, reads it back and announces the change", () => {
    const listener = vi.fn();
    window.addEventListener(CONSENT_EVENT, listener);
    const stored = writeConsent(ACCEPT_ALL);
    window.removeEventListener(CONSENT_EVENT, listener);

    expect(stored).toMatchObject({analytics: true, assistant: true});
    expect(readConsent()).toMatchObject({analytics: true, assistant: true});
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({analytics: true, assistant: true});
  });

  it("essential-only stores both optional categories as off", () => {
    writeConsent(ESSENTIAL_ONLY);
    expect(readConsent()).toMatchObject({analytics: false, assistant: false});
  });

  it("an older stored version is treated as no decision", () => {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({v: 0, analytics: true, assistant: true}))}; Path=/`;
    expect(readConsent()).toBeNull();
  });

  it("subscribe fires on change and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConsent(listener);
    writeConsent(ACCEPT_ALL);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    writeConsent(ESSENTIAL_ONLY);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("openConsentPreferences asks the banner to reopen", () => {
    const listener = vi.fn();
    window.addEventListener(CONSENT_OPEN_EVENT, listener);
    openConsentPreferences();
    window.removeEventListener(CONSENT_OPEN_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
