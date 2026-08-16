// app/api/cart-drafts/[sessionId]/route.ts
// GET endpoint for a single cart draft by sessionId (email-link restore —
// conversion batch, Batch A). Logic lives in lib/cart-drafts-api.ts so it
// can be tested without HTTP; this file is a thin re-export. The response
// omits email + customerId.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts.
export { handleCartDraftGet as GET } from "@/lib/cart-drafts-api";
