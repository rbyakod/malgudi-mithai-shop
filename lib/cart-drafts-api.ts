// lib/cart-drafts-api.ts
// Pure handlers for /api/cart-drafts endpoints — conversion batch, Batch A
// (A5). Extracted into lib (mirroring lib/drafts-api.ts) so tests call
// them directly without HTTP fetch; the route files are thin re-exports.
//
//   POST /api/cart-drafts          — upsert by sessionId (create 201 /
//                                     update 200). Partial body: only the
//                                     provided fields are written, so the
//                                     "Email me this cart" consent POST
//                                     ({email, marketingConsent}) never
//                                     wipes items. expiresAt is refreshed
//                                     to now+30d on every write and
//                                     lastActivityAt stamped (drives the
//                                     1h-abandoned cron window).
//                                     A valid customer bearer stamps
//                                     customerId — best-effort, never 401.
//   GET  /api/cart-drafts/[id]     — fetch a draft for email-link restore.
//                                     404 missing, 410 expired, 200 with
//                                     items/estimate. email + customerId
//                                     are omitted from the response.
//
// Rate limit: light, 30 POSTs/min per session via container.rateLimiter.
// The limiter needs Mongo; if it is unreachable the write proceeds
// (draft saves are fire-and-forget, resilience beats strictness) — only a
// genuine RATE_LIMITED verdict rejects.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload-client";
import { container } from "@/lib/container";
import { ApiError } from "@/lib/api/errors";

export const CART_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const Estimate = z.object({
  subtotalInPaise: z.number().int().min(0).nullable(),
  itemCount: z.number().int().min(0),
  tier: z.string().nullable(),
});

const PostBody = z.object({
  sessionId: z.string().min(1).max(128),
  items: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
  estimate: Estimate.optional(),
  email: z.string().email().max(320).optional(),
  marketingConsent: z.boolean().optional(),
  status: z.enum(["active", "converted"]).optional(),
});

interface CartDraftDoc {
  id: string;
  sessionId: string;
  customerId?: string | null;
  items?: unknown;
  estimate?: unknown;
  email?: string | null;
  marketingConsent?: boolean;
  status?: string;
  reminderSentAt?: string | null;
  lastActivityAt?: string;
  expiresAt: string;
}

function isErrorWithCode(err: unknown): err is { code: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "number"
  );
}

function isPayloadUniqueValidationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "data" in err &&
    typeof (err as { data?: { errors?: unknown[] } }).data === "object" &&
    Array.isArray((err as { data: { errors?: unknown[] } }).data.errors)
  );
}

/**
 * Best-effort customer stamp: a valid access bearer links the draft to the
 * signed-in customer. Invalid/absent tokens are silently ignored — this
 * endpoint is anonymous-first and must never 401.
 */
async function resolveOptionalCustomerId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const claims = await container.jwtService.verify(auth.slice(7), "access");
    return claims.customerId;
  } catch {
    return null;
  }
}

/** 30/min per session. Limiter infrastructure failures never block a save. */
async function rateLimitPost(sessionId: string): Promise<void> {
  try {
    await container.rateLimiter.check(`cart-drafts:post:${sessionId}`, 30, 60);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.warn("[api/cart-drafts] rate limiter unavailable; proceeding.", err);
  }
}

export async function handleCartDraftPost(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid cart-draft body",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    await rateLimitPost(body.sessionId);
  } catch {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const payload = await getPayload();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CART_DRAFT_TTL_MS).toISOString();
  const lastActivityAt = now.toISOString();
  const customerId = await resolveOptionalCustomerId(req);

  // Only provided fields are written (partial-update semantics).
  const patch: Record<string, unknown> = { lastActivityAt, expiresAt };
  if (body.items !== undefined) patch.items = body.items;
  if (body.estimate !== undefined) patch.estimate = body.estimate;
  if (body.email !== undefined) patch.email = body.email;
  if (body.marketingConsent !== undefined) patch.marketingConsent = body.marketingConsent;
  if (body.status !== undefined) patch.status = body.status;
  if (customerId) patch.customerId = customerId;

  // Check existence first (same approach + race caveat as lib/drafts-api).
  const existing = await payload.find({
    collection: "cart-drafts",
    where: { sessionId: { equals: body.sessionId } },
  });
  const doc = existing.docs[0] as CartDraftDoc | undefined;

  if (doc) {
    const updated = (await payload.update({
      collection: "cart-drafts",
      id: doc.id,
      data: patch,
    })) as CartDraftDoc;
    return NextResponse.json(
      { id: updated.id, sessionId: body.sessionId, status: updated.status ?? "active", expiresAt },
      { status: 200 },
    );
  }

  try {
    const created = (await payload.create({
      collection: "cart-drafts",
      data: {
        sessionId: body.sessionId,
        customerId: customerId ?? null,
        items: body.items ?? null,
        estimate: body.estimate ?? null,
        email: body.email ?? null,
        marketingConsent: body.marketingConsent ?? false,
        status: body.status ?? "active",
        lastActivityAt,
        expiresAt,
      },
    })) as CartDraftDoc;
    return NextResponse.json(
      { id: created.id, sessionId: body.sessionId, status: created.status ?? "active", expiresAt },
      { status: 201 },
    );
  } catch (err: unknown) {
    // Lost a concurrent-create race (Mongo 11000 / Payload unique wrapper).
    if (isErrorWithCode(err) && err.code === 11000) {
      return duplicateFallback(body.sessionId, patch);
    }
    if (isPayloadUniqueValidationError(err)) {
      return duplicateFallback(body.sessionId, patch);
    }
    console.error("[api/cart-drafts POST]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

async function duplicateFallback(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const payload = await getPayload();
  const existing = await payload.find({
    collection: "cart-drafts",
    where: { sessionId: { equals: sessionId } },
  });
  const doc = existing.docs[0] as CartDraftDoc | undefined;
  if (!doc) {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
  const updated = (await payload.update({
    collection: "cart-drafts",
    id: doc.id,
    data: patch,
  })) as CartDraftDoc;
  return NextResponse.json(
    { id: updated.id, sessionId, status: updated.status ?? "active", expiresAt: patch.expiresAt },
    { status: 200 },
  );
}

/**
 * GET /api/cart-drafts/[sessionId] — restore payload for the email link.
 * email + customerId are deliberately omitted (PII minimization); the
 * restore flow only needs items + estimate + status.
 */
export async function handleCartDraftGet(
  _req: Request,
  args: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await args.params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "cart-drafts",
    where: { sessionId: { equals: sessionId } },
  });

  if (result.docs.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const doc = result.docs[0] as CartDraftDoc;
  // TTL index usually deletes expired docs first, but guard the race.
  if (new Date(doc.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json({
    sessionId: doc.sessionId,
    items: doc.items ?? null,
    estimate: doc.estimate ?? null,
    status: doc.status ?? "active",
    lastActivityAt: doc.lastActivityAt ?? null,
    expiresAt: doc.expiresAt,
  });
}
