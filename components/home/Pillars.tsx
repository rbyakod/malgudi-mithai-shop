// components/home/Pillars.tsx
// Brand pillars strip — Milk Purity · Karigar Mastery · Karigari · Modern Experience.
//
// Design intent — avoid the cookie-cutter 2x2 or 4-up card grid:
// - Horizontal strip with vertical hairline dividers on md+ (like a
//   broadsheet masthead or a wine list), stacked rows on mobile.
// - Large serif Roman numerals (I / II / III / IV) as visual anchors.
// - Each pillar is a link into the relevant /stories/... hub, but the
//   pillar name itself renders as plain text inside an <h3> so the E2E
//   `getByText(/Milk Purity/i)` and `getByText(/Karigar Mastery/i)` regex
//   match real visible text.

import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

type PillarKey = "milkPurity" | "karigarMastery" | "karigari" | "modernExperience";

type Pillar = {
  key: PillarKey;
  // Roman numeral — keeps the editorial broadsheet feel without depending
  // on any custom font glyph beyond the project's display stack.
  numeral: string;
  // destination inside the /stories hub tree
  href: string;
};

const PILLARS: Pillar[] = [
  {key: "milkPurity", numeral: "I", href: "/stories/farms"},
  {key: "karigarMastery", numeral: "II", href: "/stories/karigars"},
  {key: "karigari", numeral: "III", href: "/stories/karigari"},
  {key: "modernExperience", numeral: "IV", href: "/stories/journal"},
];

export async function Pillars() {
  const t = await getTranslations("Home.pillars");

  return (
    <section
      aria-labelledby="pillars-heading"
      className="bg-bg-darker text-text-light"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        {/* Eyebrow + heading row */}
        <div className="flex flex-col gap-2 border-b border-text-light-muted/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
              {t("eyebrow")}
            </p>
            <h2
              id="pillars-heading"
              className="mt-2 font-display text-3xl font-light leading-tight tracking-tight sm:text-4xl"
            >
              {t("title")}
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-text-light-muted">
            {t("intro")}
          </p>
        </div>

        {/* Pillars strip — divided columns on md+, stacked on mobile */}
        <ul className="grid grid-cols-1 divide-y divide-text-light-muted/15 md:grid-cols-4 md:divide-x md:divide-y-0">
          {PILLARS.map((pillar) => (
            <li key={pillar.key} className="md:px-6 md:first:pl-0 md:last:pr-0">
              <Link
                href={pillar.href}
                className="group block py-6 md:py-8"
              >
                {/* Numeral + thin rule */}
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="font-display text-2xl font-light italic text-gold"
                  >
                    {pillar.numeral}
                  </span>
                  <span className="h-px w-8 bg-gold/40" />
                </div>

                {/* Pillar name — plain text inside an h3 so the regex
                    matches real visible text (not just aria-label). */}
                <h3 className="mt-3 font-display text-xl font-medium tracking-tight text-text-light">
                  {t(`${pillar.key}.label` as const)}
                </h3>

                {/* One-line description rooted in the Mishran brand story. */}
                <p className="mt-2 text-xs leading-relaxed text-text-light-muted">
                  {t(`${pillar.key}.description` as const)}
                </p>

                {/* Read-more affordance */}
                <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-gold opacity-80 transition-opacity group-hover:opacity-100">
                  {t("readMore")}
                  <span aria-hidden="true">&rarr;</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Pillars;
