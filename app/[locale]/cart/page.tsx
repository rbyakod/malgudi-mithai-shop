// app/[locale]/cart/page.tsx
// Cart stub — replaces the legacy editable cart. Commerce launches in
// Phase 8; until then, the cart renders read-only contents (via the
// <CartItems /> client island) inside the branded <CommerceStub /> shell.
// WhatsApp + weddings CTAs route customers to the events team in the
// meantime.

import {CommerceStub} from "@/components/commerce/CommerceStub";
import {CartItems} from "@/components/commerce/CartItems";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CartPage({params}: Props) {
  // Touch params so the page renders dynamically per locale.
  await params;
  return (
    <CommerceStub namespace="cart">
      <CartItems />
    </CommerceStub>
  );
}
