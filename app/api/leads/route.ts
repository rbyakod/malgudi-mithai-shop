// app/api/leads/route.ts
// POST endpoint for public lead submissions (wedding/corporate/wholesale/etc.).
// Logic lives in lib/leads-api.ts so it can be tested without HTTP. See that
// file for validation, Payload create, and Resend notification flow.
//
// Route precedence: this concrete path wins over Payload's catchall at
// app/(payload)/api/[...slug]/route.ts. Verified at runtime by
// tests/integration/api-leads.test.ts.
export { handleLeadPost as POST } from "@/lib/leads-api";

// Audit D1: a concrete route exporting POST only made Next answer 405 for
// every other method — shadowing Payload's REST GET /api/leads and breaking
// the admin leads list + dashboard widget. The REST handler derives the
// collection from route params (not the URL), so a bare re-export of the
// catch-all GET 404s ("Route not found /api"). Instead, build Payload's
// REST GET with synthetic catch-all params pinned to the leads collection —
// identical to what /api/[...slug] does for this path, including session
// access control and query parsing.
import { REST_GET } from "@payloadcms/next/routes";
import config from "@payload-config";

const payloadLeadsGet = REST_GET(config);

export async function GET(request: Request): Promise<Response> {
  return payloadLeadsGet(request, { params: Promise.resolve({ slug: ["leads"] }) });
}
