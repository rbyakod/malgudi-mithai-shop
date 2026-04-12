"use client";

import Image from "next/image";
import { useState } from "react";
import { Header } from "@/components/Header";
import { useCart } from "@/context/CartContext";

type Sweet = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  pricePerUnit: string;
  approxPieces: string;
  shelfLife: string;
  storage: string;
  allergens: string;
  tags: string[];
  image: string;
  thumbnails: string[];
  isBestseller?: boolean;
  isNew?: boolean;
};

export function SweetDetailClient({ sweet }: { sweet: Sweet }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  return (
    <div className="relative z-10 min-h-screen text-text-primary">
      <Header />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 text-[11px] text-text-muted sm:text-xs"
        >
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <a href="/" className="hover:text-primary">
                Home
              </a>
            </li>
            <li className="mx-1 text-text-breadcrumb">/</li>
            <li>
              <a href="/sweets" className="hover:text-primary">
                Sweets
              </a>
            </li>
            <li className="mx-1 text-text-breadcrumb">/</li>
            <li className="text-text-secondary">{sweet.name}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section aria-label={`${sweet.name} gallery`}>
            <div className="relative h-72 w-full overflow-hidden rounded-3xl border border-border-card bg-bg-card shadow-sm sm:h-80">
              <Image
                src={sweet.image}
                alt={sweet.name}
                fill
                sizes="(min-width: 1024px) 480px, (min-width: 640px) 60vw, 90vw"
                className="object-cover"
              />
              {sweet.isBestseller && (
                <span className="absolute left-4 top-4 rounded-full bg-bg-darker/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-light">
                  Bestseller
                </span>
              )}
              {sweet.isNew && (
                <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-on-gold">
                  New
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {sweet.thumbnails.map((thumb) => (
                <div
                  key={thumb}
                  className="relative h-20 overflow-hidden rounded-2xl border border-border-card bg-bg-card"
                >
                  <Image
                    src={thumb}
                    alt={`${sweet.name} thumbnail`}
                    fill
                    sizes="(min-width: 1024px) 480px, (min-width: 640px) 60vw, 90vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>

          <section
            aria-label={`${sweet.name} details`}
            className="flex flex-col gap-4 rounded-3xl border border-border-card bg-bg-card p-5 shadow-sm"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-primary">
                Malgudi Sweets
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-text-primary sm:text-3xl">
                {sweet.name}
              </h1>
              <p className="mt-2 text-xs text-text-muted sm:text-sm">
                {sweet.shortDescription}
              </p>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-primary">
                  {sweet.pricePerUnit}
                </p>
                <p className="text-[11px] text-text-muted">
                  {sweet.approxPieces}
                </p>
              </div>
              <p className="text-[11px] text-text-muted">
                Inclusive of all taxes • Delivery charges calculated at checkout
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-input bg-bg-control px-3 py-1.5 text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Ships in 1–2 days
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border-input bg-bg-control px-3 py-1.5 text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-gold" />
                Fresh, small‑batch mithai
              </div>
            </div>

            <form className="mt-2 space-y-3">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label
                    htmlFor="quantity"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Quantity (boxes)
                  </label>
                  <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="mt-1 w-24 rounded-lg border border-border-input bg-bg-control px-3 py-2 text-xs text-text-heading outline-none ring-primary/20 focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Add a short note (optional)
                  </label>
                  <input
                    id="message"
                    name="message"
                    className="mt-1 w-full rounded-lg border border-border-input bg-bg-control px-3 py-2 text-xs text-text-heading outline-none ring-primary/20 focus:ring-2 sm:w-72"
                    placeholder="e.g. Happy Diwali from the Sharma family"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-full bg-bg-darker px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-text-light shadow-sm transition hover:bg-text-heading"
                  type="button"
                  onClick={() =>
                    addItem(
                      {
                        id: sweet.slug,
                        name: sweet.name,
                        priceLabel: sweet.pricePerUnit,
                        image: sweet.image,
                      },
                      qty
                    )
                  }
                >
                  Add to cart
                </button>
                <button className="rounded-full border border-border-input bg-bg-control px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary hover:border-primary/70">
                  Add to Diwali hamper
                </button>
                <p className="text-[11px] text-text-muted">
                  Need bulk or corporate pricing?{" "}
                  <a href="#bulk" className="font-semibold text-primary">
                    Talk to our team
                  </a>
                  .
                </p>
              </div>
            </form>

            <div className="mt-2 grid gap-4 border-t border-border-card pt-4 text-[11px] text-text-muted sm:grid-cols-2">
              <div>
                <h2 className="text-xs font-semibold text-text-secondary">
                  Shelf life & storage
                </h2>
                <p className="mt-1">{sweet.shelfLife}</p>
                <p className="mt-1">{sweet.storage}</p>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-text-secondary">
                  Allergens
                </h2>
                <p className="mt-1">{sweet.allergens}</p>
                <h3 className="mt-3 text-xs font-semibold text-text-secondary">
                  Tags
                </h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {sweet.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-bg-accent px-2 py-0.5 text-[10px] font-medium text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2 border-t border-border-card pt-4">
              <h2 className="text-xs font-semibold text-text-secondary">
                About this sweet
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted sm:text-sm">
                {sweet.longDescription}
              </p>
            </div>
          </section>
        </div>

        <section
          id="bulk"
          className="mt-10 rounded-3xl border border-border-card bg-bg-darker px-5 py-6 text-text-light sm:px-6 sm:py-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                Bulk & gifting
              </p>
              <h2 className="mt-1 text-sm font-semibold sm:text-base">
                Planning {sweet.name} for your office, wedding, or Diwali gifting?
              </h2>
              <p className="mt-1 text-[11px] text-text-light-muted sm:text-xs">
                We offer custom assortments, branded sleeves, and coordinated
                delivery across multiple locations. Share your details and our
                team will get back within one business day.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-[11px] sm:text-xs">
              <a
                href="https://wa.me/919876543210"
                className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2 font-semibold uppercase tracking-[0.16em] text-text-on-gold hover:bg-gold-hover"
              >
                Chat on WhatsApp
              </a>
              <p className="text-text-light-muted">
                Or email{" "}
                <a
                  href="mailto:gifting@malgudisweets.in"
                  className="font-semibold"
                >
                  gifting@malgudisweets.in
                </a>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
