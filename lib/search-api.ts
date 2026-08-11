// lib/search-api.ts
// Pure handler for GET /api/search. Extracted from the route module so tests
// can call it directly without HTTP fetch (fetching localhost would require a
// running dev server, which Vitest does not start). The route file at
// app/api/search/route.ts is a thin wrapper that just re-exports this.
//
// Flow:
//   1. Parse + validate `q` (trimmed, >= 2 chars) and `limit` (default 20).
//   2. Query 5 collections in parallel via `Promise.all` (the brief's
//      sequential `for ... await` was needlessly slow — the queries are
//      independent). Each collection queries with `where: contains` on its
//      label field (name or title).
//   3. Merge + slice to `limit`. NOTE: each collection is queried with the
//      full `limit`, so up to `5 * limit` docs are fetched, then sliced to
//      `limit`. This is wasteful at high limits but keeps the code trivial —
//      see "Limit inefficiency" in the task-12 report. A follow-up should
//      either fetch `limit / 5` per collection or merge-rank by relevance.
//   4. Map each doc to `SearchResult` (kind, id, slug, label, snippet).
//
// Route precedence note: Payload mounts a catchall at app/(payload)/api/[...slug].
// Next.js route specificity picks this concrete app/api/search/route.ts over
// the catchall — same pattern as /api/leads and /api/drafts.
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";

/** Unified search result returned across all collections. */
export interface SearchResult {
  /** Collection family: mithai, story, qsr, snack, merch. */
  kind: string;
  /** Payload doc id (Mongo ObjectId string). */
  id: string | number;
  /** Stable URL slug if the collection defines one. */
  slug?: string;
  /** Primary label: collection's title-ish field (name or title). */
  label: string;
  /** Short descriptive snippet: excerpt, ingredients, or description. */
  snippet: string;
}

/** Per-collection query config. `snippetKeys` are tried in order, first hit wins. */
interface CollectionConfig {
  slug: string;
  labelKey: string;
  kind: string;
  snippetKeys: string[];
}

export const COLLECTIONS: readonly CollectionConfig[] = [
  {
    slug: "mithai-products",
    labelKey: "name",
    kind: "mithai",
    snippetKeys: ["ingredients"],
  },
  {
    slug: "stories",
    labelKey: "title",
    kind: "story",
    snippetKeys: ["excerpt"],
  },
  {
    slug: "qsr-menu-items",
    labelKey: "name",
    kind: "qsr",
    snippetKeys: ["description"],
  },
  {
    slug: "snack-products",
    labelKey: "name",
    kind: "snack",
    snippetKeys: ["description"],
  },
  {
    slug: "merch-products",
    labelKey: "name",
    kind: "merch",
    snippetKeys: ["description"],
  },
] as const;

/** A Payload doc is treated as an opaque record for safe field access. */
type SearchableDoc = Record<string, unknown>;

function readStringField(doc: SearchableDoc, key: string): string | undefined {
  const v = doc[key];
  return typeof v === "string" ? v : undefined;
}

function firstSnippet(
  doc: SearchableDoc,
  keys: readonly string[],
): string {
  for (const k of keys) {
    const v = readStringField(doc, k);
    if (v) return v;
  }
  return "";
}

/**
 * GET /api/search?q=...&limit=20 — unified search across 5 collections.
 * Returns 200 with `{ results: SearchResult[] }`. Empty `q` or `q` shorter
 * than 2 chars returns `{ results: [] }` without hitting the DB.
 */
export async function handleSearchGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 20;

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const payload = await getPayload();

  // Parallel queries across all configured collections. Each collection
  // queries with the full `limit` — wasteful at high limits but trivial
  // code. See file header for the follow-up note.
  const perCollection = await Promise.all(
    COLLECTIONS.map(async (c) => {
      const result = await payload.find({
        collection: c.slug,
        where: { [c.labelKey]: { contains: q } },
        limit,
      });
      return { config: c, docs: result.docs as SearchableDoc[] };
    }),
  );

  const results: SearchResult[] = [];
  for (const { config, docs } of perCollection) {
    for (const doc of docs) {
      const label = readStringField(doc, config.labelKey) ?? "";
      const slug = readStringField(doc, "slug");
      results.push({
        kind: config.kind,
        id: (doc.id as string | number) ?? "",
        slug,
        label,
        snippet: firstSnippet(doc, config.snippetKeys),
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, limit) });
}
