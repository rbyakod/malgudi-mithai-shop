"use client";

// components/snacks/RetailerLink.tsx
// Client island for the snacks PDP's external retailer CTA — the page is a
// server component, but the click needs analytics. Same hairline idiom as
// the mithai add-to-cart button.

import {track} from "@/lib/analytics";

type Props = {
  label: string;
  url: string;
};

export function RetailerLink({label, url}: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="retailer-link"
      onClick={() => track("external_retailer_clicked", {label, url})}
      className="inline-flex items-center gap-3 border-y border-gold/60 bg-bg-control px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.18em] text-primary transition-colors hover:bg-bg-accent"
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-gold">
        ↗
      </span>
    </a>
  );
}

export default RetailerLink;
