// vercel.ts
// Project-level Vercel deployment configuration. Vercel reads this file when
// the project is linked (via `vercel link` or the dashboard) instead of, or in
// addition to, a vercel.json. We use the TS form so the config is type-checked
// at build time against @vercel/config's VercelConfig schema.
//
// Why this file exists (and what each knob does):
//   - framework: "nextjs" → Vercel auto-detects, but pinning avoids misdetects
//     when a stray config file appears.
//   - buildCommand: matches package.json's `npm run build` (Next 16 + Payload).
//   - regions: ["bom1"] → Mumbai. Lowest latency for the primary audience
//     (Indian-sweets buyers in India). Trade-off: a single region means a
//     slower TTFB for visitors from the EU/US. Acceptable for this brand's
//     traffic distribution; revisit if international orders grow. See
//     docs/deployment.md for the full trade-off discussion.
//   - functions: bump maxDuration on the routes that do real work (Payload
//     queries, Resend send, on-demand revalidate). 30s matches the Hobby
//     plan's serverless-function ceiling and is well under the Pro ceiling.
//   - crons: none yet. The brief specifies [] here; if we add scheduled jobs
//     (e.g. a nightly Payload jobs:run cron), wire them in migrate-style here.
//
// Routes listed below are matched against the on-disk App Router route files.
// Keep this list in sync if you add a new long-running API route. Verified
// against: app/api/{leads,drafts,search,revalidate}/route.ts.
import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",
  regions: ["bom1"],
  functions: {
    "app/api/leads/route.ts": { maxDuration: 30 },
    "app/api/drafts/route.ts": { maxDuration: 30 },
    "app/api/search/route.ts": { maxDuration: 30 },
    "app/api/revalidate/route.ts": { maxDuration: 30 },
  },
  crons: [],
};
