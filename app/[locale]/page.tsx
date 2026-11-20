// app/[locale]/page.tsx
// Brand home, built from the Mishran Design System's modules (MishranHome).
// Server component.

import {MishranHome} from "@/components/home/MishranHome";
import {InlineScript} from "@/components/InlineScript";
import {organizationSchema, localBusinessSchema} from "@/lib/seo/schema";
import {getPrimaryStore} from "@/lib/store-info";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  // Touch params so Next.js treats the page as dynamically rendered per
  // locale (avoids static-shadowing the home across locales).
  await params;

  // JSON-LD — safe: input is JSON.stringify of plain objects built from
  // static brand defaults; `<` is escaped to prevent script-context
  // breakout. Organization (global) + LocalBusiness (the storefront, from Store Settings)
  // for local-intent queries, as a valid top-level JSON array.
  const store = await getPrimaryStore();
  const homeJsonLd = JSON.stringify([
    organizationSchema(),
    localBusinessSchema(store),
  ]).replace(/</g, "\\u003c");

  return (
    <>
      <InlineScript id="home-jsonld" html={homeJsonLd} />
      <MishranHome store={store} />
    </>
  );
}
