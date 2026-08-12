// app/api/drafts/[sessionId]/route.ts
// GET + PUT endpoints for a single draft by sessionId. Logic lives in
// lib/drafts-api.ts so it can be tested without HTTP.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts.
export { handleDraftGet as GET, handleDraftPut as PUT } from "@/lib/drafts-api";
