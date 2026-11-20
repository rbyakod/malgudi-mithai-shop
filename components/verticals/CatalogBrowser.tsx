"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import Image from "next/image";
import {Link} from "@/i18n/navigation";
import {toast} from "sonner";
import {splitPriceLabel} from "@/lib/ms-price";
import {useCart} from "@/context/CartContext";
import {track} from "@/lib/analytics";
import {
  isFullWidthLayout,
  normalizeCatalogPageSize,
  type StorefrontLayoutMode,
} from "@/lib/storefront-layout";

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
  pageSize?: number;
};

type SortKey = "featured" | "name-asc" | "name-desc";

export function CatalogBrowser({
  items,
  emptyLabel,
  layoutMode = "fixed",
  pageSize,
}: Props) {
  const {addItem} = useCart();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const [page, setPage] = useState(1);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  // Plain number, matching window.setTimeout's DOM return type —
  // ReturnType<typeof window.setTimeout> resolves differently under
  // server-side lib resolution and fails the VPS build's type check.
  const addedTimerRef = useRef<number | null>(null);
  const isFullWidth = isFullWidthLayout(layoutMode);
  const normalizedPageSize = normalizeCatalogPageSize(pageSize);
  const gridClassName = [
    "grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3",
    isFullWidth ? "xl:grid-cols-4 2xl:grid-cols-5" : "",
  ].join(" ");

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) {
        window.clearTimeout(addedTimerRef.current);
      }
    };
  }, []);

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
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / normalizedPageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * normalizedPageSize;
  const pagedItems = visibleItems.slice(pageStart, pageStart + normalizedPageSize);
  const firstVisible = visibleItems.length === 0 ? 0 : pageStart + 1;
  const lastVisible = Math.min(pageStart + pagedItems.length, visibleItems.length);

  if (items.length === 0) {
    return <p className="ms-body ms-muted mt-16">{emptyLabel}</p>;
  }

  return (
    <div className="mt-10 grid gap-8">
      {/* Search, filter and sort: the design system's Field. */}
      <div className="ms-form-grid ms-catalog-controls">
        <div className="ms-fieldset">
          <label htmlFor="catalog-search">Search</label>
          <input
            id="catalog-search"
            className="ms-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search sweets, snacks, tags"
          />
        </div>
        <div className="ms-fieldset">
          <label htmlFor="catalog-filter">Filter</label>
          <select
            id="catalog-filter"
            className="ms-input"
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            {tags.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
        <div className="ms-fieldset">
          <label htmlFor="catalog-sort">Sort</label>
          <select
            id="catalog-sort"
            className="ms-input"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setPage(1);
            }}
          >
            <option value="featured">Featured</option>
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
          </select>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="ms-panel ms-stack ms-panel--line">
          <p className="ms-body">No items match your search.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTag("all");
              setSort("featured");
            }}
            className="ms-btn ms-btn-primary"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="ms-catalog-bar">
            <p className="ms-caption ms-muted">
              Showing {firstVisible}-{lastVisible} of {visibleItems.length}
            </p>
            {pageCount > 1 ? (
              <div className="ms-row">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                  className="ms-btn ms-btn-secondary"
                >
                  Previous
                </button>
                <span className="ms-weight">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={currentPage === pageCount}
                  className="ms-btn ms-btn-secondary"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>

          <ul className={gridClassName}>
          {pagedItems.map((item) => {
            const price = item.priceLabel ? splitPriceLabel(item.priceLabel) : null;
            return (
            <li key={item.id} data-agent-card="catalog">
              {/* The design system's ProductCard, with Quick add and View under it. */}
              <article className="ms-card ms-card--actions">
                <Link href={item.href} aria-label={item.title} tabIndex={-1}>
                  <figure className="ms-card-media ms-card-media--fill">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
                        className="object-cover kb-drift"
                      />
                    ) : (
                      <span aria-hidden="true" className="ms-card-glyph">
                        {(item.title[0] ?? "M").toUpperCase()}
                      </span>
                    )}
                  </figure>
                </Link>
                {item.tag ? <p className="ms-label ms-muted">{item.tag}</p> : null}
                <Link href={item.href} className="ms-card-link">
                  <h3 className="ms-title">{item.title}</h3>
                </Link>
                {item.description ? (
                  <p className="ms-caption ms-clamp-2">{item.description}</p>
                ) : null}
                <div className="ms-card-meta">
                  {price ? (
                    <span className="ms-price">
                      <span className="ms-rupee">₹</span>
                      {price.amount}
                      {price.unit ? <span className="ms-weight"> {price.unit}</span> : null}
                    </span>
                  ) : item.priceLabel ? (
                    <span className="ms-caption">{item.priceLabel}</span>
                  ) : <span />}
                  {item.freshness ? <span className="ms-weight">{item.freshness}</span> : null}
                </div>
                <div className="ms-row ms-card-actions">
                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        id: item.id,
                        name: item.title,
                        priceLabel: item.priceLabel,
                        image: item.image ?? "",
                      });
                      setAddedItemId(item.id);
                      if (addedTimerRef.current) {
                        window.clearTimeout(addedTimerRef.current);
                      }
                      addedTimerRef.current = window.setTimeout(() => {
                        setAddedItemId(null);
                      }, 1800);
                      toast.success(`${item.title} added to cart`);
                      track("add_to_cart", {id: item.id, name: item.title, source: "catalog"});
                    }}
                    aria-live="polite"
                    className="ms-btn ms-btn-primary"
                  >
                    {addedItemId === item.id ? "Added" : "Quick add"}
                  </button>
                  <Link href={item.href} className="ms-more">
                    View
                  </Link>
                </div>
              </article>
            </li>
            );
          })}
          </ul>
        </>
      )}
    </div>
  );
}

export default CatalogBrowser;
