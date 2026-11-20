// app/[locale]/visit/page.tsx → /visit
// The shop in Model Town, Delhi, as the design system's website brief sets
// the Visit page: address, hours, map link · the counter downstairs, the
// restaurant upstairs · a way to ask before coming. The address and hours come
// from Store Settings (the design system's confirmed address when unset).

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {fullAddress, getPrimaryStore} from "@/lib/store-info";
import {HOUSE_ADDRESS} from "@/components/home/MishranHome";

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Visit");
  return {title: t("metaTitle"), description: t("lead")};
}

export default async function VisitPage({params}: Props) {
  await params;
  const t = await getTranslations("Visit");
  const store = await getPrimaryStore();
  const address = store && (store.address || store.city) ? fullAddress(store) : HOUSE_ADDRESS;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Mishran, ${address}`)}`;

  return (
    <div className="ms-bleed">
      <section className="ms-on-maroon ms-section">
        <div className="ms-wrap">
          <header className="ms-head">
            <p className="ms-label">{t("label")}</p>
            <h1 className="ms-display ms-cream">{t("title")}</h1>
            <p className="ms-lead">{t("lead")}</p>
          </header>
        </div>
      </section>

      <section className="ms-on-cream ms-section">
        <div className="ms-wrap ms-split">
          <div className="ms-stack">
            <p className="ms-label ms-muted">{t("addressLabel")}</p>
            <address className="ms-lead ms-address">{address}</address>
            <p className="ms-label ms-muted">{t("hoursLabel")}</p>
            <p className="ms-body">{store?.hours || t("hoursUnset")}</p>
            <a className="ms-btn ms-btn-primary" href={mapUrl} target="_blank" rel="noopener noreferrer">
              {t("map")}
            </a>
          </div>
          <ul className="ms-doors ms-doors--two">
            <li>
              <Link className="ms-door" href="/mithai">
                <span className="ms-label ms-muted">{t("downstairsLabel")}</span>
                <span className="ms-title">{t("downstairsTitle")}</span>
                <span className="ms-caption">{t("downstairsText")}</span>
                <span className="ms-more">{t("downstairsCta")}</span>
              </Link>
            </li>
            <li>
              <Link className="ms-door" href="/qsr">
                <span className="ms-label ms-muted">{t("upstairsLabel")}</span>
                <span className="ms-title">{t("upstairsTitle")}</span>
                <span className="ms-caption">{t("upstairsText")}</span>
                <span className="ms-more">{t("upstairsCta")}</span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="ms-on-nutmeg">
        <div className="ms-wrap ms-field-in ms-field-in--center">
          <header className="ms-head">
            <p className="ms-label">{t("askLabel")}</p>
            <h2 className="ms-headline">{t("askTitle")}</h2>
          </header>
          <div className="ms-stack">
            <p className="ms-body">{t("askText")}</p>
            <Link className="ms-btn ms-btn-on-dark" href="/help/contact">
              {t("askCta")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
