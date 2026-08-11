// app/[locale]/build-a-gift/page.tsx
// Gift-builder stub — the configurable gift-box builder launches with
// Phase 8 commerce. Until then this route renders the branded
// <CommerceStub /> shell (WhatsApp + weddings lead CTAs) so /build-a-gift
// links from the hero, nav, and footer resolve to a real page instead of 404.

import {CommerceStub} from "@/components/commerce/CommerceStub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function BuildAGiftPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  return <CommerceStub namespace="buildAGift" />;
}
