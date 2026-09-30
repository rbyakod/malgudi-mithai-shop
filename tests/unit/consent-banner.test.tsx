import {describe, it, expect, beforeEach} from "vitest";
import {render, screen, fireEvent, act} from "@testing-library/react";
import {NextIntlClientProvider} from "next-intl";
import {vi} from "vitest";
import messages from "@/messages/en.json";
import {ConsentBanner} from "@/components/consent/ConsentBanner";
import {ConsentPreferencesLink} from "@/components/consent/ConsentPreferencesLink";
import {CONSENT_COOKIE, openConsentPreferences, readConsent, writeConsent} from "@/lib/consent";

vi.mock("@/i18n/navigation", () => ({
  Link: ({href, children, ...rest}: {href: string; children: React.ReactNode}) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const clearCookie = () => {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
};

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ConsentBanner />
      <ConsentPreferencesLink />
    </NextIntlClientProvider>,
  );
}

describe("ConsentBanner", () => {
  beforeEach(clearCookie);

  it("shows on first visit with equal-weight accept and essential-only buttons", () => {
    renderBanner();
    expect(screen.getByRole("dialog", {name: "Your privacy choices"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Accept all"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Essential only"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Choose"})).toBeTruthy();
    expect(readConsent()).toBeNull();
  });

  it("Accept all stores both categories and hides the banner", () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", {name: "Accept all"}));
    expect(readConsent()).toMatchObject({analytics: true, assistant: true});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Essential only stores both categories as off", () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", {name: "Essential only"}));
    expect(readConsent()).toMatchObject({analytics: false, assistant: false});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Choose shows unticked optional categories and saves what the visitor picks", () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", {name: "Choose"}));
    const analytics = screen.getByRole("checkbox", {name: /Analytics/}) as HTMLInputElement;
    const assistant = screen.getByRole("checkbox", {name: /AI assistant/}) as HTMLInputElement;
    const essential = screen.getByRole("checkbox", {name: /Essential/}) as HTMLInputElement;
    expect(analytics.checked).toBe(false);
    expect(assistant.checked).toBe(false);
    expect(essential.checked).toBe(true);
    expect(essential.disabled).toBe(true);

    fireEvent.click(assistant);
    fireEvent.click(screen.getByRole("button", {name: "Save choices"}));
    expect(readConsent()).toMatchObject({analytics: false, assistant: true});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays hidden for a returning visitor who already chose", () => {
    writeConsent({analytics: false, assistant: true});
    renderBanner();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the footer control reopens it with the saved choices, and a change can be saved", () => {
    writeConsent({analytics: true, assistant: false});
    renderBanner();
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole("button", {name: "Privacy choices"}));
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByRole("checkbox", {name: /Analytics/}) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", {name: /AI assistant/}) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole("checkbox", {name: /Analytics/}));
    fireEvent.click(screen.getByRole("button", {name: "Save choices"}));
    expect(readConsent()).toMatchObject({analytics: false, assistant: false});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("links to the privacy policy", () => {
    renderBanner();
    const link = screen.getByRole("link", {name: "Read our privacy policy"}) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/privacy");
  });

  it("asks only about the AI assistant when a visitor tries to chat, and keeps their analytics choice", () => {
    writeConsent({analytics: true, assistant: false});
    renderBanner();
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => openConsentPreferences("assistant"));
    expect(screen.getByRole("dialog", {name: "Allow the AI assistant?"})).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", {name: "Allow AI assistant"}));
    expect(readConsent()).toMatchObject({analytics: true, assistant: true});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Not now: a first-time visitor is recorded as essential only; a returning one is left alone", () => {
    renderBanner();
    act(() => openConsentPreferences("assistant"));
    fireEvent.click(screen.getByRole("button", {name: "Not now"}));
    expect(readConsent()).toMatchObject({analytics: false, assistant: false});
    expect(screen.queryByRole("dialog")).toBeNull();

    clearCookie();
    writeConsent({analytics: true, assistant: false});
    act(() => openConsentPreferences("assistant"));
    fireEvent.click(screen.getByRole("button", {name: "Not now"}));
    expect(readConsent()).toMatchObject({analytics: true, assistant: false});
  });

  it("from the assistant prompt, Choose opens the full list with the assistant ticked for review", () => {
    renderBanner();
    act(() => openConsentPreferences("assistant"));
    fireEvent.click(screen.getByRole("button", {name: "Choose"}));
    expect((screen.getByRole("checkbox", {name: /AI assistant/}) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", {name: /Analytics/}) as HTMLInputElement).checked).toBe(false);
  });
});
