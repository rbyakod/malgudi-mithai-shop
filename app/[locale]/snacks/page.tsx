// app/[locale]/snacks/page.tsx
// Snacks vertical hub — lists docs from the `snack-products` collection.

import {VerticalHub} from "@/components/verticals/VerticalHub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  await params;
  return <VerticalHub collection="snack-products" vertical="snacks" />;
}
