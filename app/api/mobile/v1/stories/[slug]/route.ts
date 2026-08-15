// app/api/mobile/v1/stories/[slug]/route.ts
// Story detail by slug for the apps' reader screen. Public, unauthenticated.
// Adds `body` (flattened Lexical) to the list projection; 404s with
// STORY_NOT_FOUND. Drafts excluded — `slug.equals` + `_status: published`.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
// 6 ../ to repo root from app/api/mobile/v1/stories/[slug]/
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { serializeStory } from '../../../../../../lib/api/catalogSerializers';
import { flattenLexical } from '../../../../../../lib/api/richText';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { slug } = await params;
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: 'stories',
      where: { slug: { equals: slug }, _status: { equals: 'published' } },
      limit: 1,
      draft: false,
    });

    const doc = result.docs[0];
    if (!doc) {
      throw new ApiError(ErrorCode.STORY_NOT_FOUND, `Story "${slug}" not found`, { traceId });
    }

    return jsonResponse(
      { ...serializeStory(doc), body: flattenLexical(doc.body) },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
