// components/home/use-hero-carousel.ts
// Shared carousel brain for both home hero variants (framed HeroRotator +
// CinematicHero). Owns active-slide state, autoplay (gated by
// prefers-reduced-motion + hover/focus pause + off-screen pause) and the
// hero_slide_view analytics emission. Extracted verbatim from HeroRotator
// so both variants stay behavior-identical.
"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {track} from "@/lib/analytics";
import {usePrefersReducedMotion} from "./use-prefers-reduced-motion";

export const DEFAULT_AUTOPLAY_MS = 5000;

export type HeroCarousel = {
  active: number;
  go: (next: number) => void;
  goPrev: () => void;
  goNext: () => void;
  regionRef: React.RefObject<HTMLDivElement | null>;
  pauseProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  };
  /** autoplayMs if a positive value was provided, else 5000. */
  intervalMs: number;
};

export function useHeroCarousel({
  count,
  intervalMs: requestedMs,
}: {
  count: number;
  intervalMs?: number;
}): HeroCarousel {
  const intervalMs =
    requestedMs && requestedMs > 0 ? requestedMs : DEFAULT_AUTOPLAY_MS;
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  // Keep activeRef in sync so the autoplay interval (which intentionally
  // excludes `active` from its deps to avoid resetting the timer on every
  // transition) can read the current value via the ref.
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Wrap clamp helper.
  const clamp = useCallback(
    (n: number) => (count <= 1 ? 0 : (n + count) % count),
    [count]
  );

  const go = useCallback(
    (next: number) => {
      setActive((current) => {
        const target = clamp(next);
        if (target !== current) {
          track("hero_slide_view", {index: target, total: count});
        }
        return target;
      });
    },
    [clamp, count]
  );

  const goPrev = useCallback(() => go(activeRef.current - 1), [go]);
  const goNext = useCallback(() => go(activeRef.current + 1), [go]);

  // Autoplay timer. Routed through `go` so every auto-advance also emits
  // `hero_slide_view`. activeRef sidesteps the stale-active closure without
  // adding `active` to deps (which would reset the timer on every tick).
  useEffect(() => {
    if (reducedMotion || paused || count <= 1) return;
    const id = setInterval(() => {
      go(activeRef.current + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [reducedMotion, paused, count, go, intervalMs]);

  // Pause when the region is scrolled off-screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const el = regionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      {threshold: 0}
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return {
    active,
    go,
    goPrev,
    goNext,
    regionRef,
    pauseProps: {
      onMouseEnter: () => setPaused(true),
      onMouseLeave: () => setPaused(false),
      onFocus: () => setPaused(true),
      onBlur: (e) => {
        // Only resume when focus leaves the carousel entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPaused(false);
        }
      },
    },
    intervalMs,
  };
}
