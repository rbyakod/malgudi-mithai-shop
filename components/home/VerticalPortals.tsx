// components/home/VerticalPortals.tsx
// Four "verticals" entry points: Mithai, QSR, Snacks, Merch.
//
// Design intent — avoid the generic 4-up card grid:
// - Asymmetric editorial layout. Two columns on lg: a sticky label rail on
//   the left (eyebrow + section title), and on the right an alternating
//   row strip where each vertical alternates image-left / image-right.
// - Oversized serif numerals (01 / 02 / 03 / 04) anchor each row.
// - Images treated as framed panels (gold rule, tonal wash) — not full-bleed
//   stock cards. Each row uses a real /public/images asset where available;
//   merch has no asset so falls back to a designed colour block (initial
//   monogram, accent gradient) rather than a placeholder image.
// - Hover: image lifts, label underlines, numeral shifts.

import Image from "next/image";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

type VerticalKey = "mithai" | "qsr" | "snacks" | "merch";

type Vertical = {
  key: VerticalKey;
  href: string;
  // path to a real /public/images asset, or null to render the designed
  // colour-block fallback.
  image: string | null;
  // short glyph shown in the fallback block + as a tiny accent.
  glyph: string;
};

const VERTICALS: Vertical[] = [
  {
    key: "mithai",
    href: "/mithai",
    image: "/images/kaju-katli-box.jpg",
    glyph: "M",
  },
  {
    key: "qsr",
    href: "/qsr",
    image: "/images/gulab-jamun.jpg",
    glyph: "Q",
  },
  {
    key: "snacks",
    href: "/snacks",
    image: "/images/besan-laddoo.jpg",
    glyph: "S",
  },
  {
    key: "merch",
    href: "/merch",
    image: null, // no merch asset yet — designed block instead.
    glyph: "M",
  },
];

export async function VerticalPortals() {
  const t = await getTranslations("Home.portal");

  return (
    <section
      aria-labelledby="verticals-heading"
      className="border-b border-border-card bg-bg-page"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        {/* Section header — left rail (sticky on lg) + intro on right */}
        <div className="grid gap-8 lg:grid-cols-[0.4fr_0.6fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {t("eyebrow")}
            </p>
            <h2
              id="verticals-heading"
              className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-primary sm:text-5xl"
            >
              {t("title")}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-text-info lg:pb-2">
            {t("intro")}
          </p>
        </div>

        {/* Alternating editorial rows */}
        <ol className="mt-14 space-y-2">
          {VERTICALS.map((vertical, index) => {
            const label = t(`${vertical.key}.label` as const);
            const description = t(`${vertical.key}.description` as const);
            const numeral = String(index + 1).padStart(2, "0");
            const flip = index % 2 === 1;

            return (
              <li key={vertical.key}>
                <Link
                  href={vertical.href}
                  className="group block border-t border-border-card py-6 transition-colors last:border-b hover:bg-bg-accent/40"
                  aria-label={label}
                >
                  <div
                    className={[
                      "mx-auto grid max-w-6xl items-center gap-6",
                      "grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto]",
                      flip ? "lg:[direction:rtl]" : "",
                    ].join(" ")}
                  >
                    {/* Numeral column */}
                    <span
                      aria-hidden="true"
                      className="font-display text-3xl font-light italic text-primary/70 transition-colors group-hover:text-primary sm:text-4xl lg:[direction:ltr]"
                    >
                      {numeral}
                    </span>

                    {/* Text column */}
                    <div className="lg:[direction:ltr]">
                      <h3 className="font-display text-2xl font-medium tracking-tight text-text-heading sm:text-3xl">
                        {label}
                      </h3>
                      <p className="mt-1 max-w-md text-sm leading-relaxed text-text-muted">
                        {description}
                      </p>
                    </div>

                    {/* Image column (hidden on xs) */}
                    <div className="hidden h-16 w-24 overflow-hidden rounded-xl border border-border-image bg-bg-accent sm:block lg:h-20 lg:w-32 lg:[direction:ltr]">
                      {vertical.image ? (
                        <div className="relative h-full w-full">
                          <Image
                            src={vertical.image}
                            alt=""
                            fill
                            sizes="8rem"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/30 via-transparent to-transparent" />
                        </div>
                      ) : (
                        <div
                          aria-hidden="true"
                          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-gold/15 to-transparent font-display text-2xl font-semibold text-primary"
                        >
                          {vertical.glyph}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export default VerticalPortals;
