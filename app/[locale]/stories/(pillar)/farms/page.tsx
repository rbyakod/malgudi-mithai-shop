// app/[locale]/stories/(pillar)/farms/page.tsx
// Pillar-filtered stories listing — farms → storage pillar "farm". The four
// pillar routes are static (not [pillar]) so they don't collide with the
// [slug] detail route. Shared rendering lives in PillarListing.

import {PillarListing} from "@/components/stories/PillarListing";

export const revalidate = 60;

type Props = {
  params: Promise<{locale: string}>;
};

export default async function FarmsPillarPage({params}: Props) {
  const {locale} = await params;
  return <PillarListing locale={locale} storagePillar="farm" />;
}
