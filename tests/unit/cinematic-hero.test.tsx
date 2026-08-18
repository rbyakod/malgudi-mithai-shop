import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {CinematicHero} from "@/components/home/CinematicHero";
import type {Slide} from "@/lib/home-hero";
import type {StorefrontLayoutMode} from "@/lib/storefront-layout";

// Mock next-intl — bare-key lookup per namespace (Home + HeroRotator are
// the two CinematicHero uses; both reuse existing production keys).
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const dicts: Record<string, Record<string, string>> = {
      Home: {
        heroEyebrow: "Fresh from Bengaluru",
        heroHeadlineLine1: "Sweets that",
        heroSubhead: "Small-batch mithai",
        ctaExploreMithai: "Explore mithai",
        ctaBuildGift: "Build a gift",
      },
      HeroRotator: {
        view: "View",
        addToCart: "Add to cart",
        added: "Added",
        dotLabel: "Go to slide",
        regionLabel: "Featured products",
      },
    };
    if (namespace && dicts[namespace]) {
      return dicts[namespace][key] ?? key;
    }
    return key;
  },
}));

// Mock Link — render as anchor with href prop.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: unknown;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : JSON.stringify(href)} {...(rest as Record<string, string>)}>
      {children}
    </a>
  ),
}));

// Mock useCart
const addItemMock = vi.fn();
vi.mock("@/context/CartContext", () => ({
  useCart: () => ({addItem: addItemMock}),
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

// Mock usePrefersReducedMotion — controllable per test.
let mockReduced = false;
vi.mock("@/components/home/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => mockReduced,
}));

const slides: Slide[] = [
  {
    id: "1",
    collection: "mithai-products",
    name: "Kaju Katli",
    priceLabel: "₹800",
    image: "/kaju.jpg",
    imageAlt: "Kaju Katli",
    href: "/mithai/kaju-katli",
  },
  {
    id: "2",
    collection: "qsr-menu-items",
    name: "Masala Chai",
    priceLabel: undefined,
    image: "/chai.jpg",
    imageAlt: "Chai",
    href: "/qsr/masala-chai",
  },
];

function renderCinematic(
  overrides: Partial<Parameters<typeof CinematicHero>[0]> = {}
) {
  const props: Parameters<typeof CinematicHero>[0] = {
    slides,
    autoplayMs: 5000,
    layoutMode: "fixed" as StorefrontLayoutMode,
    brandName: "Mishran",
    ...overrides,
  };
  return render(<CinematicHero {...props} />);
}

describe("CinematicHero", () => {
  beforeEach(() => {
    mockReduced = false;
    addItemMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when slides is empty", () => {
    const {container} = renderCinematic({slides: []});
    expect(container.firstChild).toBeNull();
  });

  it("renders headline, brand, CTAs, and the active product chip", () => {
    renderCinematic();
    expect(screen.getByText("Sweets that")).toBeVisible();
    expect(screen.getByText("Mishran")).toBeVisible();
    expect(screen.getByText("Explore mithai")).toBeVisible();
    expect(screen.getByText("Build a gift")).toBeVisible();
    // Foot row: active product chip (name + price) + add-to-cart.
    expect(screen.getByText("Kaju Katli")).toBeVisible();
    expect(screen.getByText("₹800")).toBeVisible();
    expect(screen.getByRole("button", {name: "Add to cart"})).toBeVisible();
  });

  it("bleeds to true viewport width in fixed layout mode, cancels padding in full", () => {
    const fixed = renderCinematic({layoutMode: "fixed"});
    const fixedSection = fixed.container.querySelector("section");
    expect(fixedSection?.className).toContain("w-screen");
    fixed.unmount();

    const full = renderCinematic({layoutMode: "full"});
    const fullSection = full.container.querySelector("section");
    expect(fullSection?.className).not.toContain("w-screen");
    expect(fullSection?.className).toContain("lg:-mx-10");
    full.unmount();
  });

  it("dots switch the active slide (product chip follows)", () => {
    renderCinematic();
    // Only one chip is rendered at a time — it shows slide 1 first.
    expect(screen.getByText("Kaju Katli")).toBeVisible();
    fireEvent.click(screen.getByRole("button", {name: "Go to slide 2"}));
    expect(screen.getByText("Masala Chai")).toBeVisible();
    // Slide 2 has no priceLabel → no price node in the chip.
    expect(screen.queryByText("₹800")).toBeNull();
    expect(
      screen.getByRole("button", {name: "Go to slide 2"}).getAttribute("aria-current")
    ).toBe("true");
  });

  it("add-to-cart sends the slide payload to the cart context", () => {
    renderCinematic();
    fireEvent.click(screen.getByRole("button", {name: "Add to cart"}));
    expect(addItemMock).toHaveBeenCalledWith({
      id: "1",
      name: "Kaju Katli",
      priceLabel: "₹800",
      image: "/kaju.jpg",
    });
  });
});
