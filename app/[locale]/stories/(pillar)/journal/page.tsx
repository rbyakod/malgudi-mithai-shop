// app/[locale]/stories/(pillar)/journal/page.tsx
// Pillar-filtered stories listing — journal maps 1:1 to storage pillar.

import {PillarListing} from "@/components/stories/PillarListing";

export const revalidate = 60;

type Props = {
  params: Promise<{locale: string}>;
};

export default async function JournalPillarPage({params}: Props) {
  const {locale} = await params;
  return <PillarListing locale={locale} storagePillar="journal" />;
}
