// app/[locale]/page.tsx
// Brand home — cinematic hero, four vertical portals, brand pillars strip.
// Server component. BrandHero / VerticalPortals / Pillars are async server
// components reading the Payload `brand-settings` global and next-intl.

import {BrandHero} from "@/components/home/BrandHero";
import {VerticalPortals} from "@/components/home/VerticalPortals";
import {Pillars} from "@/components/home/Pillars";
import {InlineScript} from "@/components/InlineScript";
import {organizationSchema, localBusinessSchema} from "@/lib/seo/schema";
import {isFullWidthLayout} from "@/lib/storefront-layout";
import {readStorefrontLayoutMode} from "@/lib/storefront-layout-server";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  // Touch params so Next.js treats the page as dynamically rendered per
  // locale (avoids static-shadowing the home across locales).
  await params;
  const layoutMode = await readStorefrontLayoutMode();

  // JSON-LD — safe: input is JSON.stringify of plain objects built from
  // static brand defaults; `<` is escaped to prevent script-context
  // breakout. Organization (global) + LocalBusiness (Bengaluru storefront)
  // for local-intent queries, as a valid top-level JSON array.
  const homeJsonLd = JSON.stringify([
    organizationSchema(),
    localBusinessSchema(),
  ]).replace(/</g, "\\u003c");

  return (
    <>
      <InlineScript id="home-jsonld" html={homeJsonLd} />
      {/* BrandHero owns its own bleed (it spans wider than the sections
          below and differs per hero style); the wrapper cancels main's
          padding for the remaining sections — exactly in full-width mode
          (main uses lg:px-10 2xl:px-14 there, so -mx-8 left a residue). */}
      <BrandHero layoutMode={layoutMode} />
      <div
        className={
          isFullWidthLayout(layoutMode)
            ? "-mx-4 -mt-4 sm:-mx-6 lg:-mx-10 2xl:-mx-14"
            : "-mx-4 -mt-4 sm:-mx-6 lg:-mx-8"
        }
      >
        <VerticalPortals />
        <Pillars />
      </div>
    </>
  );
}
