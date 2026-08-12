// app/[locale]/mithai/page.tsx
// Mithai vertical hub — lists docs from the `mithai-products` collection.

import {VerticalHub} from "@/components/verticals/VerticalHub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  // Touch params so Next.js treats the page as dynamic per locale.
  await params;
  return <VerticalHub collection="mithai-products" vertical="mithai" />;
}
