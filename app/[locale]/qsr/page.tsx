// app/[locale]/qsr/page.tsx
// QSR vertical hub — lists docs from the `qsr-menu-items` collection.

import {VerticalHub} from "@/components/verticals/VerticalHub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function Page({params}: Props) {
  await params;
  return <VerticalHub collection="qsr-menu-items" vertical="qsr" />;
}
