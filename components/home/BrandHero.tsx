// components/home/BrandHero.tsx
// Cinematic hero for the Mishran brand home. Server component — reads
// `brand-settings` from Payload for brandName / positioning / heroCopy and
// uses next-intl `getTranslations` for localised hero copy.
//
// Design intent:
// - Editorial, magazine-cover composition: oversized italic display headline
//   anchored to a thin saffron rule, eyebrow tagline above, supporting
//   subhead below, two CTAs at the bottom-left.
// - No hero photograph (no brand asset available). Instead a tactile colour
//   block — gradient from canvas → accent → gold-tinted band — with a small
//   framed product still life pulled from /public/images/ (kaju-katli), used
//   as an editorial inset rather than a stock-photo "hero". This keeps the
//   page grounded in the Mishran product world.
// - Typography mixes weights and styles: lowercase italic brand mark, serif
//   numerals, sentence-case display. Uses the project's font tokens
//   (Outfit/Iowan stack via globals.css) — never Inter / Space Grotesk.

import Image from "next/image";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";

type BrandGlobal = {
  brandName?: string;
  tagline?: string;
  positioning?: string;
  heroCopy?: string;
};

// Best-effort read; falls back gracefully during build / dev without DB so
// the home page never throws.
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
  const [t, brand] = await Promise.all([
    getTranslations("Home"),
    readBrandSettings(),
  ]);

  const brandName = brand?.brandName?.trim() || "Mishran";
  const positioning = brand?.positioning?.trim();

  return (
    <section
      aria-labelledby="brand-hero-heading"
      className="relative overflow-hidden border-b border-border-card"
    >
      {/* Color-field backdrop. Translucent bands layered over the canvas so
          the theme tokens drive the mood on every theme — saffron on default,
          oxblood on heritage, sage on everyday-sage, etc. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-bg-accent/80 via-bg-accent/30 to-transparent" />
        <div className="absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-stretch gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-28 lg:px-8">
        {/* Editorial left column */}
        <div className="flex flex-col justify-center">
          {/* Eyebrow with brand mark + thin rule */}
          <div className="mb-6 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light"
            >
              {brandName.slice(0, 2)}
            </span>
            <span className="h-px flex-1 max-w-[6rem] bg-gradient-to-r from-primary/60 to-transparent" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              {t("heroEyebrow")}
            </span>
          </div>

          {/* Display headline. Mixed roman + italic, oversized, with the
              brand word as the focal anchor. Renders as h1 so the E2E regex
              `/Mishran/i` matches a real heading element. */}
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

          {/* Subhead — prefer Payload positioning, fall back to copy key. */}
          <p className="mt-7 max-w-xl text-base leading-relaxed text-text-info sm:text-lg">
            {positioning || t("heroSubhead")}
          </p>

          {/* CTA row — primary explore mithai, secondary build-a-gift. */}
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
        </div>

        {/* Editorial inset column — a framed product still life + caption
            block. Asymmetric, magazine-style, not a stock "hero image". */}
        <div className="relative hidden lg:block">
          <figure className="relative ml-auto h-full w-full max-w-md">
            {/* Frame: gold-rule border, parchment inset, drop shadow */}
            <div className="absolute inset-0 rounded-[2rem] border border-gold/40 bg-bg-card/60 shadow-card" />
            <div className="relative m-3 overflow-hidden rounded-[1.6rem]">
              <div className="relative aspect-[4/5] w-full bg-bg-accent">
                <Image
                  src="/images/kaju-katli.jpg"
                  alt={t("heroInsetAlt")}
                  fill
                  priority
                  sizes="(min-width: 1024px) 28rem, 0px"
                  className="object-cover"
                />
                {/* Tonal wash so any theme reads correctly. */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-darker/40 via-transparent to-transparent" />
              </div>
            </div>

            {/* Floating caption — bottom-left, anchored to figure. */}
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
      </div>
    </section>
  );
}

export default BrandHero;
