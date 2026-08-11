// app/[locale]/checkout/page.tsx
// Checkout stub — commerce launches in Phase 8. Renders the branded
// <CommerceStub /> with WhatsApp + weddings CTAs so customers can reserve
// orders manually in the meantime.

import {CommerceStub} from "@/components/commerce/CommerceStub";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CheckoutPage({params}: Props) {
  await params;
  return <CommerceStub namespace="checkout" />;
}
