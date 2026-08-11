// app/[locale]/stories/(pillar)/karigari/page.tsx
// Pillar-filtered stories listing — karigari maps 1:1 to storage pillar.

import {PillarListing} from "@/components/stories/PillarListing";

export const revalidate = 60;

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KarigariPillarPage({params}: Props) {
  const {locale} = await params;
  return <PillarListing locale={locale} storagePillar="karigari" />;
}
