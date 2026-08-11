// lib/leads-api.ts
// Pure handler for POST /api/leads. Extracted from the route module so tests
// can call it directly without spinning up a dev server. The route file at
// app/api/leads/route.ts is a thin wrapper that just re-exports this.
//
// Flow:
//   1. Parse + validate JSON body (type, contact.name, contact.email required).
//   2. Create a lead in Payload's `leads` collection (status: "new").
//   3. Fire-and-forget a Resend notification to the ops inbox. Failures are
//      logged inside sendLeadNotification but do NOT fail the request — the
//      lead is already persisted and that's what the user paid for.
//   4. Return { leadId, message } with 201.
//
// Route precedence note: Payload mounts a catchall at app/(payload)/api/[...slug].
// Next.js route specificity picks this concrete app/api/leads/route.ts over the
// catchall — verified at runtime by the integration test.
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";
import { sendLeadNotification } from "@/lib/email";

const OPS_INBOX = process.env.LEADS_INBOX ?? "ops@mishran.shop";

interface LeadRequestBody {
  type?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    GSTIN?: string;
  };
  payload?: unknown;
  source?: string;
}

/**
 * POST /api/leads — create a lead and notify ops.
 * Returns 201 on success, 400 on validation error, 500 on unexpected failure.
 */
export async function handleLeadPost(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as LeadRequestBody;

    if (!body?.type || !body?.contact?.email || !body?.contact?.name) {
      return NextResponse.json(
        { error: "missing required fields: type, contact.name, contact.email" },
        { status: 400 },
      );
    }

    const payload = await getPayload();
    const created = await payload.create({
      collection: "leads",
      data: {
        type: body.type,
        contact: body.contact,
        payload: body.payload ?? {},
        status: "new",
        source: body.source ?? "unknown",
      },
    });

    // Best-effort notification. Failure here does NOT fail the request —
    // the lead is already persisted.
    await sendLeadNotification(OPS_INBOX, created as never);

    return NextResponse.json(
      {
        leadId: created.id,
        message: "Lead received. We'll be in touch.",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/leads]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
