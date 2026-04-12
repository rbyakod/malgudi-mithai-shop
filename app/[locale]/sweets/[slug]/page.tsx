"use client";

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
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

const sweets: Sweet[] = [
  {
    slug: "kaju-katli-royale",
    name: "Kaju Katli Royale",
    shortDescription:
      "Silky cashew fudge scented with saffron and cardamom, finished with silver vark.",
    longDescription:
      "Our Kaju Katli Royale reimagines the classic mithai with a smoother texture, higher cashew content, and a gentle balance of saffron and cardamom. Each piece is hand‑cut and finished with premium silver vark, making it perfect for festive gifting, weddings, or that one special box at home.",
    pricePerUnit: "₹699 / 500g",
    approxPieces: "Approx. 18–20 pieces per 500g box.",
    shelfLife: "Best within 7 days of delivery.",
    storage:
      "Store in a cool, dry place away from direct sunlight. Do not refrigerate; texture is best at room temperature.",
    allergens:
      "Contains nuts (cashews). May contain traces of almonds, pistachios, and gluten.",
    tags: ["Dry fruit", "Festive favourite", "Gift box friendly"],
    image: "/images/kaju-katli-hero.jpg",
    thumbnails: [
      "/images/kaju-katli-hero.jpg",
      "/images/kaju-katli-closeup.jpg",
      "/images/kaju-katli-box.jpg",
    ],
    isBestseller: true,
  },
];

type PageParams = {
  slug: string;
};

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const sweet = sweets.find((s) => s.slug === params.slug);
  if (!sweet) {
    return {
      title: "Malgudi Sweets",
    };
  }

  return {
    title: `${sweet.name} | Malgudi Sweets`,
    description: sweet.shortDescription,
  };
}

export default function SweetDetailPage({ params }: { params: PageParams }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const sweet = sweets.find((s) => s.slug === params.slug);

  if (!sweet) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#fdf7f0] text-[#1b0b07]">
      <Header />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 text-[11px] text-[#7a4f42] sm:text-xs"
        >
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <a href="/" className="hover:text-[#b94b4b]">
                Home
              </a>
            </li>
            <li className="mx-1 text-[#c49a7b]">/</li>
            <li>
              <a href="/sweets" className="hover:text-[#b94b4b]">
                Sweets
              </a>
            </li>
            <li className="mx-1 text-[#c49a7b]">/</li>
            <li className="text-[#5c372c]">{sweet.name}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section aria-label={`${sweet.name} gallery`}>
            <div className="relative h-72 w-full overflow-hidden rounded-3xl border border-[#f0d7bf] bg-[#fefaf5] shadow-sm sm:h-80">
              <Image
                src={sweet.image}
                alt={sweet.name}
                fill
                sizes="(min-width: 1024px) 480px, (min-width: 640px) 60vw, 90vw"
                className="object-cover"
              />
              {sweet.isBestseller && (
                <span className="absolute left-4 top-4 rounded-full bg-[#1b0b07]/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fdf7f0]">
                  Bestseller
                </span>
              )}
              {sweet.isNew && (
                <span className="absolute left-4 top-4 rounded-full bg-[#f0b35c] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1b0b07]">
                  New
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {sweet.thumbnails.map((thumb) => (
                <div
                  key={thumb}
                  className="relative h-20 overflow-hidden rounded-2xl border border-[#f0d7bf] bg-[#fefaf5]"
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
            className="flex flex-col gap-4 rounded-3xl border border-[#f0d7bf] bg-[#fefaf5] p-5 shadow-sm"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#b94b4b]">
                Malgudi Sweets
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[#1b0b07] sm:text-3xl">
                {sweet.name}
              </h1>
              <p className="mt-2 text-xs text-[#7a4f42] sm:text-sm">
                {sweet.shortDescription}
              </p>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-[#b94b4b]">
                  {sweet.pricePerUnit}
                </p>
                <p className="text-[11px] text-[#7a4f42]">
                  {sweet.approxPieces}
                </p>
              </div>
              <p className="text-[11px] text-[#7a4f42]">
                Inclusive of all taxes • Delivery charges calculated at checkout
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e5cbb2] bg-white px-3 py-1.5 text-[#5c372c]">
                <span className="h-2 w-2 rounded-full bg-[#b94b4b]" />
                Ships in 1–2 days
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e5cbb2] bg-white px-3 py-1.5 text-[#5c372c]">
                <span className="h-2 w-2 rounded-full bg-[#f0b35c]" />
                Fresh, small‑batch mithai
              </div>
            </div>

            <form className="mt-2 space-y-3">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label
                    htmlFor="quantity"
                    className="text-xs font-medium text-[#5c372c]"
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
                    className="mt-1 w-24 rounded-lg border border-[#e5cbb2] bg-white px-3 py-2 text-xs text-[#3b221b] outline-none ring-[#b94b4b]/20 focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="text-xs font-medium text-[#5c372c]"
                  >
                    Add a short note (optional)
                  </label>
                  <input
                    id="message"
                    name="message"
                    className="mt-1 w-full rounded-lg border border-[#e5cbb2] bg-white px-3 py-2 text-xs text-[#3b221b] outline-none ring-[#b94b4b]/20 focus:ring-2 sm:w-72"
                    placeholder="e.g. Happy Diwali from the Sharma family"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-full bg-[#1b0b07] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#fdf7f0] shadow-sm transition hover:bg-[#3b221b]"
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
                <button className="rounded-full border border-[#e5cbb2] bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#5c372c] hover:border-[#b94b4b]/70">
                  Add to Diwali hamper
                </button>
                <p className="text-[11px] text-[#7a4f42]">
                  Need bulk or corporate pricing?{" "}
                  <a href="#bulk" className="font-semibold text-[#b94b4b]">
                    Talk to our team
                  </a>
                  .
                </p>
              </div>
            </form>

            <div className="mt-2 grid gap-4 border-t border-[#f0d7bf] pt-4 text-[11px] text-[#7a4f42] sm:grid-cols-2">
              <div>
                <h2 className="text-xs font-semibold text-[#5c372c]">
                  Shelf life & storage
                </h2>
                <p className="mt-1">{sweet.shelfLife}</p>
                <p className="mt-1">{sweet.storage}</p>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-[#5c372c]">
                  Allergens
                </h2>
                <p className="mt-1">{sweet.allergens}</p>
                <h3 className="mt-3 text-xs font-semibold text-[#5c372c]">
                  Tags
                </h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {sweet.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#f7e0c9] px-2 py-0.5 text-[10px] font-medium text-[#7a4f42]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2 border-t border-[#f0d7bf] pt-4">
              <h2 className="text-xs font-semibold text-[#5c372c]">
                About this sweet
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#7a4f42] sm:text-sm">
                {sweet.longDescription}
              </p>
            </div>
          </section>
        </div>

        <section
          id="bulk"
          className="mt-10 rounded-3xl border border-[#f0d7bf] bg-[#1b0b07] px-5 py-6 text-[#fdf7f0] sm:px-6 sm:py-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b35c]">
                Bulk & gifting
              </p>
              <h2 className="mt-1 text-sm font-semibold sm:text-base">
                Planning {sweet.name} for your office, wedding, or Diwali gifting?
              </h2>
              <p className="mt-1 text-[11px] text-[#f7e0c9] sm:text-xs">
                We offer custom assortments, branded sleeves, and coordinated
                delivery across multiple locations. Share your details and our
                team will get back within one business day.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-[11px] sm:text-xs">
              <a
                href="https://wa.me/919876543210"
                className="inline-flex items-center justify-center rounded-full bg-[#f0b35c] px-5 py-2 font-semibold uppercase tracking-[0.16em] text-[#1b0b07] hover:bg-[#e2a349]"
              >
                Chat on WhatsApp
              </a>
              <p className="text-[#f7e0c9]">
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
