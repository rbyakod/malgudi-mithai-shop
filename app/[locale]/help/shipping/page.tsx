// app/[locale]/help/shipping/page.tsx
// Shipping & delivery policy. The fee figures are rendered FROM CONFIG
// (lib/config.ts deliveryFee*Paise, the same source the /cart/validate API
// prices from) and interpolated into the copy — the page can never drift
// from what checkout actually charges. Copy in messages under
// Legal.shipping. Indexable.

import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {LegalPage} from "@/components/legal/LegalPage";
import {config} from "@/lib/config";
import {formatPaise} from "@/lib/web/format";

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations("Legal.shipping");
  return {title: t("title"), description: t("intro")};
}

export default async function ShippingPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  return (
    <LegalPage
      namespace="shipping"
      values={{
        freshFee: formatPaise(config.deliveryFeeFreshPaise),
        shelfFee: formatPaise(config.deliveryFeeShelfStablePaise),
      }}
    />
  );
}
