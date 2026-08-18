// components/stories/StoryHero.tsx
// Story detail masthead — editorial, magazine-cover style.
//
// Design intent — not a generic blog hero (centred title over a stock photo):
//   - Two-column asymmetric grid mirroring MithaiPDP and BrandHero: a
//     left rail (breadcrumb → pillar eyebrow → display-serif title →
//     excerpt → published date) and a right column with a framed,
//     tonal-washed hero image. When there's no image, a designed colour
//     block carries the title monogram.
//   - Pillar eyebrow is a tracked uppercase gold label, not a coloured chip.
//   - The image panel uses aspect 4/5 (portrait broadsheet) so it reads
//     as a magazine plate, not a stock hero.
//
// Server component — no client interactivity required.

import Image from "next/image";

type Props = {
  title: string;
  excerpt?: string | null;
  pillarLabel?: string | null;
  image?: string | null;
  publishedLabel?: string | null;
  publishedPrefix?: string | null;
  breadcrumbHome?: string | null;
  hubLabel?: string | null;
};

export function StoryHero({
  title,
  excerpt,
  pillarLabel,
  image,
  publishedLabel,
  publishedPrefix,
  breadcrumbHome,
  hubLabel,
}: Props) {
  return (
    <header className="pb-10 pt-6">
      {/* Breadcrumb — Mishran / Stories / {title} */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-breadcrumb"
      >
        <span>{breadcrumbHome ?? "Mishran"}</span>
        <span aria-hidden="true">/</span>
        <span>{hubLabel ?? "Stories"}</span>
        <span aria-hidden="true">/</span>
        <span className="text-text-muted line-clamp-1">{title}</span>
      </nav>

      {/* Hero spread */}
      <div className="mt-8 grid gap-10 border-b border-border-card pb-12 lg:grid-cols-[0.55fr_0.45fr] lg:items-end">
        {/* Left rail — pillar + title + excerpt + date */}
        <div className="order-2 lg:order-1">
          {pillarLabel ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
              {pillarLabel}
            </p>
          ) : null}
          <h1
            className="mt-3 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-[1.02] tracking-tight text-text-heading"
          >
            {title}
          </h1>
          {excerpt ? (
            <p className="mt-6 max-w-xl font-display text-lg font-light italic leading-relaxed text-text-info sm:text-xl">
              {excerpt}
            </p>
          ) : null}
          {publishedLabel ? (
            <p className="mt-8 text-[10px] font-medium uppercase tracking-[0.22em] text-text-breadcrumb">
              {publishedPrefix ?? ""} {publishedLabel}
            </p>
          ) : null}
        </div>

        {/* Right column — framed hero image */}
        <div className="order-1 lg:order-2">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
            {image ? (
              <>
                <Image
                  src={image}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 32rem, 100vw"
                  className="object-cover kb-drift"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/40 via-transparent to-transparent" />
              </>
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-gold/15 to-transparent"
              >
                <span className="font-display text-[8rem] font-light italic text-primary">
                  {(title[0] ?? "·").toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default StoryHero;
