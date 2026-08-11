// Integration test: POST /api/leads handler.
// Calls the extracted handler function directly (no dev server / HTTP fetch)
// so it runs cleanly under Vitest. Verifies the lead is created in Payload
// and the handler returns 201 + leadId. Cleans up the lead after assertions
// to avoid DB accumulation across runs.
//
// Env: MONGODB_URI from .env.local via tests/setup-integration.ts.
// RESEND_API_KEY is empty in dev, so sendLeadNotification logs + skips.
import { describe, it, expect } from "vitest";
import { handleLeadPost } from "@/lib/leads-api";
import { getPayload } from "@/lib/payload-client";

describe("POST /api/leads handler", () => {
  it("creates a lead and returns 201 + leadId", async () => {
    const source = `test-${Date.now()}`;
    const req = new Request("http://test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "wedding",
        contact: {
          name: "Test Lead",
          email: "test-lead@example.com",
          phone: "+919999999999",
        },
        payload: { qty: 100 },
        source,
      }),
    });

    const res = await handleLeadPost(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.leadId).toBeTruthy();
    expect(body.message).toContain("Lead received");

    // Clean up: remove the test lead so re-runs don't accumulate.
    const payload = await getPayload();
    await payload.delete({ collection: "leads", id: body.leadId });
  });

  it("rejects missing required fields with 400", async () => {
    const req = new Request("http://test/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "wedding" }), // missing contact
    });

    const res = await handleLeadPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required fields/i);
  });
});
