// app/api/search/route.ts
// GET endpoint for unified cross-collection search. Logic lives in
// lib/search-api.ts so it can be tested without HTTP.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts.
export { handleSearchGet as GET } from "@/lib/search-api";
