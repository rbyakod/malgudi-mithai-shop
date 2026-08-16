// components/legal/LegalPage.tsx
// Shared server-component shell for the trust/legal pages (privacy, terms,
// shipping, returns, accessibility, about). Masthead (eyebrow / display-serif
// title / intro) + long-form sections rendered from the `Legal.<namespace>`
// message keys: `sections.sN.heading`, `sections.sN.pM` paragraphs, and
// optional `sections.sN.bM` bullets — indexed keys (not JSON arrays) so the
// copy lives entirely in messages/*.json and every locale stays key-parity
// checkable. `values` are ICU params (the shipping page passes the live
// delivery fees from lib/config so the copy can never drift from the API).
//
// Pages that need bespoke CTAs (help/contact) render their own layout
// instead of using this shell.

import {getTranslations} from "next-intl/server";

const MAX_SECTIONS = 12;
const MAX_ITEMS = 10;

type Section = {
  heading: string;
  paragraphs: string[];
  bullets: string[];
};

type Props = {
  namespace:
    | "privacy"
    | "terms"
    | "shipping"
    | "returns"
    | "accessibility"
    | "about";
  /** ICU interpolation params shared by every string in the page. */
  values?: Record<string, string>;
};

export async function LegalPage({namespace, values = {}}: Props) {
  const t = await getTranslations(`Legal.${namespace}`);

  const sections: Section[] = [];
  for (let n = 1; n <= MAX_SECTIONS; n++) {
    const headingKey = `sections.s${n}.heading`;
    if (!t.has(headingKey)) break;
    const paragraphs: string[] = [];
    for (let p = 1; p <= MAX_ITEMS; p++) {
      const key = `sections.s${n}.p${p}`;
      if (!t.has(key)) break;
      paragraphs.push(t(key, values));
    }
    const bullets: string[] = [];
    for (let b = 1; b <= MAX_ITEMS; b++) {
      const key = `sections.s${n}.b${b}`;
      if (!t.has(key)) break;
      bullets.push(t(key, values));
    }
    sections.push({heading: t(headingKey), paragraphs, bullets});
  }

  return (
    <section
      aria-labelledby={`legal-${namespace}-heading`}
      className="mx-auto w-full max-w-3xl flex-1 pb-20 pt-10 sm:pt-14"
    >
      <header className="border-b border-border-card pb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
          {t("eyebrow")}
        </p>
        <h1
          id={`legal-${namespace}-heading`}
          className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-text-heading sm:text-5xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
          {t("intro", values)}
        </p>
      </header>

      <div className="mt-10 space-y-12">
        {sections.map((section, i) => (
          <section key={section.heading} aria-labelledby={`legal-${namespace}-s${i + 1}`}>
            <h2
              id={`legal-${namespace}-s${i + 1}`}
              className="font-display text-xl font-medium text-text-heading"
            >
              {section.heading}
            </h2>
            <div className="mt-4 space-y-4">
              {section.paragraphs.map((paragraph, j) => (
                <p key={j} className="text-sm leading-relaxed text-text-secondary">
                  {paragraph}
                </p>
              ))}
              {section.bullets.length > 0 ? (
                <ul className="space-y-2">
                  {section.bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="flex gap-3 text-sm leading-relaxed text-text-secondary"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-gold"
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export default LegalPage;
