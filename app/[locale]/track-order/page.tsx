// app/[locale]/track-order/page.tsx
// Order tracking stub — launches with Phase 8 commerce. Renders the branded
// <CommerceStub /> with WhatsApp + weddings CTAs so customers needing
// immediate help can reach the events team with their order reference.

import {CommerceStub} from "@/components/commerce/CommerceStub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function TrackOrderPage({params}: Props) {
  await params;
  return <CommerceStub namespace="trackOrder" />;
}
