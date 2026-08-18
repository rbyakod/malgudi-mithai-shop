// Client carousel for the brand home hero — the admin-selectable "framed"
// variant (Theme settings → Home hero style). Receives resolved Slide[]
// from the server BrandHero; carousel state + autoplay live in the shared
// useHeroCarousel hook (also used by CinematicHero). Pauses on hover,
// focus, and off-screen. Honors prefers-reduced-motion.
"use client";

import Image from "next/image";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useHeroCarousel} from "./use-hero-carousel";
import {HeroAddToCartButton} from "./HeroAddToCartButton";
import type {Slide} from "@/lib/home-hero";

type Props = {
  slides: Slide[];
  autoplayMs?: number;
};

export function HeroRotator({slides, autoplayMs}: Props) {
  const t = useTranslations("HeroRotator");
  const {active, go, goPrev, goNext, regionRef, pauseProps, intervalMs} =
    useHeroCarousel({count: slides.length, intervalMs: autoplayMs});

  if (slides.length === 0) return null;

  return (
    <div
      ref={regionRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={t("regionLabel")}
      className="relative"
      {...pauseProps}
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
              aria-hidden={!isActive || undefined}
              // React 19+ supports `inert` natively — keeps inactive slides'
              // buttons/links out of the tab order and accessibility tree
              // without per-focusable tabIndex bookkeeping.
              {...(!isActive ? {inert: true} : {})}
              className={
                isActive
                  ? "block"
                  : "absolute inset-0 pointer-events-none opacity-0"
              }
            >
              <div className="overflow-hidden rounded-[1.6rem] border border-gold/40 bg-bg-card shadow-card">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-bg-accent lg:aspect-[3/2]">
                  <Image
                    src={slide.image}
                    alt={slide.imageAlt}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1280px) 36rem, (min-width: 1024px) 26rem, 100vw - 2rem"
                    className={`object-cover${
                      isActive ? (i % 2 ? " kb-hero kb-hero--alt" : " kb-hero") : ""
                    }`}
                    style={isActive ? {animationDuration: `${intervalMs}ms`} : undefined}
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
                      {t("view")}
                    </Link>
                    <HeroAddToCartButton slide={slide} />
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
            aria-label={t("previous")}
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
                aria-label={`${t("dotLabel")} ${i + 1}`}
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
            aria-label={t("next")}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border-input bg-bg-card text-text-secondary transition hover:border-primary/60 hover:text-primary sm:inline-flex"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default HeroRotator;
