// components/home/BrandHero.tsx
// Cinematic hero for the Mishran brand home. Server component — reads
// `brand-settings` from Payload for brandName / positioning / heroCopy,
// resolves curated slides from the `home-hero` global, and renders the
// HeroRotator when slides exist. Empty global → static kaju-katli
// still life (original behaviour).

import Image from "next/image";
import {getTranslations, getLocale} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";
import {resolveHomeHeroSlides} from "@/lib/home-hero";
import {HeroRotator} from "./HeroRotator";

const FALLBACK_HERO_IMAGE =
  "/api/media/file/1_17966508-6230-43cc-a641-14bd2b412990.jpg";

type BrandGlobal = {
  brandName?: string;
  tagline?: string;
  positioning?: string;
  heroCopy?: string;
};

async function readBrandSettings(): Promise<BrandGlobal | null> {
  try {
    const payload = await getPayload();
    const global = (await payload.findGlobal({
      slug: "brand-settings",
    })) as BrandGlobal;
    return global ?? null;
  } catch {
    return null;
  }
}

export async function BrandHero() {
  const [t, brand, locale] = await Promise.all([
    getTranslations("Home"),
    readBrandSettings(),
    getLocale(),
  ]);
  const {slides, autoplayMs} = await resolveHomeHeroSlides(locale);

  const brandName = brand?.brandName?.trim() || "Mishran";
  const positioning = brand?.positioning?.trim();
  const hasSlides = slides.length > 0;

  return (
    <section
      aria-labelledby="brand-hero-heading"
      className="relative overflow-hidden border-b border-border-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-bg-accent/80 via-bg-accent/30 to-transparent" />
        <div className="absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-stretch gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-28 lg:px-8">
        {/* Editorial left column — unchanged. */}
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            >
              <Image
                src="/images/mishran-logo.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
            </span>
            <span className="h-px flex-1 max-w-[6rem] bg-gradient-to-r from-primary/60 to-transparent" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              {t("heroEyebrow")}
            </span>
          </div>

          <h1
            id="brand-hero-heading"
            className="font-display text-[clamp(2.75rem,7vw,5.5rem)] font-light leading-[0.95] tracking-tight text-text-primary"
          >
            <span className="block">{t("heroHeadlineLine1")}</span>
            <span className="mt-1 block">
              <span className="italic text-primary">{brandName}</span>
              <span className="text-text-heading">.</span>
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-text-info sm:text-lg">
            {positioning || t("heroSubhead")}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/mithai"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-text-light shadow-md transition hover:bg-primary-hover hover:shadow-lg"
            >
              {t("ctaExploreMithai")}
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </Link>
            <Link
              href="/build-a-gift"
              className="inline-flex items-center gap-2 border-b border-primary/40 pb-1 text-sm font-semibold text-primary transition hover:border-primary/80"
            >
              {t("ctaBuildGift")}
            </Link>
          </div>

          {!hasSlides ? (
            <figure className="mt-10 overflow-hidden rounded-2xl border border-border-image bg-bg-card shadow-card lg:hidden">
              <div className="relative aspect-[16/10] w-full bg-bg-accent">
                <Image
                  src={FALLBACK_HERO_IMAGE}
                  alt={t("heroInsetAlt")}
                  fill
                  priority
                  sizes="(max-width: 1023px) calc(100vw - 2rem), 0px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-darker/45 via-transparent to-transparent" />
              </div>
              <figcaption className="border-t border-border-card bg-bg-card px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                  {t("heroInsetLabel")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-text-heading">
                  {t("heroInsetTitle")}
                </p>
              </figcaption>
            </figure>
          ) : null}
        </div>

        {/* Right column — rotator when slides exist, else static fallback. */}
        {hasSlides ? (
          <div className="relative lg:ml-auto lg:max-w-md">
            <HeroRotator slides={slides} autoplayMs={autoplayMs} />
          </div>
        ) : (
          <div className="relative hidden lg:block">
            <figure className="relative ml-auto h-full w-full max-w-md">
              <div className="absolute inset-0 rounded-[2rem] border border-gold/40 bg-bg-card/60 shadow-card" />
              <div className="relative m-3 overflow-hidden rounded-[1.6rem]">
                <div className="relative aspect-[4/5] w-full bg-bg-accent">
                  <Image
                    src={FALLBACK_HERO_IMAGE}
                    alt={t("heroInsetAlt")}
                    fill
                    priority
                    sizes="(min-width: 1024px) 28rem, 0px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-darker/40 via-transparent to-transparent" />
                </div>
              </div>

              <figcaption className="absolute -bottom-4 -left-4 max-w-[15rem] rounded-2xl border border-border-card bg-bg-page/95 px-4 py-3 shadow-card backdrop-blur">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                  {t("heroInsetLabel")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-text-heading">
                  {t("heroInsetTitle")}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {t("heroInsetMeta")}
                </p>
              </figcaption>
            </figure>
          </div>
        )}
      </div>
    </section>
  );
}

export default BrandHero;
