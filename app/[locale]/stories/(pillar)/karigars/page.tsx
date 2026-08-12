// app/[locale]/stories/(pillar)/karigars/page.tsx
// Pillar-filtered stories listing — karigars → storage pillar "karigar".

import {PillarListing} from "@/components/stories/PillarListing";

export const revalidate = 60;

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KarigarsPillarPage({params}: Props) {
  const {locale} = await params;
  return <PillarListing locale={locale} storagePillar="karigar" />;
}
