// components/ui/MediaCard.tsx
// Editorial card for vertical hub listings.
//
// Design intent — avoid the generic e-commerce 3-up product card:
// - Image treated as a framed editorial panel (gold hairline + tonal wash),
//   not a stock-photo tile. When there's no image, fall back to a designed
//   colour block (initial monogram + accent gradient) like VerticalPortals.
// - Title in the project's display serif; "View" affordance in tracked
//   uppercase gold, mirroring the read-more pattern in Pillars.tsx.
// - Numerals not used here (the hub grid is the index); instead each card
//   anchors on a thin gold rule under the title.
//
// Server component — no client interactivity required.

import Image from "next/image";
import {Link} from "@/i18n/navigation";

type Props = {
  title: string;
  href: string;
  /** Absolute or root-relative URL of the media asset. Null renders the
   *  designed colour-block fallback so the grid never breaks on missing
   *  media (Task 7 seeds ship without images; Task 16 will backfill). */
  image?: string | null;
  /** Optional eyebrow tag (e.g. category, family, type). */
  tag?: string | null;
  /** Optional glyph for the fallback block. Defaults to first letter of
   *  title. */
  glyph?: string;
};

export function MediaCard({title, href, image, tag, glyph}: Props) {
  const monogram = (glyph ?? title?.[0] ?? "·").toUpperCase();

  return (
    <Link
      href={href}
      aria-label={title}
      className="group flex flex-col border-t border-border-card pt-5 transition-colors hover:bg-bg-accent/30"
    >
      {/* Framed image panel — or designed fallback */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
        {image ? (
          <>
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/35 via-transparent to-transparent" />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-gold/15 to-transparent"
          >
            <span className="font-display text-5xl font-light italic text-primary">
              {monogram}
            </span>
          </div>
        )}
      </div>

      {/* Tag eyebrow (optional) */}
      {tag ? (
        <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
          {tag}
        </p>
      ) : null}

      {/* Title — display serif, plain text so hub regex matches */}
      <h3 className="mt-2 font-display text-xl font-medium leading-snug tracking-tight text-text-heading">
        {title}
      </h3>

      {/* Thin gold rule + View affordance */}
      <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-gold opacity-80 transition-opacity group-hover:opacity-100">
        View
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

export default MediaCard;
