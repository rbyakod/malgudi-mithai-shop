import { NextResponse } from 'next/server';
import { ApiError, ErrorCode } from './errors';
import { logger } from '../observability/Logger';

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function errorResponse(err: unknown, traceId: string = 'none') {
  if (err instanceof ApiError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode, headers: { 'X-Request-Id': traceId } });
  }
  // Don't leak internal details to the client — but do record them server
  // side, or the generic 500 leaves nothing to debug (an E11000 from the
  // rate limiter once hid behind this with a completely empty journal).
  logger.error({ traceId, err }, 'Unhandled API error');
  const internal = new ApiError(ErrorCode.INTERNAL, 'Something went wrong.', { traceId });
  return NextResponse.json(internal.toJSON(), { status: 500, headers: { 'X-Request-Id': traceId } });
}
