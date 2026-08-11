// app/robots.ts
// robots.txt for Mishran.
//
// Allow-all (no internal admin paths to hide — Payload's /admin/* is
// already noindexed by Payload itself). Point crawlers at the sitemap so
// the dynamic locale × product URLs are discoverable without inbound links.

import type {MetadataRoute} from "next";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {userAgent: "*", allow: "/"},
    sitemap: `${base}/sitemap.xml`,
  };
}
