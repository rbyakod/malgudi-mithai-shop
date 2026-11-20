// components/home/MishranHome.tsx
// The home page as the Mishran Design System's website brief lays it out:
// Hero (nutmeg, the Mithai Library) · ArtBand (the Pichwai marigolds) ·
// crafts grid (one tile per pack) · CraftStory (the chakla bhaji box, on its
// own crimson) · JourneySteps (Jhajjar to the counter) · today's mithai from
// the counter · doors into the rest of the house · Visit (deep gold, DROP IN).
// Async server component: copy comes from messages (MsHome), the address from
// Store Settings, and the counter row from the mithai-products collection.
// Every band runs the full width of the window.

import Image from "next/image";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {fullAddress, type StoreInfo} from "@/lib/store-info";
import {CounterPicks} from "@/components/home/CounterPicks";

// The shop's address as the design system confirms it; Store Settings wins when set.
export const HOUSE_ADDRESS = "H-4/3, Main Market, Model Town-II, North Delhi, Delhi-110009";

type Pack = {key: string; img: string; width: number; height: number};

const PACKS: Pack[] = [
  {key: "library", img: "library", width: 1600, height: 1227},
  {key: "vitrine", img: "vitrine", width: 1600, height: 1276},
  {key: "pichwai", img: "pichwai", width: 1600, height: 1113},
  {key: "parchin", img: "parchin", width: 1600, height: 1092},
  {key: "chakla", img: "chakla", width: 1500, height: 1100},
  {key: "sanjhi", img: "sanjhi", width: 1476, height: 960},
];

type Step = {key: string; img: string; width: number; height: number};

const STEPS: Step[] = [
  {key: "herd", img: "herd", width: 1600, height: 1552},
  {key: "milking", img: "milking", width: 1600, height: 1333},
  {key: "distance", img: "milkwall", width: 1533, height: 1042},
  {key: "khoya", img: "khoya", width: 1600, height: 1333},
  {key: "counter", img: "kaju", width: 1404, height: 936},
];

const OCCASIONS: {key: string; href: string}[] = [
  {key: "diwali", href: "/occasions"},
  {key: "weddings", href: "/weddings"},
  {key: "office", href: "/corporate"},
  {key: "occasions", href: "/occasions"},
];

const DOORS: {key: string; href: string}[] = [
  {key: "mithai", href: "/mithai"},
  {key: "build", href: "/build-a-gift"},
  {key: "restaurant", href: "/qsr"},
  {key: "snacks", href: "/snacks"},
];

// The chakla bhaji box's own dyes (Packaging and India's crafts): crimson,
// indigo, mustard and the silver leaf.
const CHAKLA_DYES = ["#850E2B", "#0F1F3C", "#BB7721", "#D4D7DA"];

function packSrc(name: string) {
  return `/brand/packs/${name}.jpg`;
}

function mapUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Mishran, ${address}`)}`;
}

type Props = {
  store: StoreInfo | null;
};

export async function MishranHome({store}: Props) {
  const t = await getTranslations("MsHome");
  const address = store && (store.address || store.city) ? fullAddress(store) : HOUSE_ADDRESS;

  return (
    <div className="ms-bleed">
      {/* Hero: nutmeg, the Mithai Library.
          The aria-labelledby ids on this page's sections are also the AI team's hooks
          (mishran-agents data/experience.default.json): it tracks which section is in view
          to change its suggestions, mounts its "What brings you here?" picker after the
          hero's ".mt-10.flex" row, and relabels the hero link to /mithai. Keep them. */}
      <section className="ms-on-nutmeg" aria-labelledby="brand-hero-heading">
        <div className="ms-wrap ms-hero-in">
          <div className="ms-hero-copy">
            <p className="ms-label">{t("hero.label")}</p>
            <h1 id="brand-hero-heading" className="ms-display">{t("hero.title")}</h1>
            <p className="ms-lead">{t("hero.lead")}</p>
            <div className="ms-row ms-hero-actions mt-10 flex">
              <Link className="ms-btn ms-btn-on-dark" href="/gifts">
                {t("hero.cta")}
              </Link>
              <Link className="ms-more" href="/mithai">
                {t("hero.more")}
              </Link>
            </div>
          </div>
          <figure className="ms-hero-media">
            <Image
              src={packSrc("library")}
              alt={t("hero.alt")}
              width={1600}
              height={1227}
              sizes="(max-width: 800px) 100vw, 55vw"
              priority
            />
          </figure>
        </div>
      </section>

      {/* ArtBand: the Pichwai marigolds; मिश्रण means a blend. */}
      <section className="ms-artband" aria-labelledby="pillars-heading">
        <Image className="ms-artband-img" src={packSrc("marigold")} alt="" fill sizes="100vw" />
        <div className="ms-wrap ms-artband-in">
          <div className="ms-panel ms-stack">
            <p className="ms-hindi ms-hindi--maroon" lang="hi">
              मिश्रण
            </p>
            <h2 id="pillars-heading" className="ms-headline ms-maroon">{t("art.title")}</h2>
            <p className="ms-body">{t("art.body")}</p>
            <Link className="ms-btn ms-btn-primary" href="/stories">
              {t("art.cta")}
            </Link>
          </div>
        </div>
        <p className="ms-artband-credit">{t("art.credit")}</p>
      </section>

      {/* Crafts grid: one tile per pack, with the occasions as text links. */}
      <section className="ms-on-cream ms-section" aria-labelledby="gifts-hub-heading">
        <div className="ms-wrap ms-stack-lg">
          <header className="ms-head">
            <p className="ms-label">{t("boxes.label")}</p>
            <h2 id="gifts-hub-heading" className="ms-headline">{t("boxes.title")}</h2>
            <p className="ms-lead">{t("boxes.lead")}</p>
            <p className="ms-links-row">
              <span className="ms-label ms-muted">{t("boxes.giftingFor")}</span>
              {OCCASIONS.map((o) => (
                <Link key={o.key} className="ms-more" href={o.href}>
                  {t(`boxes.occasions.${o.key}`)}
                </Link>
              ))}
            </p>
          </header>
          <div className="ms-grid ms-grid-3">
            {PACKS.map((pack) => (
              <Link key={pack.key} className="ms-card" href="/gifts">
                <figure className="ms-card-media ms-wide">
                  <Image
                    src={packSrc(pack.img)}
                    alt={t(`boxes.packs.${pack.key}.alt`)}
                    width={pack.width}
                    height={pack.height}
                    sizes="(max-width: 560px) 100vw, (max-width: 960px) 50vw, 400px"
                  />
                </figure>
                <p className="ms-label ms-muted">{t(`boxes.packs.${pack.key}.place`)}</p>
                <h3 className="ms-title">{t(`boxes.packs.${pack.key}.craft`)}</h3>
                <p className="ms-caption">{t(`boxes.packs.${pack.key}.box`)}</p>
              </Link>
            ))}
          </div>
          <p>
            <Link className="ms-more" href="/gifts">
              {t("boxes.all")}
            </Link>
          </p>
        </div>
      </section>

      {/* CraftStory: the season's box, on its own dye. */}
      <section className="ms-section ms-on-dye-chakla" aria-labelledby="occasions-hub-heading">
        <div className="ms-wrap ms-craft">
          <figure className="ms-craft-media">
            <Image
              src={packSrc("chakla")}
              alt={t("craft.alt")}
              width={1500}
              height={1100}
              sizes="(max-width: 800px) 100vw, 55vw"
            />
          </figure>
          <div className="ms-craft-copy">
            <p className="ms-label">{t("craft.place")}</p>
            <p className="ms-hindi ms-gold" lang="hi">
              चाकला
            </p>
            <h2 id="occasions-hub-heading" className="ms-headline">{t("craft.title")}</h2>
            <p className="ms-body">{t("craft.body")}</p>
            <dl className="ms-craft-facts">
              <dt>{t("craft.craftLabel")}</dt>
              <dd>{t("craft.craftValue")}</dd>
              <dt>{t("craft.sizeLabel")}</dt>
              <dd>{t("craft.sizeValue")}</dd>
              <dt>{t("craft.coloursLabel")}</dt>
              <dd>
                <span className="ms-dyes">
                  {CHAKLA_DYES.map((hex) => (
                    // The pack's own dyes are product data, so they are set inline.
                    <span key={hex} className="ms-dye" style={{background: hex}} />
                  ))}
                </span>
              </dd>
            </dl>
            <Link className="ms-more" href="/weddings">
              {t("craft.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* JourneySteps: from Jhajjar to the counter. */}
      <section className="ms-on-nutmeg ms-section">
        <div className="ms-wrap ms-stack-lg">
          <header className="ms-head">
            <p className="ms-label">{t("journey.label")}</p>
            <h2 className="ms-headline">{t("journey.title")}</h2>
          </header>
          <ol className="ms-steps">
            {STEPS.map((step, i) => (
              <li key={step.key} className="ms-step">
                <figure className="ms-step-media">
                  <Image
                    src={packSrc(step.img)}
                    alt={t(`journey.steps.${step.key}.alt`)}
                    width={step.width}
                    height={step.height}
                    sizes="(max-width: 560px) 100vw, (max-width: 960px) 50vw, 260px"
                  />
                </figure>
                <p className="ms-step-n">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="ms-title">{t(`journey.steps.${step.key}.title`)}</h3>
                <p className="ms-caption">{t(`journey.steps.${step.key}.text`)}</p>
              </li>
            ))}
          </ol>
          <p>
            <Link className="ms-more" href="/stories/farms">
              {t("journey.more")}
            </Link>
          </p>
        </div>
      </section>

      {/* Today's mithai from the counter: ProductCards from the catalog. */}
      <CounterPicks />

      {/* Doors into the rest of the house. */}
      <section className="ms-on-cream ms-section ms-section--tight-top" aria-labelledby="verticals-heading">
        <div className="ms-wrap ms-stack-lg">
          <header className="ms-head">
            <p className="ms-label">{t("doors.label")}</p>
            <h2 id="verticals-heading" className="ms-title ms-maroon">{t("doors.title")}</h2>
          </header>
          <ul className="ms-doors">
            {DOORS.map((door, i) => (
              <li key={door.key}>
                <Link className="ms-door" href={door.href}>
                  <span className="ms-label ms-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ms-title">{t(`doors.${door.key}.title`)}</span>
                  <span className="ms-caption">{t(`doors.${door.key}.text`)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <Link className="ms-more" href="/merch">
              {t("doors.merch.title")}
            </Link>
          </p>
        </div>
      </section>

      {/* Visit: deep gold, DROP IN. */}
      <section className="ms-on-gold">
        <div className="ms-wrap ms-field-in ms-field-in--center">
          <h2 className="ms-display ms-cream">{t("visit.title")}</h2>
          <div className="ms-panel ms-stack">
            <p className="ms-label ms-muted">{t("visit.label")}</p>
            <address className="ms-body ms-address">{address}</address>
            <p className="ms-body">{t("visit.floors")}</p>
            {store?.hours ? <p className="ms-body">{t("visit.hours", {hours: store.hours})}</p> : null}
            <a className="ms-btn ms-btn-primary" href={mapUrl(address)} target="_blank" rel="noopener noreferrer">
              {t("visit.map")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default MishranHome;
