// app/api/cart-drafts/route.ts
// POST endpoint for cart-draft persistence (abandonment recovery —
// conversion batch, Batch A). Logic lives in lib/cart-drafts-api.ts so it
// can be tested without HTTP; this file is a thin re-export.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts.
export { handleCartDraftPost as POST } from "@/lib/cart-drafts-api";
