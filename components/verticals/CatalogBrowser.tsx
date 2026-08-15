"use client";

import {useMemo, useState} from "react";
import Image from "next/image";
import {Link} from "@/i18n/navigation";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {isFullWidthLayout, type StorefrontLayoutMode} from "@/lib/storefront-layout";

export type CatalogItem = {
  id: string;
  title: string;
  href: string;
  image: string | null;
  tag: string | null;
  priceLabel: string;
  description: string;
  freshness: string;
  dietaryTags: string[];
};

type Props = {
  items: CatalogItem[];
  emptyLabel: string;
  layoutMode?: StorefrontLayoutMode;
};

type SortKey = "featured" | "name-asc" | "name-desc";

export function CatalogBrowser({items, emptyLabel, layoutMode = "fixed"}: Props) {
  const {addItem} = useCart();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const isFullWidth = isFullWidthLayout(layoutMode);
  const gridClassName = [
    "grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3",
    isFullWidth ? "xl:grid-cols-4 2xl:grid-cols-5" : "",
  ].join(" ");

  const tags = useMemo(
    () => Array.from(new Set(items.flatMap((item) => item.tag ? [item.tag] : []))).sort(),
    [items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesTag = tag === "all" || item.tag === tag;
      const searchable = [
        item.title,
        item.tag,
        item.priceLabel,
        item.description,
        item.freshness,
        ...item.dietaryTags,
      ].join(" ").toLowerCase();
      return matchesTag && (!normalizedQuery || searchable.includes(normalizedQuery));
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name-asc") return a.title.localeCompare(b.title);
      if (sort === "name-desc") return b.title.localeCompare(a.title);
      return 0;
    });
  }, [items, query, sort, tag]);

  if (items.length === 0) {
    return (
      <p className="mt-16 max-w-md text-sm italic leading-relaxed text-text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      <div className="grid gap-3 rounded-2xl border border-border-card bg-bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
        <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sweets, snacks, tags"
            className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors placeholder:text-text-muted focus:border-primary"
          />
        </label>
        <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
          Filter
          <select
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors focus:border-primary"
          >
            <option value="all">All</option>
            {tags.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors focus:border-primary"
          >
            <option value="featured">Featured</option>
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
          </select>
        </label>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-card bg-bg-card/50 p-8 text-center">
          <p className="text-sm text-text-muted">No items match your search.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTag("all");
              setSort("featured");
            }}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-text-light transition-colors hover:bg-primary-hover"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className={gridClassName}>
          {visibleItems.map((item) => (
            <li key={item.id}>
              <article className="group flex h-full flex-col border-t border-border-card pt-5 transition-colors hover:bg-bg-accent/30">
                <Link href={item.href} aria-label={item.title}>
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-border-image bg-bg-accent">
                    {item.image ? (
                      <>
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-bg-darker/35 via-transparent to-transparent" />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-bg-card">
                        <span className="flex h-24 w-24 items-center justify-center rounded-full border border-gold/40 bg-gold/15 font-display text-5xl font-light text-gold">
                          {(item.title[0] ?? "M").toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex flex-1 flex-col pt-4">
                  {item.tag ? (
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">
                      {item.tag}
                    </p>
                  ) : null}
                  <Link href={item.href}>
                    <h3 className="mt-2 font-display text-xl font-medium leading-snug tracking-tight text-text-heading">
                      {item.title}
                    </h3>
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                    {item.priceLabel ? <span>{item.priceLabel}</span> : null}
                    {item.freshness ? <span>{item.freshness}</span> : null}
                  </div>
                  {item.description ? (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-muted">
                      {item.description}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        addItem({
                          id: item.id,
                          name: item.title,
                          priceLabel: item.priceLabel,
                          image: item.image ?? "",
                        });
                        track("add_to_cart", {id: item.id, name: item.title, source: "catalog"});
                      }}
                      className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-text-light transition-colors hover:bg-primary-hover"
                    >
                      Quick add
                    </button>
                    <Link
                      href={item.href}
                      className="rounded-full border border-border-input px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CatalogBrowser;
