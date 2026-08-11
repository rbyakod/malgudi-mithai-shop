"use client";

// components/mithai/AddToCartButton.tsx
// Client island for the mithai PDP's add-to-cart affordance.
//
// Why a separate client component: the PDP itself is a server component
// (it reads Payload and renders rich text), but cart state lives in the
// client-side CartContext. This button is the only interactive bit on the
// page, so it's the only client island — keeps the rest of the PDP on the
// server.
//
// Locale-aware label is passed in from the server parent so this island
// stays free of next-intl message lookup churn.

import {useTransition, useState} from "react";
import {useCart} from "@/context/CartContext";

type Props = {
  id: string;
  name: string;
  priceLabel: string;
  image: string;
  label: string;
  addedLabel: string;
};

export function AddToCartButton({
  id,
  name,
  priceLabel,
  image,
  label,
  addedLabel,
}: Props) {
  const {addItem} = useCart();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(() => {
      addItem({id, name, priceLabel, image});
      setAdded(true);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-live="polite"
      className="group inline-flex items-center justify-center gap-3 border-y border-gold/60 bg-bg-control px-8 py-4 font-display text-sm font-medium uppercase tracking-[0.22em] text-primary transition-colors hover:bg-bg-accent hover:text-primary-hover disabled:opacity-70"
    >
      <span aria-hidden="true" className="text-gold">
        {added ? "✓" : "+"}
      </span>
      <span>{added ? addedLabel : label}</span>
    </button>
  );
}

export default AddToCartButton;
