// components/stories/StoryCard.tsx
// Editorial card for the /stories hub listing.
//
// Design intent — avoid the generic blog 3-up card grid:
//   - Two presentational modes mirror the magazine spread:
//       `featured` — large image panel + display-serif title + excerpt,
//                    used once for the most-recent story in each pillar.
//       `row`      — a hairline-divided list entry (image thumbnail left,
//                    pillar + title + excerpt right) that reads like a
//                    journal table-of-contents, not a tile.
//   - Image treated as a framed editorial panel (gold hairline + tonal
//     wash); missing image falls back to a designed colour-block monogram
//     so the grid never breaks on a doc uploaded without a hero.
//   - Pillar tag is a small uppercase tracked-gold eyebrow, never a chip.
//
// Server component — no client interactivity required.

import Image from "next/image";
import {Link} from "@/i18n/navigation";

type Props = {
  title: string;
  href: string;
  excerpt?: string | null;
  pillarLabel?: string | null;
  image?: string | null;
  publishedLabel?: string | null;
  /** Display mode. `featured` is the lead story; `row` is the table-of-contents entry. */
  variant?: "featured" | "row";
};

export function StoryCard({
  title,
  href,
  excerpt,
  pillarLabel,
  image,
  publishedLabel,
  variant = "row",
}: Props) {
  if (variant === "featured") {
    return (
      <Link
        href={href}
        aria-label={title}
        className="group grid gap-8 border-t border-border-card pt-6 sm:grid-cols-[0.55fr_0.45fr] sm:gap-10"
      >
        {/* Featured image panel — landscape, framed */}
        <div className="relative aspect-[5/4] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
          {image ? (
            <>
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width: 1024px) 32rem, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/35 via-transparent to-transparent" />
            </>
          ) : (
            <FeaturedFallback glyph={title[0] ?? "·"} />
          )}
        </div>

        {/* Featured copy column */}
        <div className="flex flex-col justify-end">
          {pillarLabel ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
              {pillarLabel}
            </p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl font-light leading-[1.1] tracking-tight text-text-heading sm:text-4xl">
            {title}
          </h2>
          {excerpt ? (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
              {excerpt}
            </p>
          ) : null}
          <ReadMoreAffordance label={publishedLabel} />
        </div>
      </Link>
    );
  }

  // `row` variant — journal table-of-contents entry.
  return (
    <Link
      href={href}
      aria-label={title}
      className="group grid grid-cols-[5.5rem_1fr] gap-5 border-t border-border-card py-5 sm:grid-cols-[7rem_1fr] sm:gap-6"
    >
      {/* Thumbnail — square, framed */}
      <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
        {image ? (
          <>
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width: 640px) 7rem, 5.5rem"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/30 via-transparent to-transparent" />
          </>
        ) : (
          <RowFallback glyph={title[0] ?? "·"} />
        )}
      </div>

      {/* Copy */}
      <div className="flex min-w-0 flex-col justify-center">
        {pillarLabel ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gold">
            {pillarLabel}
          </p>
        ) : null}
        <h3 className="mt-1.5 font-display text-lg font-medium leading-snug tracking-tight text-text-heading">
          {title}
        </h3>
        {excerpt ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
            {excerpt}
          </p>
        ) : null}
        {publishedLabel ? (
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-text-breadcrumb">
            {publishedLabel}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default StoryCard;

// ---- helpers ---------------------------------------------------------------

function ReadMoreAffordance({label}: {label?: string | null}) {
  return (
    <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-gold opacity-80 transition-opacity group-hover:opacity-100">
      {label ?? "Read"}
      <span aria-hidden="true">&rarr;</span>
    </span>
  );
}

function FeaturedFallback({glyph}: {glyph: string}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-gold/15 to-transparent"
    >
      <span className="font-display text-[7rem] font-light italic text-primary">
        {glyph.toUpperCase()}
      </span>
    </div>
  );
}

function RowFallback({glyph}: {glyph: string}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-gold/15 to-transparent"
    >
      <span className="font-display text-3xl font-light italic text-primary">
        {glyph.toUpperCase()}
      </span>
    </div>
  );
}
