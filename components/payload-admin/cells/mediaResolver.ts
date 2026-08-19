"use client";

// The admin list view fetches rows with depth=0, so relation fields (e.g.
// images[0].image) arrive as bare ID strings instead of populated media
// documents. This resolver batches those IDs into /api/media queries and
// shares the results across every cell on the page via a module-level store,
// so a 20-row list costs one small request instead of 20 broken thumbnails.

export type ResolvedMedia = {url: string; alt?: string};

const BATCH_LIMIT = 50;
const FLUSH_MS = 40;

// undefined = not yet resolved, null = resolved as missing/failed,
// object = resolved media. Values keep stable references so
// useSyncExternalStore sees consistent snapshots.
const resolved = new Map<string, ResolvedMedia | null>();
const queued = new Set<string>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

async function flush() {
  flushTimer = null;
  const ids = [...queued];
  queued.clear();
  if (ids.length === 0) return;
  try {
    const query = `/api/media?limit=${BATCH_LIMIT}&depth=0&where[id][in]=${ids.join(",")}`;
    const res = await fetch(query, {credentials: "same-origin"});
    if (!res.ok) return; // leave unresolved; a later list view retries
    const json = (await res.json()) as {docs?: {id: string; url?: string; alt?: string}[]};
    const docs = json.docs ?? [];
    for (const doc of docs) {
      resolved.set(doc.id, doc.url ? {url: doc.url, alt: doc.alt || undefined} : null);
    }
    // Only mark IDs as missing when the response is complete (not truncated
    // by maxLimit pagination), otherwise leave them for a retry.
    if (docs.length === ids.length) {
      const found = new Set(docs.map((doc) => doc.id));
      for (const id of ids) {
        if (!found.has(id)) resolved.set(id, null);
      }
    }
    emit();
  } catch {
    // Network error: leave unresolved so the next list view retries.
  } finally {
    // If more IDs arrived while this batch was in flight, keep draining.
    if (queued.size > 0 && flushTimer === null) flushTimer = setTimeout(flush, 0);
  }
}

export function subscribeToMedia(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMedia(id: string): ResolvedMedia | null | undefined {
  return resolved.get(id);
}

/** Ask the store to resolve `id`; coalesces with other pending cells. */
export function requestMedia(id: string): void {
  if (resolved.has(id) || queued.has(id)) return;
  queued.add(id);
  if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
}
