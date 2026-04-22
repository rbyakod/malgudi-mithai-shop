"use client";

import Image from "next/image";
import { useState } from "react";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { useCart } from "@/context/CartContext";
import { Link } from "@/i18n/navigation";

function parsePrice(label: string): number {
  const match = label.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

type Category =
  | "all"
  | "classic"
  | "dryfruit"
  | "bengali"
  | "sugarfree"
  | "seasonal";

type Sweet = {
  id: string;
  name: string;
  description: string;
  pricePerUnit: string;
  tags: string[];
  category: Category;
  image: string;
  isBestseller?: boolean;
  isNew?: boolean;
};

const sweets: Sweet[] = [
  {
    id: "kaju-katli-royale",
    name: "Kaju Katli Royale",
    description: "Silky cashew fudge with saffron and silver vark.",
    pricePerUnit: "₹699 / 500g",
    tags: ["Cashew", "Festive", "Gift box friendly"],
    category: "dryfruit",
    image: "/images/kaju-katli.jpg",
    isBestseller: true,
  },
  {
    id: "motichoor-laddoo",
    name: "Motichoor Laddoo",
    description: "Melt‑in‑mouth boondi laddoos roasted in desi ghee.",
    pricePerUnit: "₹549 / 500g",
    tags: ["Laddoo", "Festive"],
    category: "classic",
    image: "/images/motichoor-laddoo.jpg",
    isBestseller: true,
  },
  {
    id: "gulab-jamun-classic",
    name: "Gulab Jamun Classic",
    description: "Khoya dumplings in a warm cardamom‑rose syrup.",
    pricePerUnit: "₹499 / 6 pcs",
    tags: ["Syrup sweets", "Party favourite"],
    category: "classic",
    image: "/images/gulab-jamun.jpg",
    isBestseller: true,
  },
  {
    id: "besan-laddoo",
    name: "Besan Laddoo",
    description: "Slow‑roasted besan with ghee and crushed dry fruits.",
    pricePerUnit: "₹499 / 500g",
    tags: ["Laddoo"],
    category: "classic",
    image: "/images/besan-laddoo.jpg",
  },
  {
    id: "rasgulla-bengali",
    name: "Kolkata Rasgulla",
    description: "Soft chhena balls soaked in light sugar syrup.",
    pricePerUnit: "₹399 / 6 pcs",
    tags: ["Bengali", "Syrup sweets"],
    category: "bengali",
    image: "/images/rasgulla.jpg",
  },
  {
    id: "rasmalai",
    name: "Saffron Rasmalai",
    description: "Soft patties in chilled saffron‑pistachio rabdi.",
    pricePerUnit: "₹699 / 6 pcs",
    tags: ["Bengali", "Dessert"],
    category: "bengali",
    image: "/images/rasmalai.jpg",
  },
  {
    id: "sugarfree-kaju",
    name: "Sugar‑free Kaju Bites",
    description: "Stevia‑sweetened cashew bites for mindful indulgence.",
    pricePerUnit: "₹749 / 400g",
    tags: ["Sugar‑free", "Dry fruit"],
    category: "sugarfree",
    image: "/images/sugarfree-kaju.jpg",
    isNew: true,
  },
  {
    id: "badam-barfi",
    name: "Badam Barfi",
    description: "Rich almond fudge with a hint of cardamom.",
    pricePerUnit: "₹799 / 500g",
    tags: ["Dry fruit", "Festive"],
    category: "dryfruit",
    image: "/images/badam-barfi.jpg",
  },
  {
    id: "mango-peda",
    name: "Alphonso Mango Peda",
    description: "Seasonal peda infused with real Alphonso pulp.",
    pricePerUnit: "₹599 / 400g",
    tags: ["Seasonal", "Mango"],
    category: "seasonal",
    image: "/images/mango-peda.jpg",
    isNew: true,
  },
  {
    id: "pista-roll",
    name: "Pista Roll",
    description: "Layered pistachio and kaju roll with vark.",
    pricePerUnit: "₹849 / 500g",
    tags: ["Dry fruit", "Gift box friendly"],
    category: "dryfruit",
    image: "/images/ista-roll.jpg",
  },
];

const categories: { id: Category; label: string }[] = [
  { id: "all", label: "All sweets" },
  { id: "classic", label: "Classics" },
  { id: "dryfruit", label: "Dry fruit" },
  { id: "bengali", label: "Bengali" },
  { id: "sugarfree", label: "Sugar‑free" },
  { id: "seasonal", label: "Seasonal specials" },
];

export default function SweetsCatalogPage() {
  const { addItem } = useCart();
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState<string>("bestsellers");

  const filtered =
    activeCategory === "all"
      ? sweets
      : sweets.filter((s) => s.category === activeCategory);

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return parsePrice(a.pricePerUnit) - parsePrice(b.pricePerUnit);
      case "price-desc":
        return parsePrice(b.pricePerUnit) - parsePrice(a.pricePerUnit);
      case "new":
        return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      default:
        return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0);
    }
  });

  return (
    <div className="relative z-10 min-h-screen text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <Header />
        <main className="mt-4 flex flex-1 flex-col">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-primary">
                Our menu
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                Sweets & mithai catalog
              </h1>
              <p className="mt-2 max-w-xl text-xs text-text-muted sm:text-sm">
                Explore our full range of classic mithai, dry fruit specials,
                Bengali favourites, sugar‑free options, and seasonal creations,
                all handcrafted in small batches.
              </p>
            </div>
            <div className="hidden text-xs text-text-muted sm:block">
              <p className="font-semibold text-text-secondary">
                Same‑day delivery (Bengaluru)
              </p>
              <p>Cut‑off 3 PM for guaranteed delivery.</p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2 text-xs">
            {categories.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={[
                    "rounded-full border px-4 py-1.5 font-medium transition",
                    isActive
                      ? "border-primary bg-primary text-text-light"
                      : "border-border-input bg-bg-card text-text-secondary hover:border-primary/60",
                  ].join(" ")}
                  aria-pressed={isActive}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)]">
            <section aria-label="Sweets catalog" className="space-y-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <p>
                  Showing{" "}
                  <span className="font-semibold text-text-secondary">
                    {sorted.length}
                  </span>{" "}
                  of {sweets.length} sweets
                </p>
                <div className="flex items-center gap-2">
                  <label htmlFor="sort" className="sr-only">
                    Sort by
                  </label>
                  <select
                    id="sort"
                    name="sort"
                    className="rounded-full border border-border-input bg-bg-card px-3 py-1.5 text-[11px] text-text-secondary outline-none focus:ring-2 focus:ring-primary/30"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="bestsellers">Sort: Featured</option>
                    <option value="price-asc">Price: Low to high</option>
                    <option value="price-desc">Price: High to low</option>
                    <option value="new">New first</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((sweet, index) => (
                  <article
                    key={sweet.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border-card bg-bg-card shadow-card transition hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <Link
                      href={`/sweets/${sweet.id}`}
                      className="relative block h-40 w-full overflow-hidden bg-bg-accent"
                    >
                      <Image
                        src={sweet.image}
                        alt={sweet.name}
                        fill
                        loading={index < 2 ? "eager" : undefined}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 90vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      {(sweet.isBestseller || sweet.isNew) && (
                        <div className="absolute left-3 top-3 flex gap-2">
                          {sweet.isBestseller && (
                            <span className="rounded-full bg-bg-darker/85 px-2.5 py-1 text-[10px] font-semibold text-text-light">
                              Bestseller
                            </span>
                          )}
                          {sweet.isNew && (
                            <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-semibold text-text-on-gold">
                              New
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h2 className="text-sm font-semibold text-text-heading">
                        {sweet.name}
                      </h2>
                      <p className="text-xs leading-relaxed text-text-muted">
                        {sweet.description}
                      </p>
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
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <p className="text-sm font-semibold text-primary">
                          {sweet.pricePerUnit}
                        </p>
                        <button
                          className="rounded-full bg-bg-darker px-3 py-1.5 text-xs font-semibold text-text-light transition hover:bg-text-heading"
                          onClick={() =>
                            addItem(
                              {
                                id: sweet.id,
                                name: sweet.name,
                                priceLabel: sweet.pricePerUnit,
                                image: sweet.image,
                              },
                              1
                            )
                          }
                        >
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside
              aria-label="Filters and gifting information"
              className="space-y-6 rounded-3xl border border-border-card bg-bg-card p-5"
            >
              <div>
                <h2 className="text-sm font-semibold text-text-heading">
                  Filter by occasion
                </h2>
                <p className="mt-1 text-[11px] text-text-muted">
                  Looking for Diwali hampers, Rakhi boxes, or corporate gifting?
                  Start here.
                </p>
                <div className="mt-3 grid gap-2 text-[11px]">
                  <button className="flex items-center justify-between rounded-xl border border-border-input bg-bg-control px-3 py-2 text-left text-text-secondary hover:border-primary/70">
                    <span>Daily sweets</span>
                    <span className="text-[10px] text-text-muted">For home</span>
                  </button>
                  <button className="flex items-center justify-between rounded-xl border border-border-input bg-bg-control px-3 py-2 text-left text-text-secondary hover:border-primary/70">
                    <span>Festive gifting</span>
                    <span className="text-[10px] text-text-muted">Diwali, Rakhi</span>
                  </button>
                  <button className="flex items-center justify-between rounded-xl border border-border-input bg-bg-control px-3 py-2 text-left text-text-secondary hover:border-primary/70">
                    <span>Corporate hampers</span>
                    <span className="text-[10px] text-text-muted">Bulk orders</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-border-card pt-4 text-[11px] text-text-muted">
                <h2 className="text-sm font-semibold text-text-heading">
                  Storage & shelf life
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Most sweets stay fresh 2–4 days at room temperature.</li>
                  <li>Refrigerate Bengali sweets and cream‑based desserts.</li>
                  <li>Refer to individual packs for exact shelf life.</li>
                </ul>
              </div>

              <div className="border-t border-border-card pt-4 text-[11px] text-text-muted">
                <h2 className="text-sm font-semibold text-text-heading">
                  Need help choosing?
                </h2>
                <p className="mt-1">
                  WhatsApp our team for custom recommendations based on your
                  occasion, budget, and dietary preferences.
                </p>
                <button className="mt-3 w-full rounded-full bg-primary px-4 py-2 text-xs font-semibold text-text-light hover:bg-primary-hover">
                  Chat on WhatsApp
                </button>
              </div>
            </aside>
          </div>

        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
