// app/api/mobile/v1/stories/route.ts
// Published-stories list endpoint for the apps' journal reader. Public,
// unauthenticated. Drafts are excluded via `_status: published` — the
// collection has versions.drafts enabled, so every published doc carries
// `_status` on the published version.
//
// ETag pattern mirrors catalog/products/route.ts (SHA-1 of `id:updatedAt`
// joined, quoted, 16 hex chars; If-None-Match → 304). `pillar` filter is
// optional for a future pillar-tab UI; sort is newest-first.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import type { Where } from 'payload';
import { createHash } from 'node:crypto';
// 5 ../ to repo root from app/api/mobile/v1/stories/
import config from '../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { serializeStory, type StoryDoc } from '../../../../../lib/api/catalogSerializers';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const pillar = url.searchParams.get('pillar') ?? undefined;
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100);

    const payload = await getPayload({ config });

    const where: Where = { _status: { equals: 'published' } };
    if (pillar) where.pillar = { equals: pillar };

    const result = await payload.find({
      collection: 'stories',
      where,
      page,
      limit: pageSize,
      sort: '-publishedAt',
      // Draft count must not leak into totalDocs for the published view.
      draft: false,
    });

    const etagInput = result.docs.map((d) => `${d.id}:${d.updatedAt ?? ''}`).join('|');
    const etag = '"' + createHash('sha1').update(etagInput).digest('hex').slice(0, 16) + '"';
    if (req.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return jsonResponse(
      {
        items: (result.docs as StoryDoc[]).map(serializeStory),
        total: result.totalDocs,
        page: result.page,
        pageSize: result.limit,
      },
      { headers: { ETag: etag, 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
