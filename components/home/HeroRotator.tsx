// Client carousel for the brand home hero. Receives resolved Slide[]
// from the server BrandHero and owns carousel state + autoplay. Pauses
// on hover, focus, and off-screen. Honors prefers-reduced-motion.
"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {usePrefersReducedMotion} from "./use-prefers-reduced-motion";
import type {Slide} from "@/lib/home-hero";

const AUTOPLAY_MS = 5000;

type Props = {
  slides: Slide[];
};

export function HeroRotator({slides}: Props) {
  const t = useTranslations();
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
    (n: number) => (slides.length <= 1 ? 0 : (n + slides.length) % slides.length),
    [slides.length]
  );

  const go = useCallback(
    (next: number) => {
      setActive((current) => {
        const target = clamp(next);
        if (target !== current) {
          track("hero_slide_view", {index: target, total: slides.length});
        }
        return target;
      });
    },
    [clamp, slides.length]
  );

  const goPrev = useCallback(() => go(active - 1), [active, go]);
  const goNext = useCallback(() => go(active + 1), [active, go]);

  // Autoplay timer. Routed through `go` so every auto-advance also emits
  // `hero_slide_view`. activeRef sidesteps the stale-active closure without
  // adding `active` to deps (which would reset the timer on every tick).
  useEffect(() => {
    if (reducedMotion || paused || slides.length <= 1) return;
    const id = setInterval(() => {
      go(activeRef.current + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reducedMotion, paused, slides.length, go]);

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

  if (slides.length === 0) return null;

  return (
    <div
      ref={regionRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={t("HeroRotator.regionLabel")}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        // Only resume when focus leaves the carousel entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      {/* Slides — render all, toggle visibility via CSS to keep image cache warm. */}
      <div className="relative">
        {slides.map((slide, i) => {
          const isActive = i === active;
          return (
            <div
              key={`${slide.collection}:${slide.id}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-hidden={!isActive}
              className={
                isActive
                  ? "block"
                  : "absolute inset-0 pointer-events-none opacity-0"
              }
            >
              <div className="overflow-hidden rounded-[1.6rem] border border-gold/40 bg-bg-card shadow-card">
                <div className="relative aspect-[4/5] w-full bg-bg-accent">
                  <Image
                    src={slide.image}
                    alt={slide.imageAlt}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1024px) 28rem, 100vw - 2rem"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  <h2 className="line-clamp-2 font-display text-base font-semibold leading-tight text-text-heading sm:text-lg">
                    {slide.name}
                  </h2>
                  {slide.priceLabel && (
                    <p className="text-sm font-medium text-text-muted">
                      {slide.priceLabel}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={slide.href}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-text-light transition hover:bg-primary-hover"
                    >
                      {t("HeroRotator.view")}
                    </Link>
                    <AddToCartButton slide={slide} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls — arrows + dots. */}
      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            aria-label={t("HeroRotator.previous")}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border-input bg-bg-card text-text-secondary transition hover:border-primary/60 hover:text-primary sm:inline-flex"
          >
            <span aria-hidden="true">←</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`${t("HeroRotator.dotLabel")} ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={
                  i === active
                    ? "h-2 w-6 rounded-full bg-primary transition"
                    : "h-2 w-2 rounded-full bg-border-input transition hover:bg-primary/60"
                }
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label={t("HeroRotator.next")}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border-input bg-bg-card text-text-secondary transition hover:border-primary/60 hover:text-primary sm:inline-flex"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Inline client button so each slide's add-to-cart is independent. Reuses
// the project's AddToCartButton visual style (gold border, uppercase
// tracking) but smaller for the hero card.
function AddToCartButton({slide}: {slide: Slide}) {
  const t = useTranslations();
  const {addItem} = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          id: slide.id,
          name: slide.name,
          priceLabel: slide.priceLabel ?? "",
          image: slide.image,
        });
        setAdded(true);
        track("hero_add_to_cart", {id: slide.id, name: slide.name});
        window.setTimeout(() => setAdded(false), 1800);
      }}
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-bg-control px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-bg-accent"
    >
      <span aria-hidden="true" className="text-gold">
        {added ? "✓" : "+"}
      </span>
      <span>{added ? t("HeroRotator.added") : t("HeroRotator.addToCart")}</span>
    </button>
  );
}

export default HeroRotator;
