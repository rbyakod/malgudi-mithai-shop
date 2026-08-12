// app/[locale]/merch/page.tsx
// Merch vertical hub — lists docs from the `merch-products` collection.

import {VerticalHub} from "@/components/verticals/VerticalHub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  await params;
  return <VerticalHub collection="merch-products" vertical="merch" />;
}
