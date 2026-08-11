// app/api/drafts/route.ts
// POST endpoint for draft cart/config persistence. Logic lives in
// lib/drafts-api.ts so it can be tested without HTTP.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts.
export { handleDraftPost as POST } from "@/lib/drafts-api";
