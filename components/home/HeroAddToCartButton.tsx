// components/home/HeroAddToCartButton.tsx
// Inline hero add-to-cart — per-slide button reusing the project's
// AddToCartButton visual style (gold border, uppercase tracking) at hero
// card scale. Shared by the framed HeroRotator card and the CinematicHero
// product chip so both variants add the exact same cart payload.
"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import type {Slide} from "@/lib/home-hero";

export function HeroAddToCartButton({slide}: {slide: Slide}) {
  const t = useTranslations("HeroRotator");
  const {addItem} = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          id: slide.id,
          name: slide.name,
          priceLabel: slide.priceLabel ?? "",
          image: slide.image,
        });
        setAdded(true);
        track("hero_add_to_cart", {id: slide.id, name: slide.name});
        window.setTimeout(() => setAdded(false), 1800);
      }}
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-bg-control px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-bg-accent"
    >
      <span aria-hidden="true" className="text-gold">
        {added ? "✓" : "+"}
      </span>
      <span>{added ? t("added") : t("addToCart")}</span>
    </button>
  );
}

export default HeroAddToCartButton;
