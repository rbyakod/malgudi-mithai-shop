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
      // The design system's Button: primary when chosen, secondary otherwise.
      className={["ms-btn ms-chip", active ? "ms-btn-primary" : "ms-btn-secondary"].join(" ")}
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
    <div className="mt-10 grid gap-8">
      {/* Controls — search input + freshness select: the design system's Field. */}
      <div className="ms-form-grid ms-mithai-controls">
        <div className="ms-fieldset">
          <label htmlFor="mithai-search">{tSearch("label")}</label>
          <input
            id="mithai-search"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={tSearch("placeholder")}
            data-testid="mithai-search-input"
            className="ms-input"
          />
        </div>
        <div className="ms-fieldset">
          <label htmlFor="mithai-freshness">{t("freshnessLabel")}</label>
          <select
            id="mithai-freshness"
            value={freshness}
            onChange={(event) =>
              updateParams({
                freshness:
                  event.target.value === ALL ? null : event.target.value,
              })
            }
            data-testid="mithai-freshness-select"
            className="ms-input"
          >
            <option value={ALL}>{t("freshnessAll")}</option>
            {FRESHNESS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`freshness.${option}` as const)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Family chips — the 5 canonical families */}
      <div
        className="ms-chip-row"
        role="group"
        aria-label={t("familyLabel")}
      >
        <span className="ms-label ms-muted">
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
        className="ms-catalog-bar ms-caption ms-muted"
        data-testid="mithai-results-count"
      >
        {searching ? tSearch("searching") : t("count", {count: visible.length})}
      </p>

      {/* Grid — or the empty state */}
      {visible.length === 0 ? (
        <div className="ms-panel ms-stack ms-panel--line">
          <p className="ms-body">
            {items.length === 0 ? emptyLabel : tSearch("noResults")}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setInput("");
                updateParams({q: null, family: null, freshness: null});
              }}
              className="ms-btn ms-btn-primary"
            >
              {tSearch("clear")}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className={gridClassName}>
          {visible.map((item) => (
            <li key={item.id} data-agent-card="catalog">
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
