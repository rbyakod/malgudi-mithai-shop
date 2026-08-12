import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, act} from "@testing-library/react";
import {HeroRotator} from "@/components/home/HeroRotator";
import type {Slide} from "@/lib/home-hero";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      "HeroRotator.view": "View",
      "HeroRotator.addToCart": "Add to cart",
      "HeroRotator.added": "Added",
      "HeroRotator.previous": "Previous slide",
      "HeroRotator.next": "Next slide",
      "HeroRotator.dotLabel": "Go to slide",
      "HeroRotator.regionLabel": "Featured products",
    };
    return dict[key] ?? key;
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
    const btns = screen.getAllByRole("button", {name: /Add to cart/i});
    fireEvent.click(btns[0]);
    expect(addItemMock).toHaveBeenCalledWith({
      id: "1",
      name: "Kaju Katli",
      priceLabel: "₹800",
      image: "/kaju.jpg",
    });
  });

  it("View link points to PDP href", () => {
    render(<HeroRotator slides={slides} />);
    const viewLinks = screen.getAllByRole("link", {name: /^View$/i});
    expect(viewLinks[0]).toHaveAttribute("href", "/mithai/kaju-katli");
  });
});
