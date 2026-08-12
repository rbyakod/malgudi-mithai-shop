// app/[locale]/account/page.tsx
// Account stub — accounts launch with the Phase 8 commerce experience.
// Renders the branded <CommerceStub /> with WhatsApp + weddings CTAs so
// customers with order questions can reach the events team.

import {CommerceStub} from "@/components/commerce/CommerceStub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function AccountPage({params}: Props) {
  await params;
  return <CommerceStub namespace="account" />;
}
