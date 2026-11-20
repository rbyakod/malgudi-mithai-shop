// components/home/CounterPicks.tsx
// "Today at the counter": three mithai as the design system's ProductCard
// (picture, veg mark, name, ingredients, Price with a Tiro ₹). Featured
// products lead; the rest of the row fills from the catalog's priced
// products that have a picture. Async server component, best-effort read:
// the band is left out when the catalog cannot be read or is empty.

import Image from "next/image";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getPayload} from "@/lib/payload-client";
import {pdpHref} from "@/lib/verticals/pdpHref";
import {fallbackDocImage, firstDocImage} from "@/lib/verticals/catalogMedia";
import {splitPriceLabel, type PriceParts} from "@/lib/ms-price";

type Pick = {
  id: string;
  name: string;
  href: string;
  image: string;
  caption: string;
  veg: boolean;
  price: PriceParts;
};

const ROW = 3;

async function readPicks(): Promise<Pick[]> {
  let docs: Array<Record<string, unknown>> = [];
  try {
    const payload = await getPayload();
    // Featured first, then the classics: some featured items are priced "on
    // request" and are skipped below, so the row always has candidates to fill from.
    const [featured, classics] = await Promise.all([
      payload.find({collection: "mithai-products", where: {featured: {equals: true}}, limit: 12}),
      payload.find({collection: "mithai-products", where: {family: {equals: "classic"}}, limit: 24}),
    ]);
    docs = (featured.docs as Array<Record<string, unknown>>).concat(
      classics.docs as Array<Record<string, unknown>>,
    );
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const picks: Pick[] = [];
  for (const doc of docs) {
    const id = String(doc.id ?? doc.slug ?? "");
    if (!id || seen.has(id)) continue;
    const image = firstDocImage(doc, "mithai-products") ?? fallbackDocImage(doc, "mithai");
    const price = splitPriceLabel((doc.displayPrice as string | undefined) ?? "");
    // A counter card needs a picture and a price; "on request" items stay in the catalog.
    if (!image || !price) continue;
    seen.add(id);
    const tags = (doc.dietaryTags as string[] | null | undefined) ?? [];
    picks.push({
      id,
      name: (doc.name as string | undefined) ?? "",
      href: pdpHref(doc, "mithai-products"),
      image,
      caption: (doc.ingredients as string | undefined) ?? "",
      veg: tags.includes("vegetarian"),
      price,
    });
    if (picks.length === ROW) break;
  }
  return picks;
}

export async function CounterPicks() {
  const picks = await readPicks();
  if (picks.length === 0) return null;
  const t = await getTranslations("MsHome.counter");

  return (
    // data-agent-section is the AI team's hook for its Mithai Guide suggestions.
    <section className="ms-on-cream ms-section" aria-labelledby="mithai-hub-heading" data-agent-section="mithai">
      <div className="ms-wrap ms-stack-lg">
        <header className="ms-head">
          <p className="ms-label">{t("label")}</p>
          <h2 id="mithai-hub-heading" className="ms-headline">{t("title")}</h2>
        </header>
        <div className="ms-grid ms-grid-3">
          {picks.map((p) => (
            <Link key={p.id} className="ms-card" href={p.href}>
              <figure className="ms-card-media">
                <Image
                  src={p.image}
                  alt={p.name}
                  width={800}
                  height={800}
                  sizes="(max-width: 560px) 100vw, (max-width: 960px) 50vw, 400px"
                />
              </figure>
              <div className="ms-card-name">
                {p.veg ? <span className="ms-veg" role="img" aria-label={t("veg")} /> : null}
                <h3 className="ms-title">{p.name}</h3>
              </div>
              {p.caption ? <p className="ms-caption ms-clamp-2">{p.caption}</p> : null}
              <div className="ms-card-meta">
                <span className="ms-price">
                  <span className="ms-rupee">₹</span>
                  {p.price.amount}
                </span>
                {p.price.unit ? <span className="ms-weight">{p.price.unit}</span> : null}
              </div>
            </Link>
          ))}
        </div>
        <p>
          <Link className="ms-more" href="/mithai">
            {t("all")}
          </Link>
        </p>
      </div>
    </section>
  );
}
