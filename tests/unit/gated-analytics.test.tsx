import {describe, it, expect, beforeEach, vi} from "vitest";
import {render, act} from "@testing-library/react";
import {GatedAnalytics} from "@/components/Analytics/GatedAnalytics";
import {CONSENT_COOKIE, writeConsent} from "@/lib/consent";

// next/script renders nothing useful in jsdom; expose each script so tests can see what would load.
vi.mock("next/script", () => ({
  default: ({id, src, children}: {id?: string; src?: string; children?: string}) => (
    <script data-testid={id ?? src} data-src={src}>{children}</script>
  ),
}));

// The page the visit is on; tests set it to check pages that must never be recorded.
const nav = vi.hoisted(() => ({path: null as string | null}));
vi.mock("next/navigation", () => ({usePathname: () => nav.path}));

const clearCookie = () => {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
};

describe("GatedAnalytics", () => {
  beforeEach(() => {
    nav.path = null;
    document.body.removeAttribute("data-hj-suppress");
    clearCookie();
    delete (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"];
    delete (window as unknown as Record<string, unknown>).fbq;
  });

  it("loads nothing before the visitor chooses", () => {
    const {container} = render(<GatedAnalytics ga4Id="G-TEST" pixelId="123" />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("loads nothing after Essential only, and keeps an already-loaded tag silent", () => {
    writeConsent({analytics: false, assistant: true});
    const fbq = vi.fn();
    (window as unknown as Record<string, unknown>).fbq = fbq;
    const {container} = render(<GatedAnalytics ga4Id="G-TEST" pixelId="123" />);
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
    expect(fbq).toHaveBeenCalledWith("consent", "revoke");
  });

  it("loads GA4 and the Pixel once analytics is accepted", () => {
    writeConsent({analytics: true, assistant: false});
    const {getByTestId} = render(<GatedAnalytics ga4Id="G-TEST" pixelId="123" />);
    expect(getByTestId("https://www.googletagmanager.com/gtag/js?id=G-TEST")).toBeTruthy();
    const ga = getByTestId("ga4-init").textContent ?? "";
    expect(ga).toContain("gtag('config', 'G-TEST')");
    expect(ga).toContain("window.dataLayer.length = 0");
    const pixel = getByTestId("meta-pixel-init").textContent ?? "";
    expect(pixel).toContain("fbq('init', '123')");
    expect(pixel).toContain("fbq('consent', 'grant')");
  });

  describe("Hotjar", () => {
    it("loads nothing before consent, and nothing when the id is missing or not a number", () => {
      const {container, rerender} = render(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
      expect(container.querySelector("script")).toBeNull();
      writeConsent({analytics: true, assistant: false});
      rerender(<GatedAnalytics ga4Id="" pixelId="" hotjarId="not-a-number" />);
      expect(container.querySelector('script[data-testid="hotjar-init"]')).toBeNull();
      rerender(<GatedAnalytics ga4Id="" pixelId="" />);
      expect(container.querySelector('script[data-testid="hotjar-init"]')).toBeNull();
    });

    it("stays off when the visitor chose Essential only", () => {
      writeConsent({analytics: false, assistant: true});
      const {container} = render(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
      expect(container.querySelector('script[data-testid="hotjar-init"]')).toBeNull();
    });

    it("never starts on a checkout or account page, even with consent", () => {
      writeConsent({analytics: true, assistant: false});
      for (const path of ["/en/checkout", "/hi/account", "/sign-in"]) {
        nav.path = path;
        const {container, unmount} = render(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
        expect(container.querySelector('script[data-testid="hotjar-init"]')).toBeNull();
        unmount();
      }
    });

    it("hides the page content from recordings if the visitor moves to checkout after it started", () => {
      writeConsent({analytics: true, assistant: false});
      nav.path = "/en/mithai";
      const {rerender, container} = render(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
      expect(container.querySelector('script[data-testid="hotjar-init"]')).not.toBeNull();
      expect(document.body.hasAttribute("data-hj-suppress")).toBe(false);
      nav.path = "/en/checkout";
      rerender(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
      expect(document.body.hasAttribute("data-hj-suppress")).toBe(true);
      nav.path = "/en/mithai";
      rerender(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
      expect(document.body.hasAttribute("data-hj-suppress")).toBe(false);
    });

    it("loads with the validated id once analytics is accepted", () => {
      writeConsent({analytics: true, assistant: false});
      const {getByTestId} = render(<GatedAnalytics ga4Id="" pixelId="" hotjarId="1234567" />);
      expect(getByTestId("hotjar-init").textContent).toContain("hjid:1234567,hjsv:6");
    });
  });

  it("starts loading when the visitor accepts after the page rendered", () => {
    const {container} = render(<GatedAnalytics ga4Id="G-TEST" pixelId="" />);
    expect(container.querySelector("script")).toBeNull();
    act(() => {
      writeConsent({analytics: true, assistant: true});
    });
    expect(container.querySelector('script[data-testid="ga4-init"]')).not.toBeNull();
    expect(container.querySelector('script[data-testid="meta-pixel-init"]')).toBeNull();
  });
});
