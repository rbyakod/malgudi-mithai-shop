"use client";

// components/verticals/MithaiHubClient.tsx
// Client island for the /mithai hub — server-backed search + facets.
//
// Responsibilities (Batch 6):
//   - Debounced search input (min 2 chars) hitting GET /api/search, filtered
//     to kind === "mithai" and mapped back onto the server-fetched item list
//     so cards keep full data (image, price, href) instead of the search
//     endpoint's label/snippet shape.
//   - Family chips (the exact 5 MithaiProducts.family select options) plus a
//     freshness select, applied client-side over whatever the search returns.
//   - URL-synced state (?q=&family=&freshness=) so a filtered view is
//     shareable and bookmarkable — the URL is the source of truth.
//   - Fires the `search_used` analytics event (declared in lib/analytics.ts
//     since task 12, never fired before) on every actual search.
//
// The full list arrives as props from the server component (mithai/page.tsx);
// an empty query renders it untouched. Facets still apply with no query.

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";
import {useSearchParams} from "next/navigation";
import {usePathname, useRouter} from "@/i18n/navigation";
import {useTranslations} from "next-intl";
import {MediaCard} from "@/components/ui/MediaCard";
import {track} from "@/lib/analytics";
import type {CatalogItem} from "@/components/verticals/CatalogBrowser";
import {
  isFullWidthLayout,
  type StorefrontLayoutMode,
} from "@/lib/storefront-layout";

// The exact `family` select options from collections/MithaiProducts.ts.
const FAMILIES = [
  "classic",
  "original",
  "sugar-free",
  "regional",
  "seasonal",
] as const;

// The exact `freshnessStatus` select options from the same collection.
const FRESHNESS_OPTIONS = [
  "made-daily",
  "made-to-order",
  "batch-frozen",
] as const;

const ALL = "all";
const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;
// The endpoint merges all 5 collections then slices to `limit`; a generous
// limit keeps mithai results from being crowded out by the other kinds.
const SEARCH_LIMIT = 100;

type SearchHit = {
  kind: string;
  id: string | number;
  slug?: string;
};

type SearchResponse = {results: SearchHit[]};

type Props = {
  items: CatalogItem[];
  emptyLabel: string;
  layoutMode?: StorefrontLayoutMode;
};

/**
 * Map search-endpoint hits back onto the server-fetched items. Matched by
 * Payload doc id (both sides stringify it); the /mithai/<slug> href is the
 * fallback for shape drift. Non-mithai kinds and hits with no matching card
 * are dropped.
 */
function matchSearchResults(
  hits: SearchHit[],
  items: CatalogItem[],
): CatalogItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const byHref = new Map(items.map((item) => [item.href, item]));
  const matched: CatalogItem[] = [];
  for (const hit of hits) {
    if (hit.kind !== "mithai") continue;
    const item =
      byId.get(String(hit.id)) ??
      (hit.slug ? byHref.get(`/mithai/${hit.slug}`) : undefined);
    if (item && !matched.some((m) => m.id === item.id)) matched.push(item);
  }
  return matched;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-text-light"
          : "border-border-input bg-bg-control text-text-secondary hover:border-primary hover:text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function MithaiHubClient({
  items,
  emptyLabel,
  layoutMode = "fixed",
}: Props) {
  const t = useTranslations("MithaiHub");
  const tSearch = useTranslations("Search");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const q = searchParams.get("q")?.trim() ?? "";
  const family = searchParams.get("family") ?? ALL;
  const freshness = searchParams.get("freshness") ?? ALL;

  const [input, setInput] = useState(q);
  // One object for the whole search lifecycle, tagged with the query it
  // belongs to — the render below derives `searching`/`base` from it, so the
  // fetch effect never has to call setState synchronously in its body.
  const [searchState, setSearchState] = useState<
    | {phase: "idle"}
    | {phase: "done"; q: string; items: CatalogItem[]}
  >({phase: "idle"});
  // Guards against out-of-order responses when the query keeps changing.
  const requestIdRef = useRef(0);

  // Rewrite the hub URL preserving the other params. Null values drop the
  // key so clean state stays a clean URL.
  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const merged: Record<string, string | null> = {
        q: q || null,
        family: family !== ALL ? family : null,
        freshness: freshness !== ALL ? freshness : null,
        ...patch,
      };
      const next = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        if (value) next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, {scroll: false});
    },
    [family, freshness, pathname, q, router],
  );

  // Keep the input aligned with the URL (deep links, back/forward). This is
  // React's prescribed render-time adjustment for derived resets — setState
  // in an effect body here would cascade renders.
  const [lastQ, setLastQ] = useState(q);
  if (lastQ !== q) {
    setLastQ(q);
    setInput(q);
  }

  // Debounce input → URL. The URL change then drives the fetch effect below,
  // so one pause in typing settles into exactly one request.
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed === q) return;
    const timer = window.setTimeout(() => {
      updateParams({q: trimmed.length >= MIN_QUERY ? trimmed : null});
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input, q, updateParams]);

  // Active query → /api/search. Also runs on deep-link mount so a shared
  // ?q= URL renders the searched view immediately. All setState calls live in
  // async callbacks; "searching" is derived at render time below.
  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    const requestId = ++requestIdRef.current;
    track("search_used", {surface: "mithai-hub", query: q});
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`, {
      signal: controller.signal,
    })
      .then((res) =>
        res.ok ? (res.json() as Promise<SearchResponse>) : {results: []},
      )
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setSearchState({
          phase: "done",
          q,
          items: matchSearchResults(data.results, items),
        });
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setSearchState({phase: "done", q, items: []});
      });
    return () => controller.abort();
  }, [q, items]);

  // Results only apply while the URL still carries the query they answered;
  // anything else (short/cleared query, in-flight fetch, stale response)
  // falls back to the full server list with `searching` showing the spinner.
  const answeredCurrent =
    searchState.phase === "done" && searchState.q === q;
  const searching = q.length >= MIN_QUERY && !answeredCurrent;
  const base = q.length >= MIN_QUERY && answeredCurrent ? searchState.items : items;
  const visible = useMemo(
    () =>
      base.filter(
        (item) =>
          (family === ALL || item.tag === family) &&
          (freshness === ALL || item.freshness === freshness),
      ),
    [base, family, freshness],
  );

  const hasFilters = q !== "" || family !== ALL || freshness !== ALL;
  const isFullWidth = isFullWidthLayout(layoutMode);
  const gridClassName = [
    "grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3",
    isFullWidth ? "xl:grid-cols-4 2xl:grid-cols-5" : "",
  ].join(" ");

  return (
    <div className="mt-10 space-y-8">
      {/* Controls — search input + freshness select (mirrors CatalogBrowser) */}
      <div className="grid gap-3 rounded-2xl border border-border-card bg-bg-card p-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
          {tSearch("label")}
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={tSearch("placeholder")}
            data-testid="mithai-search-input"
            className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors placeholder:text-text-muted focus:border-primary"
          />
        </label>
        <label className="grid gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
          {t("freshnessLabel")}
          <select
            value={freshness}
            onChange={(event) =>
              updateParams({
                freshness:
                  event.target.value === ALL ? null : event.target.value,
              })
            }
            data-testid="mithai-freshness-select"
            className="h-11 rounded-full border border-border-input bg-bg-control px-4 text-sm font-normal normal-case tracking-normal text-text-heading outline-none transition-colors focus:border-primary"
          >
            <option value={ALL}>{t("freshnessAll")}</option>
            {FRESHNESS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`freshness.${option}` as const)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Family chips — the 5 canonical families */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t("familyLabel")}
      >
        <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
          {t("familyLabel")}
        </span>
        <Chip active={family === ALL} onClick={() => updateParams({family: null})}>
          {t("familyAll")}
        </Chip>
        {FAMILIES.map((option) => (
          <Chip
            key={option}
            active={family === option}
            onClick={() => updateParams({family: option})}
          >
            {t(`family.${option}` as const)}
          </Chip>
        ))}
      </div>

      {/* Count line */}
      <p
        className="border-y border-border-card py-3 text-xs text-text-muted"
        data-testid="mithai-results-count"
      >
        {searching ? tSearch("searching") : t("count", {count: visible.length})}
      </p>

      {/* Grid — or the empty state */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-card bg-bg-card/50 p-8 text-center">
          <p className="text-sm text-text-muted">
            {items.length === 0 ? emptyLabel : tSearch("noResults")}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setInput("");
                updateParams({q: null, family: null, freshness: null});
              }}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-text-light transition-colors hover:bg-primary-hover"
            >
              {tSearch("clear")}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className={gridClassName}>
          {visible.map((item) => (
            <li key={item.id}>
              <MediaCard
                title={item.title}
                href={item.href}
                image={item.image}
                tag={item.tag}
                priceLabel={item.priceLabel || null}
                blurb={item.description || null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MithaiHubClient;
