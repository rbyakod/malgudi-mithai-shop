import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, act} from "@testing-library/react";
import {HeroRotator} from "@/components/home/HeroRotator";
import type {Slide} from "@/lib/home-hero";

// Mock next-intl — simulate useTranslations("HeroRotator") returning a
// function that looks up bare keys inside the HeroRotator namespace.
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const dicts: Record<string, Record<string, string>> = {
      HeroRotator: {
        view: "View",
        addToCart: "Add to cart",
        added: "Added",
        previous: "Previous slide",
        next: "Next slide",
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

describe("HeroRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReduced = false;
    addItemMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when slides is empty", () => {
    const {container} = render(<HeroRotator slides={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders first slide on mount", () => {
    render(<HeroRotator slides={slides} />);
    expect(screen.getByText("Kaju Katli")).toBeVisible();
    expect(screen.getByText("₹800")).toBeVisible();
    // Second slide content present in DOM but visually hidden via CSS class.
    expect(screen.getByText("Masala Chai")).toBeInTheDocument();
  });

  it("hides price when priceLabel is undefined", () => {
    render(<HeroRotator slides={slides} />);
    // Slide 2 has no price. After advancing, price should not render.
    expect(screen.getAllByText("₹800").length).toBe(1);
  });

  it("advances to next slide every 5 seconds", () => {
    render(<HeroRotator slides={slides} />);
    // Slide 1 active
    expect(screen.getByText("Kaju Katli")).toBeVisible();
    // Advance 5s
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Now slide 2 should be the visible one — check via aria-current on dot
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("wraps from last slide back to first", () => {
    render(<HeroRotator slides={slides} />);
    act(() => {
      vi.advanceTimersByTime(5000); // 0 -> 1
    });
    act(() => {
      vi.advanceTimersByTime(5000); // 1 -> 0
    });
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("pauses autoplay on mouse enter and resumes on mouse leave", () => {
    render(<HeroRotator slides={slides} />);
    const region = screen.getByRole("group", {name: /featured products/i});

    fireEvent.mouseEnter(region);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    // Should not have advanced
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[0]).toHaveAttribute("aria-current", "true");

    fireEvent.mouseLeave(region);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("respects prefers-reduced-motion: no autoplay", () => {
    mockReduced = true;
    render(<HeroRotator slides={slides} />);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("clicking Next advances to next slide", () => {
    render(<HeroRotator slides={slides} />);
    fireEvent.click(screen.getByRole("button", {name: /Next slide/i}));
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking Previous wraps from first to last", () => {
    render(<HeroRotator slides={slides} />);
    fireEvent.click(screen.getByRole("button", {name: /Previous slide/i}));
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking dot jumps to that slide", () => {
    render(<HeroRotator slides={slides} />);
    const dots = screen.getAllByRole("button", {name: /Go to slide/i});
    fireEvent.click(dots[1]);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking Add to cart calls addItem with slide shape", () => {
    render(<HeroRotator slides={slides} />);
    // Only the active slide's button is exposed; inert hides the rest.
    const btn = screen.getByRole("button", {name: /Add to cart/i});
    fireEvent.click(btn);
    expect(addItemMock).toHaveBeenCalledWith({
      id: "1",
      name: "Kaju Katli",
      priceLabel: "₹800",
      image: "/kaju.jpg",
    });
  });

  it("View link points to PDP href", () => {
    render(<HeroRotator slides={slides} />);
    const viewLink = screen.getByRole("link", {name: /^View$/i});
    expect(viewLink).toHaveAttribute("href", "/mithai/kaju-katli");
  });

  it("inert hides inactive slides' View + Add buttons from the accessibility tree", () => {
    render(<HeroRotator slides={slides} />);
    // Only one View link + one Add to cart button visible (the active slide's).
    expect(screen.getAllByRole("link", {name: /^View$/i})).toHaveLength(1);
    expect(screen.getAllByRole("button", {name: /Add to cart/i})).toHaveLength(1);
  });

  it("honors autoplayMs prop over default 5000ms", () => {
    render(<HeroRotator slides={slides} autoplayMs={3000} />);
    // Slide 1 active
    const dotsBefore = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dotsBefore[0]).toHaveAttribute("aria-current", "true");
    // Advance only 3s — should already have moved
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const dotsAfter = screen.getAllByRole("button", {name: /Go to slide/i});
    expect(dotsAfter[1]).toHaveAttribute("aria-current", "true");
  });
});
