// components/ui/MediaCard.tsx
// Card for vertical hub listings and rails, built as the Mishran Design System's
// ProductCard: the picture on a nutmeg ground, an optional label, the name in Mono
// capitals, an optional line, and the price (figures in Mono with a Tiro ₹) over a
// hairline. A missing picture shows the nutmeg ground with the name's first letter.
// The product-image drift (kb-drift) stays: it is switched off by reduced motion and
// by Admin → Storefront settings → Product image motion.
//
// Server component — no client interactivity required.

import Image from "next/image";
import {Link} from "@/i18n/navigation";
import {splitPriceLabel} from "@/lib/ms-price";

type Props = {
  title: string;
  href: string;
  /** Absolute or root-relative URL of the media asset. Null renders the
   *  nutmeg ground so the grid never breaks on missing media. */
  image?: string | null;
  /** Optional label above the name (e.g. category, family, type). */
  tag?: string | null;
  /** Optional glyph for the fallback ground. Defaults to first letter of title. */
  glyph?: string;
  /** Optional price line (e.g. "₹920 / 250 g"). */
  priceLabel?: string | null;
  /** Optional one-or-two-line blurb under the name. */
  blurb?: string | null;
};

export function MediaCard({title, href, image, tag, glyph, priceLabel, blurb}: Props) {
  const monogram = (glyph ?? title?.[0] ?? "·").toUpperCase();
  const price = priceLabel ? splitPriceLabel(priceLabel) : null;

  return (
    <Link href={href} aria-label={title} className="ms-card">
      <figure className="ms-card-media ms-card-media--fill">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
            className="object-cover kb-drift"
          />
        ) : (
          <span aria-hidden="true" className="ms-card-glyph">
            {monogram}
          </span>
        )}
      </figure>

      {tag ? <p className="ms-label ms-muted">{tag}</p> : null}

      {/* Plain text so the hub tests can match the name. */}
      <h3 className="ms-title">{title}</h3>

      {blurb ? <p className="ms-caption ms-clamp-2">{blurb}</p> : null}

      {price ? (
        <div className="ms-card-meta">
          <span className="ms-price">
            <span className="ms-rupee">₹</span>
            {price.amount}
          </span>
          {price.unit ? <span className="ms-weight">{price.unit}</span> : null}
        </div>
      ) : priceLabel ? (
        <div className="ms-card-meta">
          <span className="ms-caption">{priceLabel}</span>
        </div>
      ) : null}
    </Link>
  );
}

export default MediaCard;
