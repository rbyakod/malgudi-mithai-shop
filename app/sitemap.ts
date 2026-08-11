// app/sitemap.ts
// Dynamic sitemap.xml for Mishran.
//
// Generates one <url> per (locale × doc) for the 3 locked locales
// (en, hi, kn) across all five Payload content collections, plus the
// static hubs (home, vertical hubs, lead pages, commerce stubs) per locale.
//
// Collections covered:
//   - mithai-products  (drafts enabled → filter to _status: "published")
//   - stories          (drafts enabled → filter to _status: "published")
//   - qsr-menu-items   (no drafts → no filter)
//   - snack-products   (no drafts → no filter)
//   - merch-products   (no drafts → no filter)
//
// Drafts handling — when a collection has `versions: {drafts: true}`,
// Payload exposes a system `_status` field. We filter to `_status:
// "published"` so drafts never reach the sitemap. Collections without
// drafts (qsr-menu-items, snack-products, merch-products) are always live.
//
// Priority/lastModified per task-20-brief.md + task-24 should-fix:
//   - home: 1.0
//   - vertical hubs (/mithai, /qsr, /snacks, /merch): 0.9
//   - vertical PDPs (/mithai/X, /qsr/X, /snacks/X, /merch/X): 0.8
//   - /stories hub: 0.7, story detail: 0.6
//   - lead pages (/weddings, /corporate): 0.5
//   - commerce stubs (/cart, /checkout, /account, /track-order): 0.3
//   - changeFrequency: weekly everywhere.
//
// ISR: Next.js re-evaluates sitemap.ts on the same revalidate schedule as
// page routes. `next dev` re-runs on every hit; production caches per
// `revalidate` if we add one. For now we let Next's default cache.

import type {MetadataRoute} from "next";
import {getPayload} from "@/lib/payload-client";

const LOCALES = ["en", "hi", "kn"] as const;

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

type Doc = {slug?: string; name?: string; updatedAt?: string; _status?: string};

// Slugify mirrors the route-level `slugify()` in `app/[locale]/qsr/[slug]/page.tsx`
// (and snacks/merch siblings). Those collections have no `slug` field — the
// detail route's URL is `slugify(name)`. We replicate the exact transform
// here so the sitemap emits URLs that resolve.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Static hubs per locale. Priorities per task-24 should-fix spec.
// `changeFrequency: "weekly"` matches the editorial cadence.
type Hub = {path: string; priority: number};

const VERTICAL_HUBS: Hub[] = [
  {path: "mithai", priority: 0.9},
  {path: "qsr", priority: 0.9},
  {path: "snacks", priority: 0.9},
  {path: "merch", priority: 0.9},
  {path: "stories", priority: 0.7},
];

const LEAD_PAGES: Hub[] = [
  {path: "weddings", priority: 0.5},
  {path: "corporate", priority: 0.5},
];

const COMMERCE_STUBS: Hub[] = [
  {path: "cart", priority: 0.3},
  {path: "checkout", priority: 0.3},
  {path: "account", priority: 0.3},
  {path: "track-order", priority: 0.3},
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload();
  const base = siteUrl();

  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  // Static hubs per locale.
  for (const locale of LOCALES) {
    entries.push({
      url: `${base}/${locale}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    });
    for (const hub of [...VERTICAL_HUBS, ...LEAD_PAGES, ...COMMERCE_STUBS]) {
      entries.push({
        url: `${base}/${locale}/${hub.path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: hub.priority,
      });
    }
  }

  // Mithai PDPs — drafts-enabled, filter to published.
  for (const locale of LOCALES) {
    const r = await payload.find({
      collection: "mithai-products",
      limit: 200,
      locale,
      where: {_status: {equals: "published"}},
    });
    for (const doc of r.docs as Doc[]) {
      if (!doc.slug) continue;
      entries.push({
        url: `${base}/${locale}/mithai/${doc.slug}`,
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // QSR detail pages — no drafts, do NOT filter by _status. These collections
  // have no `slug` field; the detail route uses `slugify(name)` as the URL.
  for (const locale of LOCALES) {
    const r = await payload.find({
      collection: "qsr-menu-items",
      limit: 200,
      locale,
    });
    for (const doc of r.docs as Doc[]) {
      if (!doc.name) continue;
      const slug = slugify(doc.name);
      if (!slug) continue;
      entries.push({
        url: `${base}/${locale}/qsr/${slug}`,
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Snacks detail pages — no drafts, do NOT filter by _status.
  for (const locale of LOCALES) {
    const r = await payload.find({
      collection: "snack-products",
      limit: 200,
      locale,
    });
    for (const doc of r.docs as Doc[]) {
      if (!doc.name) continue;
      const slug = slugify(doc.name);
      if (!slug) continue;
      entries.push({
        url: `${base}/${locale}/snacks/${slug}`,
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Merch detail pages — no drafts, do NOT filter by _status.
  for (const locale of LOCALES) {
    const r = await payload.find({
      collection: "merch-products",
      limit: 200,
      locale,
    });
    for (const doc of r.docs as Doc[]) {
      if (!doc.name) continue;
      const slug = slugify(doc.name);
      if (!slug) continue;
      entries.push({
        url: `${base}/${locale}/merch/${slug}`,
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Story details — drafts-enabled, filter to published.
  for (const locale of LOCALES) {
    const s = await payload.find({
      collection: "stories",
      limit: 200,
      locale,
      where: {_status: {equals: "published"}},
    });
    for (const doc of s.docs as Doc[]) {
      if (!doc.slug) continue;
      entries.push({
        url: `${base}/${locale}/stories/${doc.slug}`,
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
