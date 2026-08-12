# Mishran — Production Deployment Guide

This recipe takes the repository from a fresh clone to a live Vercel deploy
backed by MongoDB Atlas, with Payload CMS reachable at `/admin`.

It is written for a developer who has Vercel and MongoDB Atlas accounts but no
prior knowledge of this project. Stages that must be executed by a human
operator (because they need interactive auth or a paid account) are flagged
**manual**.

---

## 0. Prerequisites

- Node 22.x (matches the Vercel build image; `node -v`).
- A Vercel account with the project repo connected (or permission to connect).
- A MongoDB Atlas account (free M0 tier is fine to start).
- A Resend account + API key with a verified sending domain.
- The canonical production domain (e.g. `mishran.shop`) with DNS access.

---

## 1. MongoDB Atlas setup

1. **Create an M0 (free) cluster.**
   - Region: AWS Mumbai (`ap-south-1`) to match the Vercel `bom1` region.
     Cross-region latency between Atlas and the function is the single biggest
     page-speed lever for a Payload-backed site.
   - Name it `mishran-prod` (or similar). M0 is shared-tier — fine until
     traffic forces an upgrade to M10+ for VPC peering.

2. **Create a database user.**
   - Database Access → Add new user.
   - Username: `mishran-app`. Password: 32-char random (1Password / `openssl rand -base64 24`).
   - Role: `readWriteAnyDatabase` is fine for M0 (you can't scope to a single
     DB on the free tier). On M10+ scope to the `mishran` database only.
   - Save the password — it goes into `MONGODB_URI` in Step 3.

3. **Network access — IP allowlist.**
   - Network Access → Add IP address.
   - **Vercel's egress IPs are dynamic.** The M0 tier does not support VPC
     peering or static egress IPs from Vercel's side. The reliable path is to
     allow `0.0.0.0/0` (any IP).
   - **Security trade-off (read this):** `0.0.0.0/0` exposes the cluster to
     brute-force attempts from anywhere. Mitigations:
     - The DB user password is the only barrier — make it strong.
     - Atlas's built-in auth throttling + your strong password make brute-force
       impractical.
     - As soon as you upgrade to M10+, switch to VPC peering with Vercel
       (Vercel source network / private endpoints) and drop `0.0.0.0/0`.
   - **Do not** try to maintain a hand-curated list of Vercel egress IPs — it
     drifts and the site will go down on the next deploy.

4. **Get the connection string.**
   - Connect → Drivers → Node.js.
   - Replace `<password>` with the DB user password from step 2.
   - Add `?retryWrites=true&w=majority` (default from Atlas).
   - This is your `MONGODB_URI`.

---

## 2. Vercel project setup

1. **Import the repo.** Dashboard → Add New → Project → pick the Git repo.
2. **Framework preset:** Next.js (auto-detected).
3. **Root directory:** repo root (where `package.json` lives).
4. **Build command:** `npm run build` (matches `vercel.ts`).
5. **Install command:** `npm install`.
6. **Region:** `bom1` (Mumbai). Pinned in `vercel.ts`.

   **Why `bom1`:** primary audience is India; lowest TTFB for the audience
   that matters. Trade-off: a single region means EU/US visitors take an
   extra ~150–300 ms. Acceptable now; add a second region (e.g. `fra1` or
   `sfo1`) with `regions: ["bom1","fra1"]` if international orders grow.

7. **`vercel.ts` vs `vercel.json`:** This project uses `vercel.ts` (the
   type-checked TS form via `@vercel/config`). Vercel reads it automatically
   when present. You do **not** need a `vercel.json`.

---

## 3. Environment variables

Set these in the Vercel dashboard (Settings → Environment Variables) for
**both** Production and Preview environments unless noted.

| Key | Required in prod | Example | Notes |
|---|---|---|---|
| `MONGODB_URI` | yes | `mongodb+srv://mishran-app:...@cluster.mongodb.net/mishran?retryWrites=true&w=majority` | From Atlas step 1.4. |
| `PAYLOAD_SECRET` | yes | output of `openssl rand -hex 32` | JWT/session secret. Never reuse across envs. |
| `RESEND_API_KEY` | yes | `re_...` | Server-side. Send domain must be verified in Resend. |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://mishran.shop` | No trailing slash. Used by sitemap, robots, JSON-LD. |
| `LEADS_INBOX` | yes | `ops@mishran.shop` | Recipient for new-lead emails. Consumed by `lib/leads-api.ts`. Falls back to `ops@mishran.shop` if unset — set explicitly so the fallback is never relied on. |
| `REVALIDATE_SECRET` | yes | output of `openssl rand -hex 32` | On-demand ISR secret. Payload afterChange hooks send this as `x-revalidate-secret`. Without it, revalidate rejects. |
| `NEXT_PUBLIC_GA4_ID` | optional (fallback) | `G-XXXXXXX` | Fallback when Payload global is empty/unreadable. See "Analytics IDs" below. |
| `NEXT_PUBLIC_META_PIXEL_ID` | optional (fallback) | `1234567890` | Fallback when Payload global is empty/unreadable. See "Analytics IDs" below. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | recommended | `+919999999999` | Display only — the click-to-chat number on the site. |

### Analytics IDs — Payload global first, env-var fallback

The **primary** source for GA4 + Meta Pixel IDs is the Payload
`analytics-settings` global (fields `ga4Id`, `metaPixelId`). The server
component `components/Analytics/AnalyticsScripts.tsx` reads that global at
request time and inlines the GA4 + Meta Pixel bootstrap scripts.

- **Set these in the Payload admin UI** at
  `/admin/globals/analytics-settings`. If a value is present in the global,
  that value wins and the env-var fallback is skipped.
- If the global is empty/unreadable (DB down, build without DB, or just not
  configured yet), `AnalyticsScripts` falls back to the
  `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID` env vars. A one-time
  `console.warn` is logged so operators notice the fallback fired.
- If neither the global nor the env var yields an ID, the matching script is
  skipped (no broken injection). If neither ID is set anywhere, no tracking
  fires — `AnalyticsScripts` renders `null` and the `track()` helper is a
  no-op.

**When to use the env-var fallback:**
- Bootstrap deploys before the Payload admin UI is populated.
- Defensive redundancy if you don't fully trust the DB-backed global.

The `track()` helper itself only pushes to `window.dataLayer` / `fbq` — it does
not load the GA4/Pixel scripts. Script tags live in the layout and read from
the same Payload global + env-var fallback chain. (If the implementation
diverges from this paragraph, update it here — keep this as the single source
of truth.)

---

## 4. First deploy

1. Trigger a deploy from the Vercel dashboard (or push to the production
   branch). Watch the build logs.
2. **Expected:** `npm run build` completes without errors. Payload auto-creates
   its indexes on first boot (no separate `payload migrate` step is needed on
   a fresh database — the first successful admin request triggers index
   creation).
3. After the deploy finishes, hit `https://<your-project>.vercel.app/admin`.
   You should see the Payload admin **create-first-user** screen (see Step 5).

**Common first-deploy failures:**

- *`MONGODB_URI` not set or wrong password* → Payload throws a Mongo auth
  error during boot. Re-check Atlas user + connection string.
- *`0.0.0.0/0` not allowed in Atlas* → connection timeout from the function.
- *Build fails on `next build`* → usually a missing env var referenced at
  build time. `NEXT_PUBLIC_*` vars must be set in the Vercel project (not just
  `.env.local`).

---

## 5. Create the first admin user

**Important — Payload 3.87 has NO `payload create first-user` CLI command.**
The brief suggested `npx payload create first-user`; that command does not
exist in this version. The Payload CLI (`npx payload`) only exposes:

- `generate:db-schema`
- `generate:importmap`
- `generate:types`
- `info`
- `jobs:run` / `jobs:handle-schedules`
- `run`
- `migrate:create` / `migrate:status` / `migrate:up` / `migrate:down`

(Verify with `npx payload` once the project is linked.)

**Use the admin UI instead:**

1. Browse to `https://<your-domain>/admin`.
2. Payload detects an empty `users` collection and shows the
   **Create First User** screen.
3. Fill in the admin email, name, and a strong password. Submit.
4. You are now logged in as the first admin.

If you ever need to seed the first user non-interactively (e.g. for a fresh
staging env), write a small `scripts/seed-admin.ts` that calls
`payload.create({ collection: 'users', data: {...} })` and run it with
`npx tsx scripts/seed-admin.ts`. Do not put the password in the script — read
from `process.env.SEED_ADMIN_PASSWORD`.

---

## 6. Smoke tests

After the first admin is created, verify the core flows:

1. **Home page** — `https://<your-domain>/en` loads, hero renders, no console
   errors.
2. **Localized home** — `/hi`, `/ta` (or whichever locales are configured)
   render the translated strings.
3. **Admin** — `/admin` shows the dashboard. Create a test `mithai` doc,
   verify it appears at `/en/sweets/<slug>` after on-demand revalidate fires
   (the revalidate hook calls `/api/revalidate` with the secret).
4. **Lead capture** — POST to `/api/leads` with a valid body:
   ```jsonc
   {
     "type": "wedding",
     "contact": { "name": "Test", "email": "test@example.com" },
     "payload": {}
   }
   ```
   Expect `201` with `{ leadId, message }`. Verify the lead shows in
   Payload's `leads` collection and that an email arrived at `LEADS_INBOX`.
5. **Search** — `/api/search?q=kaju` returns JSON results.
6. **Drafts** — `POST /api/drafts` with `{ sessionId: "test", data: {...} }`
   persists; `GET /api/drafts/test` returns it.
7. **Sitemap + robots** — `/sitemap.xml` lists the homepage + localized
   variants; `/robots.txt` references the sitemap.

---

## 7. (Manual) Lighthouse

```bash
lhci autorun -- --collect.url=https://<vercel-preview>.vercel.app/en
```

Expected: Performance ≥ 90, Accessibility ≥ 95. The preview URL is preferred
to the prod URL so a slow database warmup doesn't tank the score. If
Performance is below target, check:
- Atlas region matches `bom1` (Step 1.1).
- Images use `next/image` with `priority` only on the LCP image.
- No render-blocking third-party scripts above analytics minimum.

---

## 8. Operational notes

- **Reindexing:** Payload manages indexes automatically on boot. If you ever
  need a manual rebuild, drop the `mishran` database in Atlas and let Payload
  re-bootstrap (destructive — only for a fresh environment).
- **Backups:** M0 has daily self-managed backups (point-in-time snapshot is
  M10+). For prod, set up `mongodump` to S3 / a cron, or upgrade to M10.
- **Logs:** Vercel function logs are in the dashboard (Functions tab). Payload
  logs at `info` level by default; raise via `PAYLOAD_LOG_LEVEL=debug` if
  debugging.
- **Region change:** if you move off `bom1`, also move the Atlas cluster to
  match — keep them in the same metro to avoid round-trips on every Payload
  call.

---

## Appendix: file map

| File | Purpose |
|---|---|
| `vercel.ts` | Vercel project config (TS form via `@vercel/config`). |
| `.env.example` | Authoritative list of env vars with examples + descriptions. |
| `next.config.mjs` | Next.js config (Payload + next-intl plugins). |
| `payload.config.ts` | Payload config (collections, globals, hooks). |
| `app/api/{leads,drafts,search,revalidate}/route.ts` | API routes pinned to 30s `maxDuration` in `vercel.ts`. |
| `lib/leads-api.ts` | Reads `LEADS_INBOX` (line 21). |
| `lib/revalidate-api.ts` | Reads `REVALIDATE_SECRET`. |
