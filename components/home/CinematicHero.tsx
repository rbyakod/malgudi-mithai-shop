// components/home/CinematicHero.tsx
// Full-bleed cinematic home hero — the admin-selectable alternative to the
// framed HeroRotator (Theme settings → Home hero style). Edge-to-edge Ken
// Burns band (~76svh desktop / 68svh mobile) with a deep-maroon scrim,
// overlaid headline/CTAs, and a foot row carrying the active product chip,
// add-to-cart, and dot indicators. Slides crossfade (vs the framed
// variant's hard cut) and share the same carousel brain + cart button, so
// autoplay, analytics, and cart payloads are identical across variants.
"use client";

import Image from "next/image";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {
  isFullWidthLayout,
  type StorefrontLayoutMode,
} from "@/lib/storefront-layout";
import {useHeroCarousel} from "./use-hero-carousel";
import {HeroAddToCartButton} from "./HeroAddToCartButton";
import type {Slide} from "@/lib/home-hero";

type Props = {
  slides: Slide[];
  autoplayMs?: number;
  layoutMode: StorefrontLayoutMode;
  brandName: string;
  positioning?: string;
};

export function CinematicHero({
  slides,
  autoplayMs,
  layoutMode,
  brandName,
  positioning,
}: Props) {
  const t = useTranslations("Home");
  const tr = useTranslations("HeroRotator");
  const {active, go, regionRef, pauseProps, intervalMs} = useHeroCarousel({
    count: slides.length,
    intervalMs: autoplayMs,
  });

  if (slides.length === 0) return null;
  const current = slides[active];

  // Same bleed contract as the framed BrandHero: fixed mode escapes
  // main's max-w-6xl via the 50vw trick; full mode cancels main's exact
  // horizontal padding so the band is truly edge-to-edge.
  const bleedClass = isFullWidthLayout(layoutMode)
    ? "-mx-4 -mt-4 sm:-mx-6 lg:-mx-10 2xl:-mx-14"
    : "mx-[calc(50%-50vw)] -mt-4 w-screen";

  return (
    <section
      aria-labelledby="brand-hero-heading"
      className={`relative isolate overflow-hidden border-b border-border-card bg-bg-darker ${bleedClass}`}
    >
      <div
        ref={regionRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={tr("regionLabel")}
        // svh (not vh) so mobile browser chrome collapsing doesn't make
        // the band jump while scrolling.
        className="relative h-[68svh] min-h-[28rem] w-full lg:h-[76svh]"
        {...pauseProps}
      >
        {/* Slides — all mounted, crossfaded via opacity to keep image
            cache warm. Ken Burns class is applied only while active, so
            each activation restarts the scale/pan within the dwell. */}
        {slides.map((slide, i) => {
          const isActive = i === active;
          return (
            <div
              key={`${slide.collection}:${slide.id}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-hidden={!isActive || undefined}
              {...(!isActive ? {inert: true} : {})}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                isActive
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                fill
                priority={i === 0}
                sizes="100vw"
                className={`object-cover${
                  isActive ? (i % 2 ? " kb-hero kb-hero--alt" : " kb-hero") : ""
                }`}
                style={
                  isActive ? {animationDuration: `${intervalMs}ms`} : undefined
                }
              />
            </div>
          );
        })}

        {/* Scrim — keeps overlaid text readable over any photo. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-darker/90 via-primary/40 to-primary/10"
        />

        {/* Overlay — bottom-anchored, aligned to the site's content
            rhythm rather than the full band width. */}
        <div className="absolute inset-0 flex flex-col justify-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8 lg:pb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
              {t("heroEyebrow")}
            </p>
            <h1
              id="brand-hero-heading"
              className="mt-4 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-light leading-[0.95] tracking-tight text-text-light"
            >
              <span className="block">{t("heroHeadlineLine1")}</span>
              <span className="mt-1 block">
                <span className="italic text-gold">{brandName}</span>
                <span className="text-text-light">.</span>
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-text-light-muted sm:text-lg">
              {positioning || t("heroSubhead")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/mithai"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3 text-sm font-semibold text-text-on-gold shadow-md transition hover:bg-gold-hover hover:shadow-lg"
              >
                {t("ctaExploreMithai")}
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link
                href="/build-a-gift"
                className="inline-flex items-center gap-2 border-b border-text-light/60 pb-1 text-sm font-semibold text-text-light transition hover:border-text-light"
              >
                {t("ctaBuildGift")}
              </Link>
            </div>

            {/* Foot row — active product chip + add-to-cart + dots. */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={current.href}
                  className="inline-flex items-center gap-3 rounded-full border border-gold/50 bg-bg-darker/60 px-4 py-2 backdrop-blur transition hover:border-gold"
                >
                  <span className="text-sm font-semibold text-text-light">
                    {current.name}
                  </span>
                  {current.priceLabel ? (
                    <span className="text-sm text-gold">
                      {current.priceLabel}
                    </span>
                  ) : null}
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-light-muted">
                    {tr("view")}
                  </span>
                </Link>
                <HeroAddToCartButton slide={current} />
              </div>

              {slides.length > 1 && (
                <div className="flex items-center gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => go(i)}
                      aria-label={`${tr("dotLabel")} ${i + 1}`}
                      aria-current={i === active ? "true" : undefined}
                      className={
                        i === active
                          ? "h-2 w-6 rounded-full bg-gold transition"
                          : "h-2 w-2 rounded-full bg-text-light/40 transition hover:bg-text-light/70"
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CinematicHero;
