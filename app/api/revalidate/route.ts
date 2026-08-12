// app/api/revalidate/route.ts
// POST endpoint for on-demand ISR cache purge. Triggered by Payload
// afterChange hooks (see collections/_revalidate-hook.ts) on every doc save
// in production. Also callable manually with a {path} body.
//
// Logic lives in lib/revalidate-api.ts so it can be tested without HTTP.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts (Next.js route specificity).
export { handleRevalidatePost as POST } from "@/lib/revalidate-api";
