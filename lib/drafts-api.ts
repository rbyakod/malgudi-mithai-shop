// lib/drafts-api.ts
// Pure handlers for /api/drafts endpoints (POST, GET, PUT). Extracted from
// route modules so tests can call them directly without HTTP fetch.
// Route files at app/api/drafts/route.ts and app/api/drafts/[sessionId]/route.ts
// are thin wrappers that just re-export these.
//
// Flow:
//   POST /api/drafts           — create a draft with expiresAt = now + 30d.
//                                On duplicate sessionId (Mongo 11000), upsert.
//   GET  /api/drafts/[id]      — fetch draft by sessionId. 404 if missing,
//                                410 if expired (TTL index usually deletes
//                                first, but guard anyway).
//   PUT  /api/drafts/[id]      — update config; refreshes expiresAt on every
//                                write to extend TTL on user activity.
//
// Race note: the POST upsert-on-11000 path is not atomic. Two concurrent
// requests with the same sessionId could both pass the unique check, one wins
// the insert and the other falls back to update — acceptable since drafts are
// session-scoped and idempotent on config.
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload-client";

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface DraftRequestBody {
  sessionId?: string;
  config?: unknown;
}

interface DraftDoc {
  id: string;
  sessionId: string;
  config: unknown;
  expiresAt: string;
  convertedToLead?: string | { id: string } | null;
}

function isErrorWithCode(err: unknown): err is { code: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "number"
  );
}

/**
 * POST /api/drafts — create a draft with 30-day TTL.
 * Returns 201 on create, 200 on upsert (duplicate sessionId), 400 if missing.
 */
export async function handleDraftPost(req: Request): Promise<Response> {
  let body: DraftRequestBody;
  try {
    body = (await req.json()) as DraftRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body?.sessionId) {
    return NextResponse.json(
      { error: "sessionId required" },
      { status: 400 },
    );
  }

  const payload = await getPayload();
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  const config = body.config ?? {};

  // Check existence first so we can branch create-vs-update without relying on
  // a Mongo 11000 (Payload wraps unique-violations as ValidationError, which
  // is shape-fragile to detect). Two concurrent POSTs with the same sessionId
  // could both see "not found" and race on create — the loser throws 11000,
  // which we catch below and convert to an update. Acceptable: drafts are
  // session-scoped and idempotent on config.
  const existing = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: body.sessionId } },
  });
  const doc = existing.docs[0] as DraftDoc | undefined;

  if (doc) {
    const updated = (await payload.update({
      collection: "drafts",
      id: doc.id,
      data: { config, expiresAt },
    })) as DraftDoc;
    return NextResponse.json(
      { id: updated.id, sessionId: body.sessionId, expiresAt },
      { status: 200 },
    );
  }

  try {
    const created = (await payload.create({
      collection: "drafts",
      data: { sessionId: body.sessionId, config, expiresAt },
    })) as DraftDoc;
    return NextResponse.json(
      { id: created.id, sessionId: body.sessionId, expiresAt },
      { status: 201 },
    );
  } catch (err: unknown) {
    // Lost a concurrent-create race (Mongo 11000 or Payload's unique
    // ValidationError wrapper). Fall back to update.
    if (isErrorWithCode(err) && err.code === 11000) {
      return handleDuplicateFallback(body.sessionId, config, expiresAt);
    }
    if (isPayloadUniqueValidationError(err)) {
      return handleDuplicateFallback(body.sessionId, config, expiresAt);
    }
    console.error("[api/drafts POST]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

async function handleDuplicateFallback(
  sessionId: string,
  config: unknown,
  expiresAt: string,
): Promise<Response> {
  const payload = await getPayload();
  const existing = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: sessionId } },
  });
  const doc = existing.docs[0] as DraftDoc | undefined;
  if (!doc) {
    // Edge case: lost the race but the doc vanished before re-read.
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
  const updated = (await payload.update({
    collection: "drafts",
    id: doc.id,
    data: { config, expiresAt },
  })) as DraftDoc;
  return NextResponse.json(
    { id: updated.id, sessionId, expiresAt },
    { status: 200 },
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
 * GET /api/drafts/[sessionId] — fetch a draft.
 * 404 if missing, 410 if expired, 200 with draft otherwise.
 */
export async function handleDraftGet(
  _req: Request,
  args: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await args.params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: sessionId } },
  });

  if (result.docs.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const doc = result.docs[0] as DraftDoc;
  // TTL index usually deletes expired docs first, but guard against a race.
  if (new Date(doc.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json(doc);
}

/**
 * PUT /api/drafts/[sessionId] — update config.
 * Refreshes expiresAt on every write so active sessions live longer.
 * 404 if missing, 200 with updated draft otherwise.
 */
export async function handleDraftPut(
  req: Request,
  args: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await args.params;
  let body: { config?: unknown };
  try {
    body = (await req.json()) as { config?: unknown };
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const payload = await getPayload();
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  const result = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: sessionId } },
  });

  if (result.docs.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = (await payload.update({
    collection: "drafts",
    id: result.docs[0].id,
    data: { config: body.config ?? {}, expiresAt },
  })) as DraftDoc;
  return NextResponse.json(updated);
}
