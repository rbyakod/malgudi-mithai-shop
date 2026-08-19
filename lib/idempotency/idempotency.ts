import { getPayload } from 'payload';
import { createHash } from 'node:crypto';
import config from '../../payload.config';
import { ApiError, ErrorCode } from '../api/errors';
import { NextResponse } from 'next/server';

export async function withIdempotency<T extends Response>(
  key: string | null,
  body: string,
  handler: () => Promise<T>,
): Promise<Response> {
  if (!key) return handler();

  const payload = await getPayload({ config });
  const hash = createHash('sha256').update(body).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const existing = await payload.find({ collection: 'idempotencyKeys', where: { key: { equals: key } }, limit: 1 });
  if (existing.docs[0]) {
    // idempotencyKeys doc fields this replay path reads (collections/IdempotencyKeys.ts).
    const doc = existing.docs[0] as {
      requestHash?: string;
      responseStatus?: number;
      responseBody?: unknown;
    };
    if (doc.requestHash !== hash) {
      const err = new ApiError(ErrorCode.CONFLICT, 'Idempotency key reused with different body');
      return NextResponse.json(err.toJSON(), { status: 409 });
    }
    return NextResponse.json(doc.responseBody, { status: doc.responseStatus });
  }

  const result = await handler();
  const cloned = result.clone();
  const text = await cloned.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep as text */ }
  await payload.create({
    collection: 'idempotencyKeys',
    data: { key, requestHash: hash, responseStatus: result.status, responseBody: parsed, expiresAt: expiresAt.toISOString() },
  });
  return result;
}
