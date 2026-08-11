// app/api/leads/route.ts
// POST endpoint for public lead submissions (wedding/corporate/wholesale/etc.).
// Logic lives in lib/leads-api.ts so it can be tested without HTTP. See that
// file for validation, Payload create, and Resend notification flow.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts. Verified at runtime by
// tests/integration/api-leads.test.ts.
export { handleLeadPost as POST } from "@/lib/leads-api";
