import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, act} from "@testing-library/react";
import {usePrefersReducedMotion} from "@/components/home/use-prefers-reduced-motion";

describe("usePrefersReducedMotion", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns false during initial render (SSR-safe)", () => {
    (globalThis.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const {result} = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("subscribes to changes and flips to true when matchMedia fires", () => {
    let listener: ((e: {matches: boolean}) => void) | null = null;
    (globalThis.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
      addEventListener: vi.fn((_: string, cb: (e: {matches: boolean}) => void) => { listener = cb; }),
      removeEventListener: vi.fn(),
    });
    const {result} = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      listener?.({matches: true});
    });
    expect(result.current).toBe(true);

    act(() => {
      listener?.({matches: false});
    });
    expect(result.current).toBe(false);
  });

  it("returns true on subsequent render when matchMedia already matches", () => {
    (globalThis.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const {result, rerender} = renderHook(() => usePrefersReducedMotion());
    // Initial render is false (SSR-safe). After mount effect, hook reads
    // matchMedia.matches and re-renders.
    rerender();
    expect(result.current).toBe(true);
  });
});
