// app/sitemap.ts
// Dynamic sitemap.xml for Mishran.
//
// Generates one <url> per (locale × doc) for the 3 locked locales
// (en, hi, kn) across the `mithai-products` and `stories` collections, plus
// the static hubs (home, /mithai, /stories) per locale.
//
// Drafts handling — the Stories collection has `versions: {drafts: true}`,
// which means Payload exposes a system `_status` field. We filter to
// `_status: "published"` so drafts never reach the sitemap. `mithai-products`
// also enables drafts in MithaiProducts.ts; filter there too for parity.
//
// Priority/lastModified per task-20-brief.md:
//   - home: 1.0, mithai hub: 0.9, mithai PDP: 0.8
//   - stories hub: 0.7, story detail: 0.6
//   - changeFrequency: weekly everywhere (static pages would otherwise be
//     monthly, but the editorial cadence is weekly and Google tolerates it).
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

type Doc = {slug?: string; updatedAt?: string; _status?: string};

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
    entries.push({
      url: `${base}/${locale}/mithai`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    });
    entries.push({
      url: `${base}/${locale}/stories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
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
