// components/home/MishranHome.tsx
// The home page as the Mishran Design System's website brief lays it out:
// Hero (nutmeg, the Mithai Library) · ArtBand (the Pichwai marigolds) ·
// crafts grid (one tile per pack) · JourneySteps (Jhajjar to the counter) ·
// the counter's doors into the shop · Visit (deep gold, DROP IN).
// Server component, static copy taken from the system's guides; every band
// runs the full width of the window.

import Image from "next/image";
import {Link} from "@/i18n/navigation";

type Pack = {
  img: string;
  width: number;
  height: number;
  place: string;
  craft: string;
  box: string;
};

const PACKS: Pack[] = [
  {img: "library", width: 1600, height: 1227, place: "Eight sweets · eight regions", craft: "The scripts of India", box: "The Mithai Library, our signature box"},
  {img: "vitrine", width: 1600, height: 1276, place: "Kutch · Gujarat", craft: "Lippan kaam", box: "The Vitrine, box of four"},
  {img: "pichwai", width: 1600, height: 1113, place: "Nathdwara · Rajasthan", craft: "Pichwai", box: "The personalised box, N° 01"},
  {img: "chakla", width: 1500, height: 1100, place: "Kathiawar · Gujarat", craft: "Chakla", box: "The bhaji box"},
  {img: "sanjhi", width: 1476, height: 960, place: "Braj · Uttar Pradesh", craft: "Sanjhi", box: "The motichoor laddoo box"},
  {img: "kaju", width: 1404, height: 936, place: "Banaras · Uttar Pradesh", craft: "Banarasi zari", box: "The kaju katli box"},
];

type Step = {img: string; width: number; height: number; alt: string; title: string; text: string};

const STEPS: Step[] = [
  {img: "herd", width: 1600, height: 1552, alt: "A painted Murrah buffalo.", title: "The herd", text: "Our own cows and buffaloes, at Jhajjar. Our buffaloes are Murrah."},
  {img: "milking", width: 1600, height: 1333, alt: "Hands milking a buffalo into a steel pail.", title: "4 a.m.", text: "Our buffaloes and cows are milked at 4 a.m., every day."},
  {img: "khoya", width: 1600, height: 1333, alt: "Milk cooking down to khoya.", title: "Khoya", text: "We make our own khoya and chhena from that milk."},
  {img: "kaju", width: 1404, height: 936, alt: "The kaju katli box.", title: "The counter", text: "Our karigars make it into mithai, and it comes to the counter."},
];

type Door = {href: string; label: string; title: string; text: string};

const DOORS: Door[] = [
  {href: "/mithai", label: "The counter", title: "Mithai", text: "Ghee, Bengali, kaju and coconut sweets, priced by weight."},
  {href: "/gifts", label: "Gifting", title: "Gift boxes", text: "Each box drawn from one Indian craft."},
  {href: "/build-a-gift", label: "Gifting", title: "Build a box", text: "Choose the box and the mithai, and add their name."},
  {href: "/qsr", label: "Upstairs", title: "Restaurant", text: "The kitchen's menu, for the table or to take home."},
];

const MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=Mishran%2C%20H-4%2F3%20Main%20Market%2C%20Model%20Town-II%2C%20Delhi%20110009";

function packSrc(name: string) {
  return `/brand/packs/${name}.jpg`;
}

export function MishranHome() {
  return (
    <div className="ms-bleed">
      {/* Hero: nutmeg, the Mithai Library. */}
      <section className="ms-on-nutmeg">
        <div className="ms-wrap ms-hero-in">
          <div className="ms-hero-copy">
            <p className="ms-label">Model Town · Delhi</p>
            <h1 className="ms-display">Honest Indian mithai</h1>
            <p className="ms-lead">
              Made by hand by our karigars, with milk from our own dairy in Jhajjar.
            </p>
            <div className="ms-row">
              <Link className="ms-btn ms-btn-on-dark" href="/gifts">
                See the Mithai Library
              </Link>
              <Link className="ms-more" href="/mithai">
                Shop the counter
              </Link>
            </div>
          </div>
          <figure className="ms-hero-media">
            <Image
              src={packSrc("library")}
              alt="The Mithai Library open: eight small boxes in a drawer, each named in Devanagari and a second script."
              width={1600}
              height={1227}
              sizes="(max-width: 800px) 100vw, 55vw"
              priority
            />
          </figure>
        </div>
      </section>

      {/* ArtBand: the Pichwai marigolds; मिश्रण means a blend. */}
      <section className="ms-artband">
        <Image
          className="ms-artband-img"
          src={packSrc("marigold")}
          alt=""
          fill
          sizes="100vw"
        />
        <div className="ms-wrap ms-artband-in">
          <div className="ms-panel ms-stack">
            <p className="ms-hindi ms-hindi--maroon" lang="hi">
              मिश्रण
            </p>
            <h2 className="ms-headline ms-maroon">Our milk, our karigars, India&apos;s crafts</h2>
            <p className="ms-body">
              <span lang="hi">मिश्रण</span> means a blend. Ours is three things: milk from our
              own dairy in Jhajjar, the hands of our karigars, and boxes drawn from India&apos;s
              crafts.
            </p>
            <Link className="ms-btn ms-btn-primary" href="/stories">
              Our story
            </Link>
          </div>
        </div>
        <p className="ms-artband-credit">The Pichwai card, from the Pichwai Selection</p>
      </section>

      {/* Crafts grid: one tile per pack. */}
      <section className="ms-on-cream ms-section">
        <div className="ms-wrap ms-stack-lg">
          <header className="ms-head">
            <p className="ms-label">The boxes</p>
            <h2 className="ms-headline">India&apos;s crafts, in a box of mithai</h2>
            <p className="ms-lead">
              Each of our gift boxes is drawn from one Indian craft, and says where it comes from.
            </p>
          </header>
          <div className="ms-grid ms-grid-3">
            {PACKS.map((pack) => (
              <Link key={pack.img} className="ms-card" href="/gifts">
                <figure className="ms-card-media ms-wide">
                  <Image
                    src={packSrc(pack.img)}
                    alt=""
                    width={pack.width}
                    height={pack.height}
                    sizes="(max-width: 560px) 100vw, (max-width: 960px) 50vw, 400px"
                  />
                </figure>
                <p className="ms-label ms-muted">{pack.place}</p>
                <h3 className="ms-title">{pack.craft}</h3>
                <p className="ms-caption">{pack.box}</p>
              </Link>
            ))}
          </div>
          <p>
            <Link className="ms-more" href="/gifts">
              All the boxes
            </Link>
          </p>
        </div>
      </section>

      {/* JourneySteps: from Jhajjar to the counter. */}
      <section className="ms-on-nutmeg ms-section">
        <div className="ms-wrap ms-stack-lg">
          <header className="ms-head">
            <p className="ms-label">From our own dairy in Jhajjar</p>
            <h2 className="ms-headline">From Jhajjar to the counter</h2>
          </header>
          <ol className="ms-steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="ms-step">
                <figure className="ms-step-media">
                  <Image
                    src={packSrc(step.img)}
                    alt={step.alt}
                    width={step.width}
                    height={step.height}
                    sizes="(max-width: 560px) 100vw, (max-width: 960px) 50vw, 300px"
                  />
                </figure>
                <p className="ms-step-n">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="ms-title">{step.title}</h3>
                <p className="ms-caption">{step.text}</p>
              </li>
            ))}
          </ol>
          <p>
            <Link className="ms-more" href="/stories/farms">
              Our dairy
            </Link>
          </p>
        </div>
      </section>

      {/* The counter's doors into the shop. */}
      <section className="ms-on-cream ms-section">
        <div className="ms-wrap ms-stack-lg">
          <header className="ms-head">
            <p className="ms-label">The shop</p>
            <h2 className="ms-headline">Order from the counter</h2>
          </header>
          <ul className="ms-doors">
            {DOORS.map((door) => (
              <li key={door.href}>
                <Link className="ms-door" href={door.href}>
                  <span className="ms-label ms-muted">{door.label}</span>
                  <span className="ms-title">{door.title}</span>
                  <span className="ms-caption">{door.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Visit: deep gold, DROP IN. */}
      <section className="ms-on-gold">
        <div className="ms-wrap ms-field-in ms-field-in--center">
          <h2 className="ms-display ms-cream">Drop in</h2>
          <div className="ms-panel ms-stack">
            <p className="ms-label ms-muted">The shop</p>
            <address className="ms-body ms-address">
              H-4/3, Main Market, Model Town-II, North Delhi, Delhi-110009
            </address>
            <p className="ms-body">The mithai counter downstairs, the restaurant upstairs.</p>
            <a className="ms-btn ms-btn-primary" href={MAP_URL} target="_blank" rel="noopener noreferrer">
              See the map
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default MishranHome;
